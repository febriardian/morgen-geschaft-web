// services/midtrans.js
// Midtrans API helper functions

export function formatMidtransStartTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second} +0700`;
}

function getMidtransBaseUrl() {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  return isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
}

function getMidtransAuthHeader() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi.");
  return "Basic " + Buffer.from(serverKey + ":").toString("base64");
}

export async function getMidtransTransactionStatus(orderId) {
  const baseUrl = getMidtransBaseUrl();
  const authHeader = getMidtransAuthHeader();

  const response = await fetch(`${baseUrl}/v2/${encodeURIComponent(orderId)}/status`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: authHeader },
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 404) return { found: false, data };
  if (!response.ok) {
    throw new Error(data.status_message || data.error_messages?.join?.(", ") || "Gagal mengambil status Midtrans.");
  }
  return { found: true, data };
}

export async function cancelMidtransTransaction(orderId) {
  const baseUrl = getMidtransBaseUrl();
  const authHeader = getMidtransAuthHeader();

  const response = await fetch(`${baseUrl}/v2/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 404) return { ok: true, skipped: true, data };

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data,
      message:
        data.status_message ||
        data.error_messages?.join?.(", ") ||
        "Midtrans menolak pembatalan transaksi.",
    };
  }

  return { ok: true, skipped: false, data };
}

export function createSnapTransaction(verifiedItems, { orderId, expectedAmount, customerName, customerEmail, customerPhone, discountAmount, couponCode, shippingAmount, shippingCourier, shippingService, paymentStartedAtDate, PAYMENT_EXPIRY_MINUTES }) {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const snapUrl = isProduction
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
  const authHeader = getMidtransAuthHeader();

  const itemDetails = verifiedItems.map((it) => ({
    id: it.id,
    price: it.price,
    quantity: it.qty,
    name: it.name.slice(0, 50),
  }));
  if (discountAmount > 0) {
    itemDetails.push({
      id: "DISCOUNT",
      price: -discountAmount,
      quantity: 1,
      name: couponCode ? `Diskon ${couponCode}` : "Diskon",
    });
  }
  if (shippingAmount > 0) {
    itemDetails.push({
      id: "SHIPPING",
      price: shippingAmount,
      quantity: 1,
      name: `Ongkir ${(shippingCourier || "").toUpperCase()} ${(shippingService || "").toUpperCase()}`.trim().slice(0, 50),
    });
  }

  return fetch(snapUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: expectedAmount },
      customer_details: {
        first_name: customerName || "Pelanggan",
        email: customerEmail || undefined,
        phone: customerPhone || undefined,
      },
      item_details: itemDetails,
      expiry: {
        start_time: formatMidtransStartTime(paymentStartedAtDate),
        unit: "minute",
        duration: PAYMENT_EXPIRY_MINUTES,
      },
    }),
  });
}
