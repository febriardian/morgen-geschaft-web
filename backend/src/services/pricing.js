export function normalizeRequestedItems(items, { maxUniqueItems = 50, maxQuantity = 50 } = {}) {
  const quantities = new Map();
  const names = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || "").trim();
    const quantity = Number.parseInt(item?.qty, 10);
    if (!id || !Number.isFinite(quantity) || quantity < 1) continue;
    if (!quantities.has(id) && quantities.size >= maxUniqueItems) continue;
    quantities.set(id, Math.min(maxQuantity, (quantities.get(id) || 0) + quantity));
    if (!names.has(id)) names.set(id, String(item?.name || id));
  }

  return [...quantities.entries()].map(([id, qty]) => ({ id, qty, name: names.get(id) || id }));
}

export function calculateCouponDiscount(coupon, subtotalValue) {
  const subtotal = Math.max(0, Number(subtotalValue || 0));
  if (!coupon || coupon.active === false) return 0;

  const minimumOrder = Math.max(0, Number(coupon.minOrder || 0));
  if (minimumOrder > 0 && subtotal < minimumOrder) return 0;

  let discount = 0;
  if (coupon.type === "percent") {
    discount = Math.round(subtotal * Math.max(0, Number(coupon.value || 0)) / 100);
  } else if (coupon.type === "fixed") {
    discount = Math.max(0, Number(coupon.value || 0));
  }

  return Math.max(0, Math.min(discount, subtotal));
}

export function calculateOrderTotal(items, discountValue = 0, shippingValue = 0) {
  const subtotal = (Array.isArray(items) ? items : []).reduce((sum, item) => {
    // `Number(x) || 0` — NaN-safe: harga/qty non-numerik dihitung 0, bukan NaN.
    const price = Math.max(0, Number(item?.price) || 0);
    const quantity = Math.max(0, Number(item?.qty) || 0);
    return sum + price * quantity;
  }, 0);

  const discountAmount = Math.max(0, Math.min(Number(discountValue || 0), subtotal));
  const shipping = Math.max(0, Number(shippingValue || 0));
  return {
    subtotal,
    discountAmount,
    shipping,
    total: subtotal - discountAmount + shipping,
  };
}
