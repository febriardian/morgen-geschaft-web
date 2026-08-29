const MAX_FLASH_SALE_PRODUCTS = 100;
const MAX_FLASH_SALE_DURATION_MS = 31 * 24 * 60 * 60 * 1000;
const DEFAULT_FLASH_SALE_QUERY_LIMIT = 50;

function inputError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function flashSaleTimestamp(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value?._seconds === "number") return value._seconds * 1000;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeQueryLimit(value, fallback = DEFAULT_FLASH_SALE_QUERY_LIMIT) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_FLASH_SALE_PRODUCTS * 2, Math.max(1, parsed));
}

/**
 * Jadwal tidak boleh saling bertabrakan, sehingga jadwal aktif selalu berada
 * di antara jadwal terbaru yang sudah dimulai. Query berdasarkan startAt ini
 * hanya membutuhkan indeks satu-field bawaan Firestore dan tidak bergantung
 * pada indeks endAt tambahan.
 */
export function buildCurrentFlashSalesQuery(
  db,
  nowValue = Date.now(),
  limit = DEFAULT_FLASH_SALE_QUERY_LIMIT
) {
  const now = flashSaleTimestamp(nowValue) || Date.now();
  return db
    .collection("flashSales")
    .where("startAt", "<=", new Date(now).toISOString())
    .orderBy("startAt", "desc")
    .limit(normalizeQueryLimit(limit));
}

/**
 * Kandidat konflik cukup dibatasi pada jadwal yang mulai sebelum kandidat
 * berakhir. findFlashSaleConflict() kemudian memeriksa sisi endAt di memori.
 */
export function buildPotentialFlashSaleConflictsQuery(
  db,
  candidateEndValue,
  limit = MAX_FLASH_SALE_PRODUCTS * 2
) {
  const candidateEnd = flashSaleTimestamp(candidateEndValue);
  if (!candidateEnd) throw inputError("Waktu selesai flash sale tidak valid.");

  return db
    .collection("flashSales")
    .where("startAt", "<", new Date(candidateEnd).toISOString())
    .orderBy("startAt", "desc")
    .limit(normalizeQueryLimit(limit, MAX_FLASH_SALE_PRODUCTS * 2));
}

function flashSaleQueryError(message) {
  const error = new TypeError(message);
  error.code = "FLASH_SALE_QUERY_INVALID";
  return error;
}

export function recordsFromFlashSaleSnapshot(snapshot) {
  if (!Array.isArray(snapshot?.docs)) {
    throw flashSaleQueryError("Hasil query flash sale tidak memiliki daftar dokumen.");
  }

  return snapshot.docs.map((document) => {
    if (!document || typeof document.data !== "function") {
      throw flashSaleQueryError("Dokumen hasil query flash sale tidak valid.");
    }

    const data = document.data();
    return {
      id: String(document.id || ""),
      ...(data && typeof data === "object" ? data : {}),
    };
  });
}

export async function executeFlashSaleQuery(query) {
  if (!query || typeof query.get !== "function") {
    throw flashSaleQueryError("Query flash sale tidak dapat dijalankan.");
  }

  const snapshot = await query.get();
  return recordsFromFlashSaleSnapshot(snapshot);
}

export function normalizeFlashSaleProductIds(value) {
  const ids = [];
  const seen = new Set();

  for (const rawId of Array.isArray(value) ? value : []) {
    const id = String(rawId || "").trim();
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_FLASH_SALE_PRODUCTS) break;
  }

  return ids;
}

export function normalizeFlashSaleInput(input = {}) {
  const titleId = String(input.titleId || "")
    .trim()
    .slice(0, 100);
  const titleEn = String(input.titleEn || "")
    .trim()
    .slice(0, 100);
  const discountPercent = Number(input.discountPercent);
  const productIds = normalizeFlashSaleProductIds(input.productIds);
  const startMs = flashSaleTimestamp(input.startAt);
  const endMs = flashSaleTimestamp(input.endAt);

  if (titleId.length < 3) {
    throw inputError("Nama flash sale minimal 3 karakter.");
  }
  if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 90) {
    throw inputError("Diskon flash sale harus berupa persen bulat antara 1 sampai 90.");
  }
  if (productIds.length === 0) {
    throw inputError("Pilih minimal satu produk untuk flash sale.");
  }
  if (!startMs || !endMs) {
    throw inputError("Waktu mulai dan selesai flash sale wajib diisi.");
  }
  if (endMs <= startMs) {
    throw inputError("Waktu selesai harus setelah waktu mulai.");
  }
  if (endMs - startMs > MAX_FLASH_SALE_DURATION_MS) {
    throw inputError("Durasi flash sale maksimal 31 hari.");
  }

  return {
    titleId,
    titleEn: titleEn || titleId,
    discountPercent,
    productIds,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    status: "scheduled",
  };
}

export function getFlashSaleStatus(sale, nowValue = Date.now()) {
  if (!sale) return "unknown";
  if (sale.status === "stopped") return "stopped";

  const now = flashSaleTimestamp(nowValue) || Date.now();
  const startAt = flashSaleTimestamp(sale.startAt);
  const endAt = flashSaleTimestamp(sale.endAt);
  if (!startAt || !endAt || endAt <= startAt) return "invalid";
  if (now < startAt) return "upcoming";
  if (now >= endAt) return "ended";
  return "active";
}

export function isFlashSaleActive(sale, nowValue = Date.now()) {
  return getFlashSaleStatus(sale, nowValue) === "active";
}

export function findFlashSaleConflict(sales, candidate, excludeId = "") {
  const candidateStart = flashSaleTimestamp(candidate?.startAt);
  const candidateEnd = flashSaleTimestamp(candidate?.endAt);
  if (!candidateStart || !candidateEnd) return null;

  return (
    (Array.isArray(sales) ? sales : []).find((sale) => {
      if (!sale || sale.id === excludeId || sale.status === "stopped") return false;
      const startAt = flashSaleTimestamp(sale.startAt);
      const endAt = flashSaleTimestamp(sale.endAt);
      return startAt > 0 && endAt > startAt && candidateStart < endAt && candidateEnd > startAt;
    }) || null
  );
}

export function resolveActiveFlashSale(sales, nowValue = Date.now()) {
  return (
    (Array.isArray(sales) ? sales : [])
      .filter((sale) => isFlashSaleActive(sale, nowValue))
      .sort((a, b) => flashSaleTimestamp(b.startAt) - flashSaleTimestamp(a.startAt))[0] || null
  );
}

export function calculateFlashSalePrice(regularPriceValue, discountPercentValue) {
  const regularPrice = Math.max(0, Math.round(Number(regularPriceValue) || 0));
  const discountPercent = Math.min(90, Math.max(0, Math.round(Number(discountPercentValue) || 0)));
  if (regularPrice <= 0 || discountPercent <= 0) return regularPrice;
  return Math.max(1, Math.round((regularPrice * (100 - discountPercent)) / 100));
}

export function getProductFlashSalePrice(product, sale, nowValue = Date.now()) {
  const regularPrice = Math.max(0, Math.round(Number(product?.price) || 0));
  const productId = String(product?.id || "");
  if (
    !productId ||
    !isFlashSaleActive(sale, nowValue) ||
    !Array.isArray(sale.productIds) ||
    !sale.productIds.includes(productId)
  ) {
    return {
      price: regularPrice,
      regularPrice,
      discountAmount: 0,
      flashSaleId: "",
      discountPercent: 0,
    };
  }

  const price = calculateFlashSalePrice(regularPrice, sale.discountPercent);
  return {
    price,
    regularPrice,
    discountAmount: Math.max(0, regularPrice - price),
    flashSaleId: String(sale.id || ""),
    discountPercent: Math.min(90, Math.max(0, Math.round(Number(sale.discountPercent) || 0))),
  };
}

export function serializeFlashSale(sale, nowValue = Date.now()) {
  return {
    id: String(sale?.id || ""),
    titleId: String(sale?.titleId || ""),
    titleEn: String(sale?.titleEn || sale?.titleId || ""),
    discountPercent: Math.min(90, Math.max(0, Math.round(Number(sale?.discountPercent) || 0))),
    productIds: normalizeFlashSaleProductIds(sale?.productIds),
    startAt: sale?.startAt || null,
    endAt: sale?.endAt || null,
    status: sale?.status === "stopped" ? "stopped" : "scheduled",
    derivedStatus: getFlashSaleStatus(sale, nowValue),
    createdAt: sale?.createdAt || null,
    updatedAt: sale?.updatedAt || null,
    stoppedAt: sale?.stoppedAt || null,
  };
}

export { MAX_FLASH_SALE_DURATION_MS, MAX_FLASH_SALE_PRODUCTS };
