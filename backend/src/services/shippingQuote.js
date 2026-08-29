import crypto from "node:crypto";

const QUOTE_TTL_MS = 15 * 60 * 1000;

function shippingSecret() {
  return process.env.SHIPPING_QUOTE_SECRET || process.env.MIDTRANS_SERVER_KEY || "";
}

function normalizeQuantity(value) {
  const quantity = Number.parseInt(value, 10);
  if (!Number.isFinite(quantity)) return 0;
  return Math.min(50, Math.max(0, quantity));
}

export function shippingItemsFingerprint(items) {
  const canonical = (Array.isArray(items) ? items : [])
    .map((item) => ({ id: String(item.id || "").trim(), qty: normalizeQuantity(item.qty) }))
    .filter((item) => item.id && item.qty > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `${item.id}:${item.qty}`)
    .join("|");

  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function signPayload(encodedPayload) {
  const secret = shippingSecret();
  if (!secret) throw new Error("SHIPPING_QUOTE_SECRET belum dikonfigurasi.");
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createShippingQuoteToken(payload) {
  const issuedAt = Date.now();
  const normalized = {
    destinationAreaId: String(payload.destinationAreaId || ""),
    destinationAreaName: String(payload.destinationAreaName || ""),
    shippingFee: Math.max(0, Number(payload.shippingFee || 0)),
    shippingCourier: String(payload.shippingCourier || ""),
    shippingService: String(payload.shippingService || ""),
    itemHash: String(payload.itemHash || ""),
    freeShipping: payload.freeShipping === true,
    issuedAt,
    expiresAt: issuedAt + QUOTE_TTL_MS,
  };
  const encoded = encodePayload(normalized);
  return `${encoded}.${signPayload(encoded)}`;
}

export function verifyShippingQuoteToken(token, expected = {}) {
  if (!token || typeof token !== "string") throw new Error("Pilih layanan pengiriman kembali.");

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("Quote pengiriman tidak valid.");

  const expectedSignature = signPayload(encoded);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error("Quote pengiriman tidak valid.");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("Quote pengiriman tidak valid.");
  }

  if (!payload.expiresAt || Date.now() > Number(payload.expiresAt)) {
    throw new Error("Quote pengiriman sudah kedaluwarsa. Hitung ulang ongkir.");
  }
  if (expected.destinationAreaId && payload.destinationAreaId !== String(expected.destinationAreaId)) {
    throw new Error("Tujuan pengiriman berubah. Hitung ulang ongkir.");
  }
  if (expected.itemHash && payload.itemHash !== String(expected.itemHash)) {
    throw new Error("Isi keranjang berubah. Hitung ulang ongkir.");
  }

  return payload;
}
