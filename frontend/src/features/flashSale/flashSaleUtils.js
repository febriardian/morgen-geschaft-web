function timestamp(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function isPublicFlashSaleActive(sale, nowValue = Date.now()) {
  if (!sale || sale.status === "stopped") return false;
  const now = Number(nowValue) || Date.now();
  const startAt = timestamp(sale.startAt);
  const endAt = timestamp(sale.endAt);
  return startAt > 0 && endAt > startAt && now >= startAt && now < endAt;
}

export function applyFlashSalePrices(products, sale, nowValue = Date.now()) {
  const source = Array.isArray(products) ? products : [];
  if (!isPublicFlashSaleActive(sale, nowValue)) return source;

  const prices = new Map(
    (Array.isArray(sale.prices) ? sale.prices : [])
      .map((item) => [String(item?.productId || ""), item])
      .filter(([productId]) => productId)
  );

  return source.map((product) => {
    const pricing = prices.get(String(product?.id || ""));
    const regularPrice = Math.max(0, Math.round(Number(pricing?.regularPrice) || 0));
    const salePrice = Math.max(0, Math.round(Number(pricing?.salePrice) || 0));
    if (!pricing || regularPrice <= 0 || salePrice <= 0 || salePrice >= regularPrice) {
      return product;
    }

    return {
      ...product,
      price: salePrice,
      originalPrice: regularPrice,
      flashSale: {
        id: String(sale.id || ""),
        titleId: String(sale.titleId || ""),
        titleEn: String(sale.titleEn || sale.titleId || ""),
        discountPercent: Math.min(90, Math.max(1, Math.round(Number(sale.discountPercent) || 0))),
        regularPrice,
        salePrice,
        startAt: sale.startAt,
        endAt: sale.endAt,
      },
    };
  });
}

export function flashSaleRemainingMs(sale, nowValue = Date.now()) {
  if (!isPublicFlashSaleActive(sale, nowValue)) return 0;
  return Math.max(0, timestamp(sale.endAt) - Number(nowValue));
}

export function countdownParts(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export function localDateTimeInput(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join("T");
}

export function flashSaleAdminStatus(sale, nowValue = Date.now()) {
  if (sale?.status === "stopped") return "stopped";
  const startAt = timestamp(sale?.startAt);
  const endAt = timestamp(sale?.endAt);
  const now = Number(nowValue) || Date.now();
  if (!startAt || !endAt || endAt <= startAt) return "invalid";
  if (now < startAt) return "upcoming";
  if (now >= endAt) return "ended";
  return "active";
}
