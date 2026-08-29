function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatIDR(value) {
  return `Rp${Math.round(number(value)).toLocaleString("id-ID")}`;
}

function dateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    const result = value.toDate();
    return Number.isNaN(result.getTime()) ? null : result;
  }
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
}

function formatDate(value, locale) {
  const date = dateValue(value) || new Date();
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clean(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

const COPY = {
  id: {
    customer: "Pelanggan",
    onlinePayment: "Pembayaran online",
    subject: (id) => `Pembayaran Berhasil - Invoice ${id}`,
    hello: (name) => `Halo ${name},`,
    thanks: "Terima kasih telah berbelanja di Morgen Geschäft.",
    received: (id) => `Pembayaran untuk pesanan ${id} telah berhasil kami terima.`,
    attachment: "Invoice pembayaran sudah dilampirkan dalam format PDF pada email ini.",
    total: "Total pembayaran",
    status: "Status",
    paid: "Pembayaran berhasil",
    date: "Tanggal pembayaran",
    method: "Metode pembayaran",
    processing: "Pesananmu akan segera kami proses. Informasi pengiriman akan dikirimkan setelah pesanan diserahkan kepada kurir.",
    saveInvoice: "Simpan invoice tersebut sebagai bukti pembayaran.",
    track: "Lacak pesanan",
    greeting: "Salam,",
    tagline: "Skincare original yang lebih mudah dipilih.",
    confirmation: "KONFIRMASI PEMBAYARAN",
    summary: "RINGKASAN PEMBAYARAN",
    orderNumber: "Nomor pesanan",
    processTitle: "Pesanan akan segera diproses.",
    processBody: "Informasi pengemasan dan pengiriman akan dikirimkan setelah pesanan diserahkan kepada kurir.",
    savePdf: (id) => `Simpan file Invoice-${id}.pdf sebagai bukti pembayaran. Apabila ada pertanyaan, hubungi kami melalui WhatsApp.`,
    whatsapp: "Hubungi WhatsApp",
    auto: "Email ini dikirim otomatis setelah pembayaran terverifikasi. Jangan mengirim data rahasia melalui balasan email.",
    waQuestion: (id) => `Halo Morgen Geschäft, saya ingin menanyakan pesanan ${id}.`,
  },
  en: {
    customer: "Customer",
    onlinePayment: "Online payment",
    subject: (id) => `Payment Successful - Invoice ${id}`,
    hello: (name) => `Hello ${name},`,
    thanks: "Thank you for shopping at Morgen Geschäft.",
    received: (id) => `We have successfully received payment for order ${id}.`,
    attachment: "Your payment invoice is attached to this email as a PDF.",
    total: "Total payment",
    status: "Status",
    paid: "Payment successful",
    date: "Payment date",
    method: "Payment method",
    processing: "We will process your order shortly. Shipping information will be sent after the package is handed to the courier.",
    saveInvoice: "Keep the attached invoice as your proof of payment.",
    track: "Track order",
    greeting: "Regards,",
    tagline: "Authentic skincare, made easier to choose.",
    confirmation: "PAYMENT CONFIRMATION",
    summary: "PAYMENT SUMMARY",
    orderNumber: "Order number",
    processTitle: "Your order will be processed shortly.",
    processBody: "Packing and shipping information will be sent after the order is handed to the courier.",
    savePdf: (id) => `Keep Invoice-${id}.pdf as your proof of payment. Contact us on WhatsApp if you need help.`,
    whatsapp: "Contact us on WhatsApp",
    auto: "This email was sent automatically after payment verification. Do not send sensitive information in an email reply.",
    waQuestion: (id) => `Hello Morgen Geschäft, I would like to ask about order ${id}.`,
  },
};

function getTrackingUrl(orderId, locale) {
  const base = String(process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || "")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");
  if (!base) return "";
  const path = locale === "en" ? "/en#track-order" : "/id#lacak";
  return `${base}${path}?order=${encodeURIComponent(orderId)}`;
}

export function buildPaidInvoiceEmail(order, orderId) {
  const locale = order?.locale === "en" ? "en" : "id";
  const copy = COPY[locale];
  const customerName = clean(order.customerName, copy.customer);
  const total = number(order.amount);
  const paidAt = formatDate(order.paidAt || order.updatedAt || order.createdAt, locale);
  const payment = clean(order.paymentMethod || order.paymentType || order.channel, copy.onlinePayment);
  const trackingUrl = getTrackingUrl(orderId, locale);
  const whatsappNumber = String(process.env.STORE_WHATSAPP || "6289601725019").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(copy.waQuestion(orderId))}`;

  const subject = copy.subject(orderId);
  const text = [
    copy.hello(customerName),
    "",
    copy.thanks,
    copy.received(orderId),
    copy.attachment,
    "",
    `${copy.total}: ${formatIDR(total)}`,
    `${copy.status}: ${copy.paid}`,
    `${copy.date}: ${paidAt}`,
    `${copy.method}: ${payment}`,
    "",
    copy.processing,
    copy.saveInvoice,
    trackingUrl ? `${copy.track}: ${trackingUrl}` : "",
    "",
    copy.greeting,
    "Morgen Geschäft",
    copy.tagline,
  ].filter(Boolean).join("\n");

  const actionButton = trackingUrl
    ? `<a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#1F2E22;color:#FFFFFF;text-decoration:none;padding:11px 18px;border-radius:9px;font-size:13px;font-weight:700;margin-right:8px">${escapeHtml(copy.track)}</a>`
    : "";

  const html = `
  <div lang="${locale}" style="background:#F3EFE6;padding:32px 14px;font-family:Arial,Helvetica,sans-serif;color:#162B45">
    <div style="max-width:620px;margin:0 auto;background:#FFFFFF;border:1px solid #E3DCC9;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(22,43,69,.08)">
      <div style="background:linear-gradient(135deg,#FFFDF8 0%,#F6F1E7 72%,#FBEBD2 100%);padding:25px 28px;border-bottom:3px solid #F59A1A">
        <div style="font-size:10px;letter-spacing:.15em;font-weight:700;color:#4C6354">${escapeHtml(copy.confirmation)}</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;color:#162B45;margin-top:5px">Morgen Geschäft</div>
        <div style="font-size:12px;color:#6B6558;margin-top:4px">${escapeHtml(copy.tagline)}</div>
      </div>

      <div style="padding:28px">
        <p style="font-size:14px;line-height:1.7;margin:0 0 14px">${escapeHtml(copy.hello(customerName))}</p>
        <p style="font-size:14px;line-height:1.75;color:#4A4540;margin:0">
          ${escapeHtml(copy.thanks)} ${escapeHtml(copy.received(orderId))}
          ${escapeHtml(copy.attachment)}
        </p>

        <div style="margin:22px 0;background:#FFFDF8;border:1px solid #E3DCC9;border-radius:12px;padding:17px 18px">
          <div style="font-size:10px;letter-spacing:.12em;font-weight:700;color:#4C6354;margin-bottom:12px">${escapeHtml(copy.summary)}</div>
          <table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:5px 0;color:#6B6558">${escapeHtml(copy.orderNumber)}</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#162B45">${escapeHtml(orderId)}</td></tr>
            <tr><td style="padding:5px 0;color:#6B6558">${escapeHtml(copy.date)}</td><td style="padding:5px 0;text-align:right;color:#162B45">${escapeHtml(paidAt)}</td></tr>
            <tr><td style="padding:5px 0;color:#6B6558">${escapeHtml(copy.method)}</td><td style="padding:5px 0;text-align:right;color:#162B45">${escapeHtml(payment)}</td></tr>
            <tr><td style="padding:5px 0;color:#6B6558">${escapeHtml(copy.status)}</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#2E6B45">${escapeHtml(copy.paid)}</td></tr>
            <tr><td colspan="2" style="padding-top:11px"><div style="height:2px;background:#162B45"></div></td></tr>
            <tr><td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#162B45">${escapeHtml(copy.total)}</td><td style="padding:12px 0 0;text-align:right;font-size:19px;font-weight:700;color:#1F2E22">${escapeHtml(formatIDR(total))}</td></tr>
          </table>
        </div>

        <div style="background:#DCE6D6;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.65;color:#1F2E22">
          <strong>${escapeHtml(copy.processTitle)}</strong><br />
          ${escapeHtml(copy.processBody)}
        </div>

        <p style="font-size:13px;line-height:1.7;color:#6B6558;margin:20px 0">
          ${escapeHtml(copy.savePdf(orderId))}
        </p>

        <div style="margin-top:18px">
          ${actionButton}
          <a href="${escapeHtml(whatsappUrl)}" style="display:inline-block;border:1px solid #1F2E22;color:#1F2E22;text-decoration:none;padding:10px 17px;border-radius:9px;font-size:13px;font-weight:700">${escapeHtml(copy.whatsapp)}</a>
        </div>

        <p style="font-size:13px;line-height:1.7;color:#4A4540;margin:26px 0 0">
          ${escapeHtml(copy.greeting)}<br /><strong style="color:#162B45">Morgen Geschäft</strong>
        </p>
      </div>

      <div style="padding:16px 28px;background:#FAF8F3;border-top:1px solid #E3DCC9;text-align:center;font-size:10px;line-height:1.6;color:#8B8578">
        ${escapeHtml(copy.auto)}
      </div>
    </div>
  </div>`;

  return { subject, text, html };
}
