import PDFDocument from "pdfkit";
import fs from "fs";
import { log } from "../logger.js";

const COLORS = {
  ink: "#162B45",
  green: "#1F2E22",
  sage: "#4C6354",
  cream: "#F6F1E7",
  line: "#E3DCC9",
  orange: "#F59A1A",
  muted: "#6B6558",
  soft: "#FFFEFB",
  softGreen: "#DCE6D6",
  danger: "#C65C4D",
  white: "#FFFFFF",
};

const STATUS_META = {
  id: {
    pending: { label: "Menunggu pembayaran", color: "#C97B5E" },
    paid: { label: "Pembayaran berhasil", color: "#4C6354" },
    processing: { label: "Sedang diproses", color: "#6B8A7A" },
    shipped: { label: "Dikirim", color: "#229ED9" },
    delivered: { label: "Sampai tujuan", color: "#1F2E22" },
    cancelled: { label: "Dibatalkan", color: "#999999" },
    failed: { label: "Gagal / dibatalkan", color: "#A39E8E" },
  },
  en: {
    pending: { label: "Awaiting payment", color: "#C97B5E" },
    paid: { label: "Payment successful", color: "#4C6354" },
    processing: { label: "Processing", color: "#6B8A7A" },
    shipped: { label: "Shipped", color: "#229ED9" },
    delivered: { label: "Delivered", color: "#1F2E22" },
    cancelled: { label: "Cancelled", color: "#999999" },
    failed: { label: "Failed / cancelled", color: "#A39E8E" },
  },
};

const INVOICE_COPY = {
  id: {
    official: "Official Invoice", tagline: "Skincare original yang lebih mudah dipilih.", invoiceNo: "Nomor Invoice",
    billedTo: "Ditagihkan kepada", customer: "Pelanggan", orderStatus: "Status pesanan", unavailable: "Belum tersedia",
    payment: "Pembayaran", headers: ["No.", "Produk", "Qty", "Harga", "Jumlah"], product: "Produk",
    paymentShipping: "Pembayaran & pengiriman", method: "Metode", courier: "Kurir", tracking: "No. resi", coupon: "Kupon",
    subtotal: "Subtotal", discount: "Diskon", shipping: "Ongkir", total: "Total",
    thanks: "Terima kasih sudah berbelanja.", keep: "Simpan invoice ini sebagai bukti transaksi. Hubungi Morgen Geschäft apabila ada pertanyaan terkait pesanan.",
    automatic: "Invoice dibuat otomatis oleh sistem.", empty: "Tidak ada produk", subject: "Bukti pembayaran pesanan",
  },
  en: {
    official: "Official Invoice", tagline: "Authentic skincare, made easier to choose.", invoiceNo: "Invoice Number",
    billedTo: "Billed to", customer: "Customer", orderStatus: "Order status", unavailable: "Not available",
    payment: "Payment", headers: ["No.", "Product", "Qty", "Price", "Amount"], product: "Product",
    paymentShipping: "Payment & shipping", method: "Method", courier: "Courier", tracking: "Tracking no.", coupon: "Coupon",
    subtotal: "Subtotal", discount: "Discount", shipping: "Shipping", total: "Total",
    thanks: "Thank you for shopping with us.", keep: "Keep this invoice as proof of your transaction. Contact Morgen Geschäft if you have any questions about the order.",
    automatic: "This invoice was generated automatically.", empty: "No products", subject: "Proof of order payment",
  },
};

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

function formatDate(value, locale = "id") {
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

function cleanText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

async function loadLogoBuffer() {
  const localPath = String(process.env.INVOICE_LOGO_PATH || "").trim();
  if (localPath && fs.existsSync(localPath)) {
    try {
      return fs.readFileSync(localPath);
    } catch (error) {
      log("warn", "invoice", "Gagal membaca INVOICE_LOGO_PATH", { error: error.message });
    }
  }

  const url = String(process.env.INVOICE_LOGO_URL || "").trim();
  if (url) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      log("warn", "invoice", "Gagal mengambil INVOICE_LOGO_URL", { error: error.message });
    }
  }

  return null;
}

function roundedBox(doc, x, y, width, height, options = {}) {
  const radius = options.radius ?? 10;
  doc.save();
  doc.roundedRect(x, y, width, height, radius);
  if (options.fill) doc.fillAndStroke(options.fill, options.stroke || options.fill);
  else doc.stroke(options.stroke || COLORS.line);
  doc.restore();
}

function label(doc, text, x, y, options = {}) {
  doc
    .font("Helvetica-Bold")
    .fontSize(options.size || 7)
    .fillColor(options.color || COLORS.sage)
    .text(String(text || "").toUpperCase(), x, y, {
      width: options.width,
      characterSpacing: options.characterSpacing ?? 1.25,
      align: options.align || "left",
    });
}

function drawBrandMark(doc, logoBuffer, x, y) {
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, x, y, { fit: [42, 42], align: "center", valign: "center" });
      return;
    } catch (error) {
      log("warn", "invoice", "Logo invoice tidak dapat dirender", { error: error.message });
    }
  }

  doc.save();
  doc.roundedRect(x, y, 42, 42, 10).fill(COLORS.green);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(COLORS.white)
    .text("MG", x, y + 13, { width: 42, align: "center" });
  doc.restore();
}

function drawPageHeader(doc, order, orderId, logoBuffer, compact = false, locale = "id") {
  const copy = INVOICE_COPY[locale];
  const pageWidth = doc.page.width;
  const margin = 42;
  const width = pageWidth - margin * 2;
  const y = compact ? 28 : 34;
  const height = compact ? 62 : 104;

  roundedBox(doc, margin, y, width, height, {
    fill: "#FFFDF8",
    stroke: COLORS.line,
    radius: compact ? 10 : 14,
  });
  doc.rect(margin, y + height - 3, width, 3).fill(COLORS.orange);

  drawBrandMark(doc, logoBuffer, margin + 16, y + (compact ? 10 : 24));

  const brandX = margin + 70;
  label(doc, copy.official, brandX, y + (compact ? 10 : 21));
  doc
    .font("Times-Bold")
    .fontSize(compact ? 18 : 25)
    .fillColor(COLORS.ink)
    .text("Morgen Geschäft", brandX, y + (compact ? 24 : 38), { width: 240 });

  if (!compact) {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(copy.tagline, brandX, y + 70, { width: 260 });
  }

  const metaWidth = 190;
  const metaX = margin + width - metaWidth - 16;
  label(doc, copy.invoiceNo, metaX, y + (compact ? 10 : 21), {
    width: metaWidth,
    align: "right",
  });
  doc
    .font("Helvetica-Bold")
    .fontSize(compact ? 9.5 : 10.5)
    .fillColor(COLORS.ink)
    .text(cleanText(orderId), metaX, y + (compact ? 25 : 39), {
      width: metaWidth,
      align: "right",
    });
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(formatDate(order.paidAt || order.createdAt, locale), metaX, y + (compact ? 39 : 58), {
      width: metaWidth,
      align: "right",
    });

  return y + height + (compact ? 14 : 20);
}

function drawCustomerCards(doc, order, y, locale = "id") {
  const copy = INVOICE_COPY[locale];
  const margin = 42;
  const totalWidth = doc.page.width - margin * 2;
  const gap = 12;
  const leftWidth = 326;
  const rightWidth = totalWidth - leftWidth - gap;
  const height = 118;

  roundedBox(doc, margin, y, leftWidth, height, { fill: COLORS.soft, stroke: COLORS.line });
  roundedBox(doc, margin + leftWidth + gap, y, rightWidth, height, { fill: COLORS.soft, stroke: COLORS.line });

  label(doc, copy.billedTo, margin + 15, y + 15);
  doc
    .font("Helvetica-Bold")
    .fontSize(11.5)
    .fillColor(COLORS.ink)
    .text(cleanText(order.customerName, copy.customer), margin + 15, y + 32, { width: leftWidth - 30 });

  const contactLines = [
    cleanText(order.customerPhone),
    cleanText(order.customerEmail),
    cleanText(order.address),
  ];
  doc
    .font("Helvetica")
    .fontSize(8.2)
    .fillColor(COLORS.muted)
    .text(contactLines.join("\n"), margin + 15, y + 52, {
      width: leftWidth - 30,
      height: 55,
      lineGap: 2.5,
    });

  const rightX = margin + leftWidth + gap;
  label(doc, copy.orderStatus, rightX + 15, y + 15);
  const status = STATUS_META[locale][order.status] || {
    label: cleanText(order.status),
    color: COLORS.muted,
  };
  const pillTextWidth = Math.min(130, Math.max(76, doc.widthOfString(status.label) + 28));
  doc.save();
  doc.roundedRect(rightX + 15, y + 34, pillTextWidth, 24, 12).fill(status.color);
  doc.circle(rightX + 25, y + 46, 2.8).fill(COLORS.white);
  doc
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor(COLORS.white)
    .text(status.label, rightX + 33, y + 41, { width: pillTextWidth - 23 });
  doc.restore();

  const paymentLabel = cleanText(order.paymentMethod || order.paymentType || order.channel, copy.unavailable);
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(copy.payment, rightX + 15, y + 72, { width: rightWidth - 30 });
  doc
    .font("Helvetica-Bold")
    .fontSize(8.6)
    .fillColor(COLORS.ink)
    .text(paymentLabel, rightX + 15, y + 86, { width: rightWidth - 30 });

  return y + height + 18;
}

function drawTableHeader(doc, y, locale = "id") {
  const copy = INVOICE_COPY[locale];
  const x = 42;
  const widths = [30, 221, 44, 92, 124];
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const height = 30;

  doc.save();
  doc.roundedRect(x, y, totalWidth, height, 8).fill(COLORS.green);
  const headers = copy.headers;
  let cursor = x;
  headers.forEach((header, index) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(COLORS.white)
      .text(header.toUpperCase(), cursor + 8, y + 11, {
        width: widths[index] - 16,
        align: index >= 2 ? (index === 2 ? "center" : "right") : "left",
        characterSpacing: 0.55,
      });
    cursor += widths[index];
  });
  doc.restore();
  return { y: y + height, widths, x, totalWidth };
}

function drawItemRow(doc, item, index, y, table, locale = "id") {
  const copy = INVOICE_COPY[locale];
  const productName = cleanText(locale === "en" ? (item.nameEn || item.name) : item.name, copy.product);
  const idText = String(item.id || "").trim();
  const nameHeight = doc.heightOfString(productName, {
    width: table.widths[1] - 18,
    lineGap: 1,
  });
  const rowHeight = Math.max(38, nameHeight + (idText ? 18 : 11));
  const fill = index % 2 === 0 ? COLORS.white : "#FCFAF5";

  doc.rect(table.x, y, table.totalWidth, rowHeight).fillAndStroke(fill, COLORS.line);

  let cursor = table.x;
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#A39E8E")
    .text(String(index + 1), cursor, y + 14, { width: table.widths[0], align: "center" });
  cursor += table.widths[0];

  doc
    .font("Helvetica-Bold")
    .fontSize(8.2)
    .fillColor(COLORS.ink)
    .text(productName, cursor + 9, y + 9, { width: table.widths[1] - 18, lineGap: 1 });
  if (idText) {
    const firstLineHeight = doc.heightOfString(productName, { width: table.widths[1] - 18, lineGap: 1 });
    doc
      .font("Helvetica")
      .fontSize(6.7)
      .fillColor("#A39E8E")
      .text(idText, cursor + 9, y + 9 + firstLineHeight + 3, { width: table.widths[1] - 18 });
  }
  cursor += table.widths[1];

  const qty = number(item.qty);
  const unitPrice = number(item.price);
  doc
    .font("Helvetica")
    .fontSize(8.2)
    .fillColor(COLORS.ink)
    .text(String(qty), cursor, y + 14, { width: table.widths[2], align: "center" });
  cursor += table.widths[2];

  doc.text(formatIDR(unitPrice), cursor + 6, y + 14, {
    width: table.widths[3] - 12,
    align: "right",
  });
  cursor += table.widths[3];

  doc
    .font("Helvetica-Bold")
    .fillColor(COLORS.green)
    .text(formatIDR(unitPrice * qty), cursor + 6, y + 14, {
      width: table.widths[4] - 12,
      align: "right",
    });

  return y + rowHeight;
}

function drawShippingAndSummary(doc, order, y, locale = "id") {
  const copy = INVOICE_COPY[locale];
  const margin = 42;
  const totalWidth = doc.page.width - margin * 2;
  const gap = 14;
  const leftWidth = 281;
  const rightWidth = totalWidth - leftWidth - gap;
  const height = 164;

  roundedBox(doc, margin, y, leftWidth, height, { fill: "#FCFAF5", stroke: COLORS.line });
  roundedBox(doc, margin + leftWidth + gap, y, rightWidth, height, { fill: "#FFFDF8", stroke: COLORS.line });

  label(doc, copy.paymentShipping, margin + 15, y + 15);
  const payment = cleanText(order.paymentMethod || order.paymentType || order.channel, copy.unavailable);
  const courier = `${cleanText(order.shippingCourier)} ${String(order.shippingService || "").trim()}`.trim();
  const rows = [
    [copy.method, payment],
    [copy.courier, courier || "-"],
    [copy.tracking, cleanText(order.trackingNumber, copy.unavailable)],
  ];
  if (order.couponCode) rows.push([copy.coupon, cleanText(order.couponCode)]);

  let rowY = y + 38;
  rows.forEach(([key, value]) => {
    doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted).text(key, margin + 15, rowY, { width: 72 });
    doc.font("Helvetica-Bold").fontSize(7.8).fillColor(COLORS.ink).text(value, margin + 92, rowY, {
      width: leftWidth - 107,
      height: 26,
    });
    rowY += 27;
  });

  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce((sum, item) => sum + number(item.price) * number(item.qty), 0);
  const discount = number(order.discount);
  const shippingFee = number(order.shippingFee);
  const total = number(order.amount) || Math.max(0, subtotal - discount + shippingFee);
  const summaryX = margin + leftWidth + gap;
  const summaryWidth = rightWidth;

  const summaryRows = [
    [copy.subtotal, formatIDR(subtotal), COLORS.ink],
    [copy.discount, discount > 0 ? `-${formatIDR(discount)}` : formatIDR(0), discount > 0 ? COLORS.danger : COLORS.ink],
    [copy.shipping, formatIDR(shippingFee), COLORS.ink],
  ];
  let summaryY = y + 20;
  summaryRows.forEach(([key, value, valueColor]) => {
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(key, summaryX + 15, summaryY, { width: 90 });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(valueColor).text(value, summaryX + 105, summaryY, {
      width: summaryWidth - 120,
      align: "right",
    });
    summaryY += 26;
  });

  doc.moveTo(summaryX + 15, y + 100).lineTo(summaryX + summaryWidth - 15, y + 100).lineWidth(1.6).strokeColor(COLORS.ink).stroke();
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(COLORS.ink).text(copy.total, summaryX + 15, y + 117, { width: 70 });
  doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.green).text(formatIDR(total), summaryX + 88, y + 114, {
    width: summaryWidth - 103,
    align: "right",
  });

  return y + height;
}

function drawFooter(doc, y, locale = "id") {
  const copy = INVOICE_COPY[locale];
  const margin = 42;
  const width = doc.page.width - margin * 2;
  doc.moveTo(margin, y).lineTo(margin + width, y).lineWidth(0.8).strokeColor(COLORS.line).stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor(COLORS.ink)
    .text(copy.thanks, margin, y + 14, { width: 260 });
  doc
    .font("Helvetica")
    .fontSize(7.2)
    .fillColor("#8B8577")
    .text(copy.keep, margin, y + 27, {
      width: 330,
      lineGap: 2,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor(COLORS.ink)
    .text("Morgen Geschäft", margin + width - 150, y + 14, { width: 150, align: "right" });
  doc
    .font("Helvetica")
    .fontSize(6.8)
    .fillColor("#8B8577")
    .text(copy.automatic, margin + width - 190, y + 28, { width: 190, align: "right" });
}

export async function generateInvoicePdf(orderInput, orderIdInput) {
  const orderId = cleanText(orderIdInput || orderInput?.id || orderInput?.orderId);
  const order = { ...(orderInput || {}), id: orderId };
  const locale = order.locale === "en" ? "en" : "id";
  const copy = INVOICE_COPY[locale];
  const logoBuffer = await loadLogoBuffer();

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 34, right: 42, bottom: 42, left: 42 },
    bufferPages: true,
    info: {
      Title: `Invoice ${orderId}`,
      Author: "Morgen Geschäft",
      Subject: copy.subject,
      Creator: "Morgen Geschäft Backend",
    },
  });

  const chunks = [];
  const result = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  let y = drawPageHeader(doc, order, orderId, logoBuffer, false, locale);
  y = drawCustomerCards(doc, order, y, locale);
  let table = drawTableHeader(doc, y, locale);
  y = table.y;

  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    doc.rect(table.x, y, table.totalWidth, 42).fillAndStroke(COLORS.white, COLORS.line);
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(copy.empty, table.x, y + 16, {
      width: table.totalWidth,
      align: "center",
    });
    y += 42;
  } else {
    items.forEach((item, index) => {
      const estimatedHeight = Math.max(
        38,
        doc.heightOfString(cleanText(locale === "en" ? (item.nameEn || item.name) : item.name, copy.product), { width: table.widths[1] - 18, lineGap: 1 }) + (item.id ? 18 : 11)
      );
      if (y + estimatedHeight > doc.page.height - 230) {
        doc.addPage();
        y = drawPageHeader(doc, order, orderId, logoBuffer, true, locale);
        table = drawTableHeader(doc, y, locale);
        y = table.y;
      }
      y = drawItemRow(doc, item, index, y, table, locale);
    });
  }

  y += 20;
  if (y + 235 > doc.page.height - 42) {
    doc.addPage();
    y = drawPageHeader(doc, order, orderId, logoBuffer, true, locale);
  }
  y = drawShippingAndSummary(doc, order, y, locale);
  drawFooter(doc, y + 24, locale);

  // Nomor halaman sengaja tidak ditambahkan agar PDFKit tidak membuat halaman kosong ekstra.


  doc.end();
  return result;
}
