// Simpan riwayat pesanan per identitas pelanggan agar pesanan pengguna A
// tidak ikut tampil ketika data checkout diganti ke pengguna B pada browser yang sama.
const ORDER_HISTORY_STORAGE_KEY = "mg_order_history_by_customer";



function normalizeCustomerPhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}



function getCustomerStorageKey(customer = loadSavedCustomer()) {
  const phone = normalizeCustomerPhone(customer?.phone);
  if (phone) return `phone:${phone}`;

  const email = String(customer?.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;

  return "";
}



function readOrderHistories() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDER_HISTORY_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}



function saveOrderToLocalHistory(orderId, customer = loadSavedCustomer()) {
  const customerKey = getCustomerStorageKey(customer);
  if (!orderId || !customerKey) return;

  try {
    const histories = readOrderHistories();
    const existing = Array.isArray(histories[customerKey]) ? histories[customerKey] : [];
    histories[customerKey] = [
      orderId,
      ...existing.filter((id) => id !== orderId),
    ].slice(0, 20);

    localStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(histories));

    // Data lama memakai satu daftar global sehingga dapat terbaca pelanggan lain.
    // Hapus setelah format per-pelanggan berhasil disimpan.
    localStorage.removeItem("mg_order_history");
  } catch {
    // localStorage tidak tersedia, abaikan diam-diam
  }
}



function getLocalOrderHistory(customer = loadSavedCustomer()) {
  const customerKey = getCustomerStorageKey(customer);
  if (!customerKey) return [];

  const histories = readOrderHistories();
  return Array.isArray(histories[customerKey]) ? histories[customerKey] : [];
}



// Simpan sesi Snap di perangkat pembeli agar pembayaran yang sempat ditutup
// bisa dibuka lagi selama token belum kedaluwarsa.
const PAYMENT_SESSION_STORAGE_KEY = "mg_payment_sessions";
const ORDER_ACCESS_STORAGE_KEY = "mg_order_access_tokens";



function readPaymentSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PAYMENT_SESSION_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}



function savePaymentSession(session) {
  if (!session?.orderId || !session?.token) return;
  try {
    const sessions = readPaymentSessions();
    sessions[session.orderId] = {
      orderId: session.orderId,
      token: session.token,
      redirectUrl: session.redirectUrl || "",
      expiresAt: session.expiresAt || "",
      cancelToken: session.cancelToken || "",
      customerAccessToken: session.customerAccessToken || "",
      savedAt: new Date().toISOString(),
    };

    const trimmed = Object.fromEntries(
      Object.entries(sessions)
        .sort(([, a], [, b]) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
        .slice(0, 20)
    );
    localStorage.setItem(PAYMENT_SESSION_STORAGE_KEY, JSON.stringify(trimmed));

    // Bukti kepemilikan tetap diperlukan setelah sesi Snap dibersihkan
    // untuk notifikasi, retur, dan lacak pesanan.
    if (session.customerAccessToken) {
      const accessTokens = readOrderAccessTokens();
      accessTokens[session.orderId] = {
        customerAccessToken: session.customerAccessToken,
        savedAt: new Date().toISOString(),
      };
      const trimmedAccessTokens = Object.fromEntries(
        Object.entries(accessTokens)
          .sort(([, a], [, b]) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
          .slice(0, 20)
      );
      localStorage.setItem(ORDER_ACCESS_STORAGE_KEY, JSON.stringify(trimmedAccessTokens));
    }
  } catch {
    // localStorage tidak tersedia, abaikan diam-diam.
  }
}

function readOrderAccessTokens() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDER_ACCESS_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getOrderAccessToken(orderId) {
  if (!orderId) return "";
  return readOrderAccessTokens()[orderId]?.customerAccessToken
    || readPaymentSessions()[orderId]?.customerAccessToken
    || "";
}

function getLocalOrderAccessProofs(customer = loadSavedCustomer()) {
  const orderIds = getLocalOrderHistory(customer);
  return orderIds.slice(0, 10).map((orderId) => ({
    orderId,
    customerAccessToken: getOrderAccessToken(orderId),
  })).filter((item) => item.customerAccessToken);
}



function getPaymentSession(orderId) {
  if (!orderId) return null;
  return readPaymentSessions()[orderId] || null;
}



function clearPaymentSession(orderId) {
  if (!orderId) return;
  try {
    const sessions = readPaymentSessions();
    delete sessions[orderId];
    localStorage.setItem(PAYMENT_SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Abaikan jika localStorage tidak tersedia.
  }
}



function paymentDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}



function formatPaymentCountdown(milliseconds) {
  const safe = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}



// ---------- Simpan data checkout pelanggan ----------
function loadSavedCustomer() {
  try { return JSON.parse(localStorage.getItem("mg_customer") || "{}"); } catch { return {}; }
}


function saveCustomerData(data) {
  try { localStorage.setItem("mg_customer", JSON.stringify(data)); } catch {}
}

export { ORDER_HISTORY_STORAGE_KEY, normalizeCustomerPhone, getCustomerStorageKey, saveOrderToLocalHistory, getLocalOrderHistory, ORDER_ACCESS_STORAGE_KEY, getOrderAccessToken, getLocalOrderAccessProofs, PAYMENT_SESSION_STORAGE_KEY, readPaymentSessions, savePaymentSession, getPaymentSession, clearPaymentSession, paymentDate, formatPaymentCountdown, loadSavedCustomer, saveCustomerData };
