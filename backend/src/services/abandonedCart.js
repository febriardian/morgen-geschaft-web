// services/abandonedCart.js
// Abandoned Cart Recovery — kirim email reminder ke customer yang belum bayar.
// Dipanggil oleh cron di server.js setiap 10 menit pada primary worker.

import { getAdminDb } from "../config/firebaseAdmin.js";
import { createMailTransport } from "./email.js";
import { log } from "./logger.js";

const rawPaymentExpiryMinutes = Number.parseInt(process.env.PAYMENT_EXPIRY_MINUTES || "60", 10);
const paymentExpiryMinutes = Number.isFinite(rawPaymentExpiryMinutes)
  ? Math.max(5, rawPaymentExpiryMinutes)
  : 60;
const rawReminderMinutes = Number.parseInt(process.env.ABANDONED_CART_REMINDER_MINUTES || "", 10);
const requestedReminderMinutes = Number.isFinite(rawReminderMinutes)
  ? Math.max(5, rawReminderMinutes)
  : Math.max(5, Math.floor(paymentExpiryMinutes / 2));
const REMINDER_DELAY_MINUTES = Math.min(
  requestedReminderMinutes,
  Math.max(5, paymentExpiryMinutes - 5),
);
const REMINDER_DELAY_MS = REMINDER_DELAY_MINUTES * 60 * 1000;
const MAX_REMINDERS_PER_RUN = 20;

/**
 * Query pending orders yang sudah >1 jam tapi belum expired,
 * dan belum pernah dapat reminder email. Kirim reminder, tandai.
 */
export async function sendAbandonedCartReminders() {
  const db = getAdminDb();
  const cutoff = Date.now() - REMINDER_DELAY_MS;

  const snap = await db
    .collection("orders")
    .where("status", "==", "pending")
    .where("reminderSent", "==", false)
    .orderBy("createdAt", "asc")
    .limit(MAX_REMINDERS_PER_RUN)
    .get();

  if (snap.empty) return 0;

  const transport = createMailTransport();
  if (!transport) {
    log("warn", "abandoned-cart", "SMTP belum dikonfigurasi, skip reminder");
    return 0;
  }

  let sent = 0;
  const siteUrl = process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || "https://morgengeschaft.com";

  for (const doc of snap.docs) {
    const order = doc.data();
    const orderId = doc.id;

    // Skip jika order dibuat kurang dari REMINDER_DELAY_MS lalu
    const createdAt = typeof order.createdAt === "number"
      ? order.createdAt
      : new Date(order.createdAt).getTime();
    if (createdAt > cutoff) continue;

    // Skip jika tidak ada email
    if (!order.customerEmail) continue;

    const paymentExpiresAt = new Date(order.paymentExpiresAt || 0).getTime();
    if (Number.isFinite(paymentExpiresAt) && paymentExpiresAt > 0 && paymentExpiresAt <= Date.now()) {
      continue;
    }

    const isLocaleEn = order.locale === "en";

    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM || `"Morgen Geschäft" <${process.env.SMTP_USER}>`,
        to: order.customerEmail,
        subject: isLocaleEn
          ? `Complete your order ${orderId} — Morgen Geschäft`
          : `Selesaikan pesanan ${orderId} — Morgen Geschäft`,
        text: isLocaleEn
          ? `Hi ${order.customerName || ""},\n\nYour order ${orderId} is waiting for payment.\n\nComplete your payment: ${siteUrl}/en#track-order\n\nIf you've already paid, please ignore this email.\n\nMorgen Geschäft`
          : `Halo ${order.customerName || ""},\n\nPesanan ${orderId} menunggu pembayaran.\n\nSelesaikan pembayaran: ${siteUrl}/id#lacak\n\nJika sudah membayar, abaikan email ini.\n\nMorgen Geschäft`,
        html: buildReminderHtml(order, orderId, siteUrl, isLocaleEn),
      });

      await doc.ref.update({ reminderSent: true, reminderSentAt: new Date().toISOString() });
      sent += 1;

      log("info", "abandoned-cart", `Reminder sent for ${orderId}`, {
        to: order.customerEmail,
      });
    } catch (err) {
      log("error", "abandoned-cart", `Failed to send reminder for ${orderId}`, {
        error: err.message,
      });
    }
  }

  return sent;
}

function buildReminderHtml(order, orderId, siteUrl, isEn) {
  const items = (order.items || [])
    .map((i) => `<li>${i.name || i.id} × ${i.qty}</li>`)
    .join("");
  const trackUrl = isEn ? `${siteUrl}/en#track-order` : `${siteUrl}/id#lacak`;
  const formatIDR = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

  return `
    <div style="font-family:'Work Sans',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#162B45;">
      <div style="background:#F6F1E7;padding:24px 28px;border-radius:12px;">
        <h2 style="font-size:20px;margin:0 0 8px;">
          ${isEn ? "Your order is waiting!" : "Pesananmu menunggu!"}
        </h2>
        <p style="font-size:13px;color:#6B6558;margin:0 0 18px;line-height:1.65;">
          ${isEn
            ? `Order <b>${orderId}</b> hasn't been paid yet. Complete your payment before it expires.`
            : `Pesanan <b>${orderId}</b> belum dibayar. Selesaikan pembayaran sebelum kedaluwarsa.`}
        </p>
        ${items ? `<ul style="font-size:13px;color:#4C6354;padding-left:18px;margin:0 0 14px;">${items}</ul>` : ""}
        <p style="font-size:15px;font-weight:600;margin:0 0 18px;">Total: ${formatIDR(order.total || order.amount)}</p>
        <a href="${trackUrl}" style="display:inline-block;background:#1F2E22;color:#F6F1E7;text-decoration:none;padding:12px 24px;border-radius:9px;font-size:13px;font-weight:600;">
          ${isEn ? "Complete Payment →" : "Selesaikan Pembayaran →"}
        </a>
      </div>
      <p style="font-size:10px;color:#A39E8E;margin-top:16px;text-align:center;">
        ${isEn
          ? "If you've already paid, please ignore this email."
          : "Jika sudah membayar, abaikan email ini."}
      </p>
    </div>
  `;
}
