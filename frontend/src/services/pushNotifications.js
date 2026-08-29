import { apiFetch, readJsonResponse } from "./apiClient.js";
import { urlBase64ToUint8Array } from "../utils/general.js";

function arraysEqual(left, right) {
  if (!left || !right || left.byteLength !== right.byteLength) return false;
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  return a.every((value, index) => value === b[index]);
}

export async function ensureServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw Object.assign(new Error("Browser ini belum mendukung notifikasi push."), { code: "unsupported" });
  }

  if (!window.isSecureContext) {
    throw Object.assign(new Error("Notifikasi memerlukan HTTPS atau localhost."), { code: "insecure" });
  }

  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;

  return navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
}

export async function getExistingPushSubscription() {
  const registration = await ensureServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
}

export async function subscribeToBrowserPush(locale = "id") {
  if (!("Notification" in window)) {
    throw Object.assign(new Error("Browser ini belum mendukung notifikasi."), { code: "unsupported" });
  }

  const permission = await Notification.requestPermission();
  if (permission === "denied") {
    throw Object.assign(new Error(
      locale === "en"
        ? "Notifications are blocked. Allow them from the browser site settings."
        : "Notifikasi diblokir. Izinkan melalui pengaturan situs di browser."
    ), { code: "denied" });
  }
  if (permission !== "granted") {
    throw Object.assign(new Error(
      locale === "en" ? "Notification permission was not granted." : "Izin notifikasi belum diberikan."
    ), { code: "dismissed" });
  }

  const registration = await ensureServiceWorkerRegistration();
  const keyResponse = await apiFetch("/api/push/vapid-key", {}, { timeoutMs: 12000, expectJson: true });
  const keyPayload = await readJsonResponse(keyResponse);

  if (!keyResponse.ok) {
    throw Object.assign(new Error(
      keyPayload.error || (locale === "en"
        ? "The notification server is not configured yet."
        : "Server notifikasi belum dikonfigurasi.")
    ), { code: "server", status: keyResponse.status });
  }

  const publicKey = String(keyPayload.publicKey || "").trim();
  if (!publicKey) {
    throw Object.assign(new Error(
      locale === "en" ? "The notification key is unavailable." : "Kunci notifikasi belum tersedia."
    ), { code: "server" });
  }

  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();

  if (subscription?.options?.applicationServerKey
      && !arraysEqual(subscription.options.applicationServerKey, applicationServerKey.buffer)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  const subscribeResponse = await apiFetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription, locale }),
  }, { timeoutMs: 12000, expectJson: true });
  const subscribePayload = await readJsonResponse(subscribeResponse);

  if (!subscribeResponse.ok) {
    throw Object.assign(new Error(
      subscribePayload.error || (locale === "en"
        ? "The subscription could not be saved."
        : "Subscription notifikasi gagal disimpan.")
    ), { code: "server", status: subscribeResponse.status });
  }

  return subscription;
}
