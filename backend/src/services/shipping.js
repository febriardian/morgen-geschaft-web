import { getAdminDb } from "../config/firebaseAdmin.js";
import { log } from "./logger.js";
import { createShippingQuoteToken, shippingItemsFingerprint } from "./shippingQuote.js";
import { normalizeRequestedItems } from "./pricing.js";

const BITESHIP_BASE = "https://api.biteship.com";

export async function getShippingSettings() {
  const db = getAdminDb();
  const snap = await db.collection("settings").doc("shipping").get();
  return snap.exists ? snap.data() : null;
}

export async function getVerifiedShippingItems(items) {
  const normalizedItems = normalizeRequestedItems(items)
    .filter((item) => item.id && item.qty > 0);

  if (normalizedItems.length === 0) throw new Error("Item pengiriman tidak valid.");

  const db = getAdminDb();
  const refs = normalizedItems.map((item) => db.collection("products").doc(item.id));
  const snaps = await db.getAll(...refs);

  return normalizedItems.map((item, index) => {
    const snap = snaps[index];
    if (!snap.exists) throw new Error(`Produk ${item.id} tidak ditemukan.`);
    const product = snap.data();
    return {
      id: item.id,
      name: String(product.name || "Skincare").slice(0, 120),
      qty: item.qty,
      price: Math.max(0, Number(product.price || 0)),
      weight: Math.min(30000, Math.max(1, Number(product.weight || 200))),
      length: Math.min(100, Math.max(1, Number(product.length || 15))),
      width: Math.min(100, Math.max(1, Number(product.width || 10))),
      height: Math.min(100, Math.max(1, Number(product.height || 8))),
    };
  });
}

export async function calculateShippingQuotes({ destinationAreaId, destinationAreaName = "", items }) {
  if (!destinationAreaId) throw new Error("Area tujuan wajib dipilih.");

  const apiKey = process.env.BITESHIP_API_KEY;
  if (!apiKey) throw new Error("Shipping belum dikonfigurasi.");

  const settings = await getShippingSettings();
  if (!settings) throw new Error("Pengaturan pengiriman belum diset.");

  const activeCity = settings.activeCity || "semarang";
  const origin = settings.origins?.[activeCity];
  if (!origin?.areaId) throw new Error("Origin pengiriman belum dikonfigurasi.");

  const verifiedItems = await getVerifiedShippingItems(items);
  const itemHash = shippingItemsFingerprint(verifiedItems);
  const freePrefixes = Array.isArray(settings.freeShippingPrefixes?.[activeCity])
    ? settings.freeShippingPrefixes[activeCity]
    : [];
  const isFreeShipping = freePrefixes.some((prefix) => String(destinationAreaId).startsWith(String(prefix)));

  if (isFreeShipping) {
    const quote = {
      destinationAreaId,
      destinationAreaName,
      shippingFee: 0,
      shippingCourier: "internal",
      shippingService: "free-shipping",
      itemHash,
      freeShipping: true,
    };
    return {
      freeShipping: true,
      shippingFee: 0,
      quoteToken: createShippingQuoteToken(quote),
      message: `Gratis ongkir! Pesananmu akan diantar langsung oleh tim kami di ${origin.label || activeCity}.`,
      pricing: [],
    };
  }

  const biteRes = await fetch(`${BITESHIP_BASE}/v1/rates/couriers`, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      origin_area_id: origin.areaId,
      destination_area_id: destinationAreaId,
      couriers: settings.couriers || "jne,sicepat,anteraja",
      items: verifiedItems.map((item) => ({
        name: item.name,
        description: "Morgen Geschaft product",
        category: "beauty",
        value: item.price,
        weight: item.weight,
        quantity: item.qty,
        length: item.length,
        width: item.width,
        height: item.height,
      })),
    }),
  });

  const data = await biteRes.json().catch(() => ({}));
  if (!biteRes.ok) {
    log("error", "shipping", "Biteship rates error", { status: biteRes.status, data });
    throw new Error("Gagal menghitung ongkir.");
  }

  const pricing = (data.pricing || [])
    .filter((item) => Number(item.shipping_fee || item.price || 0) > 0)
    .map((item) => {
      const price = Math.max(0, Number(item.shipping_fee || item.price || 0));
      const shippingCourier = String(item.company || "").toLowerCase();
      const shippingService = String(item.courier_service_code || "");
      return {
        company: shippingCourier,
        courierName: item.courier_name,
        serviceCode: shippingService,
        serviceName: item.courier_service_name,
        price,
        shippingFee: price,
        duration: item.duration,
        type: item.type,
        quoteToken: createShippingQuoteToken({
          destinationAreaId,
          destinationAreaName,
          shippingFee: price,
          shippingCourier,
          shippingService,
          itemHash,
          freeShipping: false,
        }),
      };
    })
    .sort((a, b) => a.price - b.price);

  return { freeShipping: false, pricing };
}
