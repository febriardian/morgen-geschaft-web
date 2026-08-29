// services/email.js
// Semua fungsi terkait email: SMTP transport, invoice, admin notif, status update, back-in-stock

import nodemailer from "nodemailer";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { log } from "./logger.js";
import { generateInvoicePdf } from "./email/invoicePdf.js";
import { buildPaidInvoiceEmail } from "./email/invoiceEmail.js";

function boundedTimeout(value, fallback, maximum = 60000) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(1000, parsed)) : fallback;
}

export function getSmtpConfig(env = process.env) {
  const host = String(env.SMTP_HOST || "").trim();
  const user = String(env.SMTP_USER || "").trim();
  const password = String(env.SMTP_PASS || "");
  const parsedPort = Number.parseInt(env.SMTP_PORT || "587", 10);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : 587;
  const secure = env.SMTP_SECURE === "true"
    ? true
    : env.SMTP_SECURE === "false"
      ? false
      : port === 465;
  const missing = [
    !host ? "SMTP_HOST" : "",
    !user ? "SMTP_USER" : "",
    !password ? "SMTP_PASS" : "",
  ].filter(Boolean);

  return {
    host,
    port,
    secure,
    user,
    password,
    configured: missing.length === 0,
    missing,
    connectionTimeout: boundedTimeout(env.SMTP_CONNECTION_TIMEOUT_MS, 10000),
    greetingTimeout: boundedTimeout(env.SMTP_GREETING_TIMEOUT_MS, 10000),
    socketTimeout: boundedTimeout(env.SMTP_SOCKET_TIMEOUT_MS, 15000),
  };
}

export function smtpTransportOptions(env = process.env) {
  const config = getSmtpConfig(env);
  if (!config.configured) return null;
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: config.connectionTimeout,
    greetingTimeout: config.greetingTimeout,
    socketTimeout: config.socketTimeout,
    tls: {
      minVersion: "TLSv1.2",
      servername: String(env.SMTP_TLS_SERVERNAME || config.host).trim(),
    },
  };
}

export function classifySmtpError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  if (code === "EAUTH" || code === "EENVELOPE") return "authentication_error";
  if (
    ["ETIMEDOUT", "ESOCKET", "ECONNECTION", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]
      .includes(code)
  ) {
    return "connection_error";
  }
  if (
    code.includes("TLS") ||
    message.includes("certificate") ||
    message.includes("tls") ||
    message.includes("ssl")
  ) {
    return "tls_error";
  }
  return "error";
}

export function createMailTransport(env = process.env) {
  const options = smtpTransportOptions(env);
  return options ? nodemailer.createTransport(options) : null;
}

export async function verifySmtpConnection({
  env = process.env,
  transportFactory = createMailTransport,
} = {}) {
  const config = getSmtpConfig(env);
  if (!config.configured) {
    return {
      configured: false,
      status: "not_configured",
      latencyMs: -1,
      errorCode: "",
      missing: config.missing,
    };
  }

  const startedAt = Date.now();
  const transport = transportFactory(env);
  try {
    await transport.verify();
    return {
      configured: true,
      status: "ok",
      latencyMs: Date.now() - startedAt,
      errorCode: "",
      missing: [],
    };
  } catch (error) {
    const status = classifySmtpError(error);
    log("warn", "email", "SMTP verification failed", {
      status,
      code: String(error?.code || ""),
      command: String(error?.command || ""),
      ms: Date.now() - startedAt,
    });
    return {
      configured: true,
      status,
      latencyMs: Date.now() - startedAt,
      errorCode: String(error?.code || "").slice(0, 40),
      missing: [],
    };
  } finally {
    if (typeof transport?.close === "function") transport.close();
  }
}

function escapeEmailText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendCustomerOtpEmail(email, code, expiresMinutes = 10) {
  const transport = createMailTransport();
  if (!transport) throw new Error("SMTP belum dikonfigurasi.");
  const safeCode = escapeEmailText(code);
  await transport.sendMail({
    from: process.env.SMTP_FROM || `"Morgen Geschäft" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `${safeCode} — Kode masuk Morgen Geschäft`,
    text: `Kode masuk Morgen Geschäft: ${code}. Berlaku ${expiresMinutes} menit. Jangan bagikan kode ini.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#162B45"><h1 style="font-size:22px">Kode masuk Morgen Geschäft</h1><p>Masukkan kode berikut pada website:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;background:#F6F1E7;padding:18px;text-align:center">${safeCode}</p><p style="font-size:13px;color:#6B6558">Kode berlaku ${expiresMinutes} menit dan hanya dapat digunakan satu kali. Jangan bagikan kode ini kepada siapa pun.</p></div>`,
  });
}

export async function sendOrderConfirmationEmail(order, orderId) {
  const transport = createMailTransport();
  if (!transport) throw new Error("SMTP belum dikonfigurasi.");
  if (!order.customerEmail) throw new Error("Email pelanggan tidak tersedia.");

  const pdfBuffer = await generateInvoicePdf(order, orderId);
  const message = buildPaidInvoiceEmail(order, orderId);

  await transport.sendMail({
    from: process.env.SMTP_FROM || `"Morgen Geschäft" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: [
      {
        filename: `Invoice-${orderId}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  log("info", "email", "Invoice PDF terkirim", { to: order.customerEmail });
}

/**
 * Idempotent invoice email — claim via Firestore transaction lalu kirim.
 * Mencegah duplicate email dari webhook Midtrans berulang.
 */
export async function sendPaidInvoiceEmailOnce(orderId) {
  const db = getAdminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const now = new Date();
  const staleAfterMs = 10 * 60 * 1000;

  const claimedOrder = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return null;

    const order = snap.data();
    if (!order.customerEmail || order.invoiceEmailSent === true) return null;

    const lastAttempt = order.invoiceEmailLastAttemptAt
      ? new Date(order.invoiceEmailLastAttemptAt).getTime()
      : 0;
    const sendingIsFresh =
      order.invoiceEmailStatus === "sending" &&
      Number.isFinite(lastAttempt) &&
      now.getTime() - lastAttempt < staleAfterMs;

    if (sendingIsFresh) return null;

    tx.update(orderRef, {
      invoiceEmailStatus: "sending",
      invoiceEmailLastAttemptAt: now.toISOString(),
      invoiceEmailError: null,
    });

    return { id: snap.id, ...order };
  });

  if (!claimedOrder) return { sent: false, skipped: true };

  try {
    await sendOrderConfirmationEmail(claimedOrder, orderId);
    await orderRef.update({
      invoiceEmailSent: true,
      invoiceEmailStatus: "sent",
      invoiceEmailSentAt: new Date().toISOString(),
      invoiceEmailError: null,
    });
    return { sent: true, skipped: false };
  } catch (error) {
    await orderRef.update({
      invoiceEmailSent: false,
      invoiceEmailStatus: "failed",
      invoiceEmailError: String(error?.message || error).slice(0, 500),
      invoiceEmailFailedAt: new Date().toISOString(),
    });
    throw error;
  }
}

export async function sendAdminOrderNotification(order, orderId) {
  const transport = createMailTransport();
  if (!transport) return;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER;
  if (!adminEmail) return;

  const itemsList = (order.items || [])
    .map((it) => `• ${it.name} ×${it.qty} — Rp${(it.price * it.qty).toLocaleString("id-ID")}`)
    .join("\n");
  const amount = order.amount || (order.items || []).reduce((s, it) => s + it.price * it.qty, 0);

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#C97B5E;padding:20px 32px">
      <h1 style="font-size:18px;color:#fff;margin:0">🛒 Pesanan Baru Masuk!</h1>
    </div>
    <div style="padding:24px 32px">
      <table style="width:100%;font-size:14px;color:#232323;line-height:1.8">
        <tr><td style="color:#6B6558;width:130px">ID Pesanan</td><td style="font-family:monospace;font-weight:600">${orderId}</td></tr>
        <tr><td style="color:#6B6558">Pelanggan</td><td><strong>${order.customerName || "-"}</strong></td></tr>
        <tr><td style="color:#6B6558">No. HP</td><td>${order.customerPhone || "-"}</td></tr>
        ${order.customerEmail ? `<tr><td style="color:#6B6558">Email</td><td>${order.customerEmail}</td></tr>` : ""}
        <tr><td style="color:#6B6558;vertical-align:top">Alamat</td><td>${order.address || "-"}</td></tr>
        <tr><td style="color:#6B6558;vertical-align:top">Produk</td><td style="white-space:pre-line">${itemsList}</td></tr>
        ${order.discount > 0 ? `<tr><td style="color:#6B6558">Diskon</td><td style="color:#4C6354">-Rp${order.discount.toLocaleString("id-ID")}${order.couponCode ? ` (${order.couponCode})` : ""}</td></tr>` : ""}
        <tr><td style="color:#6B6558">Total</td><td style="font-size:18px;font-weight:700;color:#1F2E22">Rp${amount.toLocaleString("id-ID")}</td></tr>
      </table>
      <div style="margin-top:20px;padding:14px 16px;background:#DCE6D6;font-size:13px;color:#1F2E22">
        ✅ Pembayaran sudah berhasil. Segera proses pesanan ini.
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #E8E3D5;font-size:11px;color:#A39E8E">
      Email ini dikirim otomatis oleh sistem Morgen Geschäft.
    </div>
  </div>`;

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: adminEmail,
    subject: `🛒 Pesanan Baru ${orderId} — ${order.customerName || "Pelanggan"} — Rp${amount.toLocaleString("id-ID")}`,
    html,
  });
  log("info", "email", "Admin notification email terkirim", { orderId });
}

export async function sendStatusUpdateEmail(order, orderId, newStatus, trackingNumber) {
  const transport = createMailTransport();
  if (!transport) { log("info", "email", "SMTP belum dikonfigurasi, skip email status."); return; }
  const statusLabels = { shipped: "Pesanan Dikirim 📦", delivered: "Pesanan Sampai ✅" };
  const statusMessages = {
    shipped: `Pesananmu dengan ID <strong>${orderId}</strong> sudah dikirim!${trackingNumber ? `<br><br>Nomor resi: <strong style="font-family:monospace;font-size:16px;color:#1F2E22">${trackingNumber}</strong>` : ""}`,
    delivered: `Pesananmu dengan ID <strong>${orderId}</strong> sudah sampai di tujuan. Terima kasih sudah belanja di Morgen Geschäft! 🌿`,
  };
  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff"><div style="background:#1F2E22;padding:24px 32px"><h1 style="font-size:20px;color:#F6F1E7;margin:0;font-weight:600">Morgen Geschäft</h1></div><div style="padding:28px 32px"><h2 style="font-size:20px;color:#1F2E22;margin:0 0 16px">${statusLabels[newStatus] || "Update Pesanan"}</h2><p style="font-size:14px;color:#232323;line-height:1.7">Halo <strong>${order.customerName || "Pelanggan"}</strong>,<br><br>${statusMessages[newStatus] || "Status pesananmu telah diperbarui."}</p></div><div style="padding:20px 32px;border-top:1px solid #E8E3D5;font-size:11px;color:#A39E8E;line-height:1.7"><p style="margin:0">WhatsApp: <a href="https://wa.me/6289601725019" style="color:#4C6354;text-decoration:none">0896-0172-5019</a></p></div></div>`;
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: order.customerEmail,
    subject: `${statusLabels[newStatus] || "Update"} — Pesanan ${orderId}`,
    html,
  });
}

export async function sendBackInStockEmails(productId, productName) {
  const transport = createMailTransport();
  if (!transport) { log("info", "email", "SMTP belum dikonfigurasi, skip back-in-stock email."); return; }

  try {
    const db = getAdminDb();
    const snap = await db.collection("stock_notifications")
      .where("productId", "==", productId)
      .where("notified", "==", false)
      .get();

    if (snap.empty) return;

    let sent = 0;
    for (const doc of snap.docs) {
      const { email } = doc.data();
      try {
        await transport.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: `${productName} sudah tersedia! — Morgen Geschäft`,
          html: `
          <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
            <div style="background:#1F2E22;padding:24px 32px"><h1 style="font-size:20px;color:#F6F1E7;margin:0">Morgen Geschäft</h1></div>
            <div style="padding:28px 32px">
              <h2 style="font-size:20px;color:#1F2E22;margin:0 0 16px">Stok Kembali Tersedia! 🎉</h2>
              <p style="font-size:14px;color:#232323;line-height:1.7">
                Halo! Produk <strong>${productName}</strong> yang kamu tunggu sudah tersedia kembali di toko kami.
              </p>
              <a href="${process.env.FRONTEND_URL || 'https://morgengeschaft.com'}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#1F2E22;color:#F6F1E7;text-decoration:none;font-weight:600;font-size:14px">
                Beli Sekarang →
              </a>
            </div>
            <div style="padding:20px 32px;border-top:1px solid #E8E3D5;font-size:11px;color:#A39E8E">
              <p style="margin:0">Kamu menerima email ini karena mendaftar notifikasi stok di Morgen Geschäft.</p>
            </div>
          </div>`,
        });
        await doc.ref.update({ notified: true, notifiedAt: new Date().toISOString() });
        sent++;
      } catch (err) {
        log("error", "email", "Gagal kirim back-in-stock email", { to: email, error: err.message });
      }
    }
    log("info", "email", `Back-in-stock: ${sent} email terkirim`, { productName });
  } catch (err) {
    log("error", "email", "sendBackInStockEmails error", { error: err.message });
  }
}
