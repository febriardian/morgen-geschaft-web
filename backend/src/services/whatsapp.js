// services/whatsapp.js
// WhatsApp notification via Fonnte API (https://fonnte.com).
// Fonnte dipilih karena murah (~Rp50rb/bulan), API sederhana, dan populer di Indonesia.
// Jika FONNTE_TOKEN tidak diset, semua fungsi silently skip (graceful degradation).

import { log } from "./logger.js";

const FONNTE_API = "https://api.fonnte.com/send";

function isConfigured() {
  return Boolean(process.env.FONNTE_TOKEN);
}

/**
 * Kirim pesan WhatsApp via Fonnte.
 * @param {string} phone — nomor WA (08xxx atau 62xxx)
 * @param {string} message — plain text message
 * @returns {Promise<boolean>} true jika terkirim
 */
async function sendMessage(phone, message) {
  if (!isConfigured()) return false;
  if (!phone || !message) return false;

  // Normalize nomor: 08xxx → 628xxx
  const normalized = String(phone).replace(/^0/, "62").replace(/[^0-9]/g, "");
  if (normalized.length < 10 || normalized.length > 15) {
    log("warn", "whatsapp", "Invalid phone number", { phone: normalized.slice(0, 6) + "***" });
    return false;
  }

  try {
    const response = await fetch(FONNTE_API, {
      method: "POST",
      headers: {
        Authorization: process.env.FONNTE_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: normalized,
        message,
        countryCode: "62",
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.status) {
      log("info", "whatsapp", "Message sent", { target: normalized.slice(0, 6) + "***" });
      return true;
    }

    log("warn", "whatsapp", "Send failed", { status: response.status, detail: data.detail || data.reason || "" });
    return false;
  } catch (err) {
    log("error", "whatsapp", "Send error", { error: err.message });
    return false;
  }
}

/**
 * Notifikasi order baru ke customer.
 */
export async function notifyOrderCreated(order, orderId) {
  if (!isConfigured() || !order.customerPhone) return;

  const isEn = order.locale === "en";
  const formatIDR = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://morgengeschaft.com";

  const message = isEn
    ? `🛍️ *Morgen Geschäft*\n\nHi ${order.customerName || ""},\nYour order *${orderId}* has been received!\n\nTotal: *${formatIDR(order.total)}*\nPlease complete your payment.\n\nTrack order: ${siteUrl}/en#track-order`
    : `🛍️ *Morgen Geschäft*\n\nHalo ${order.customerName || ""},\nPesanan *${orderId}* telah diterima!\n\nTotal: *${formatIDR(order.total)}*\nSilakan selesaikan pembayaran.\n\nLacak pesanan: ${siteUrl}/id#lacak`;

  await sendMessage(order.customerPhone, message);
}

/**
 * Notifikasi pembayaran berhasil ke customer.
 */
export async function notifyPaymentSuccess(order, orderId) {
  if (!isConfigured() || !order.customerPhone) return;

  const isEn = order.locale === "en";
  const formatIDR = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

  const message = isEn
    ? `✅ *Payment Confirmed*\n\nOrder *${orderId}* — *${formatIDR(order.total)}*\nYour order is being processed.\n\nThank you for shopping at Morgen Geschäft!`
    : `✅ *Pembayaran Dikonfirmasi*\n\nPesanan *${orderId}* — *${formatIDR(order.total)}*\nPesananmu sedang diproses.\n\nTerima kasih berbelanja di Morgen Geschäft!`;

  await sendMessage(order.customerPhone, message);
}

/**
 * Notifikasi update status (shipped, delivered).
 */
export async function notifyStatusUpdate(order, orderId, newStatus, trackingNumber) {
  if (!isConfigured() || !order.customerPhone) return;

  const isEn = order.locale === "en";
  const statusLabels = {
    shipped: isEn ? "Shipped" : "Dikirim",
    delivered: isEn ? "Delivered" : "Terkirim",
    processing: isEn ? "Processing" : "Diproses",
  };

  const label = statusLabels[newStatus];
  if (!label) return; // Only notify for meaningful statuses

  let message = isEn
    ? `📦 *Order Update*\n\nOrder *${orderId}*\nStatus: *${label}*`
    : `📦 *Update Pesanan*\n\nPesanan *${orderId}*\nStatus: *${label}*`;

  if (trackingNumber && newStatus === "shipped") {
    message += isEn
      ? `\nTracking: *${trackingNumber}*`
      : `\nNo. Resi: *${trackingNumber}*`;
  }

  await sendMessage(order.customerPhone, message);
}

/**
 * Notifikasi order baru ke admin.
 */
export async function notifyAdminNewOrder(order, orderId) {
  const adminPhone = process.env.ADMIN_WHATSAPP || process.env.STORE_WHATSAPP;
  if (!isConfigured() || !adminPhone) return;

  const formatIDR = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
  const items = (order.items || []).map((i) => `• ${i.name || i.id} × ${i.qty}`).join("\n");

  const message = `🔔 *Pesanan Baru*\n\nID: *${orderId}*\nNama: ${order.customerName || "-"}\nTotal: *${formatIDR(order.total)}*\n\n${items}`;

  await sendMessage(adminPhone, message);
}

export { isConfigured as isWhatsAppConfigured, sendMessage as sendWhatsAppMessage };
