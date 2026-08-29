// services/stockAlert.js
// Automatic low-stock alert — kirim email ke admin ketika stok produk
// di bawah threshold. Dipanggil oleh cron di server.js setiap 30 menit.

import { getAdminDb } from "../config/firebaseAdmin.js";
import { createMailTransport } from "./email.js";
import { log } from "./logger.js";

const LOW_STOCK_THRESHOLD = 3;
const ALERT_COOLDOWN_HOURS = 24; // Jangan spam — max 1 alert per produk per hari

/**
 * Cek semua produk aktif, kirim 1 email gabungan ke admin jika ada yg stok rendah.
 * @returns {Promise<number>} jumlah produk yang di-alert
 */
export async function checkAndAlertLowStock() {
  const db = getAdminDb();

  // Ambil semua produk aktif (tidak diarsipkan)
  const productSnap = await db.collection("products").get();
  const lowStockProducts = [];

  for (const doc of productSnap.docs) {
    const data = doc.data();
    if (data.archived) continue;
    const stock = Number(data.stock || 0);
    if (stock > LOW_STOCK_THRESHOLD) continue;

    lowStockProducts.push({
      id: doc.id,
      name: data.name || doc.id,
      stock,
    });
  }

  if (lowStockProducts.length === 0) return 0;

  // Check cooldown — pakai _meta/lastStockAlert
  const metaRef = db.collection("_meta").doc("lastStockAlert");
  const metaSnap = await metaRef.get();
  const lastAlertTime = metaSnap.exists ? new Date(metaSnap.data().sentAt).getTime() : 0;
  const cooldownMs = ALERT_COOLDOWN_HOURS * 60 * 60 * 1000;

  if (Date.now() - lastAlertTime < cooldownMs) {
    return 0; // Still in cooldown
  }

  // Kirim email
  const transport = createMailTransport();
  if (!transport) {
    log("warn", "stock-alert", "SMTP belum dikonfigurasi, skip alert");
    return 0;
  }

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER;
  if (!adminEmail) return 0;

  const rows = lowStockProducts
    .sort((a, b) => a.stock - b.stock)
    .map((p) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E3DCC9;font-size:13px;">${p.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E3DCC9;font-size:13px;text-align:center;color:${p.stock === 0 ? "#C65C4D" : "#A86200"};font-weight:600;">${p.stock}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E3DCC9;font-size:11px;color:#6B6558;">${p.id}</td>
    </tr>`)
    .join("");

  const outOfStock = lowStockProducts.filter((p) => p.stock === 0).length;

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || `"Morgen Geschäft" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `⚠️ Stok Rendah: ${lowStockProducts.length} produk (${outOfStock} habis) — Morgen Geschäft`,
      html: `
        <div style="font-family:'Work Sans',sans-serif;max-width:600px;margin:0 auto;color:#162B45;">
          <div style="background:#FFF8F0;border:1px solid #E3DCC9;border-radius:12px;padding:24px;">
            <h2 style="font-size:18px;margin:0 0 6px;">Peringatan Stok Rendah</h2>
            <p style="font-size:13px;color:#6B6558;margin:0 0 18px;">
              ${lowStockProducts.length} produk memiliki stok ≤ ${LOW_STOCK_THRESHOLD}${outOfStock > 0 ? ` (${outOfStock} habis)` : ""}.
            </p>
            <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #E3DCC9;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#F6F1E7;">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B6558;font-weight:600;">Produk</th>
                  <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6B6558;font-weight:600;">Stok</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B6558;font-weight:600;">ID</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <p style="font-size:10px;color:#A39E8E;margin-top:16px;text-align:center;">
            Alert dikirim max 1× per 24 jam. Threshold: ≤ ${LOW_STOCK_THRESHOLD} unit.
          </p>
        </div>
      `,
    });

    await metaRef.set({ sentAt: new Date().toISOString(), count: lowStockProducts.length });
    log("info", "stock-alert", `Low stock alert sent: ${lowStockProducts.length} products`, {
      to: adminEmail,
      outOfStock,
    });

    return lowStockProducts.length;
  } catch (err) {
    log("error", "stock-alert", "Failed to send alert", { error: err.message });
    return 0;
  }
}
