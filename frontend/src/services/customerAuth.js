import { apiFetch, readJsonResponse } from "./apiClient.js";

let firebaseAuthModulePromise = null;
let accountRequest = null;
let accountCache = null;
const ACCOUNT_CACHE_TTL_MS = 30000;

function loadFirebaseAuthModule() {
  if (!firebaseAuthModulePromise) {
    firebaseAuthModulePromise = import("./firebaseAuth.js").catch((error) => {
      firebaseAuthModulePromise = null;
      throw error;
    });
  }
  return firebaseAuthModulePromise;
}

function preloadCustomerAuth() {
  window.dispatchEvent(new Event("mg:customer-auth-request"));
  void loadFirebaseAuthModule().catch(() => {});
}

async function requestCustomerOtp(email, referralCode = "") {
  const response = await apiFetch("/api/customer-auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, referralCode }),
  }, { expectJson: true });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Kode belum dapat dikirim.");
  return data;
}

async function verifyCustomerOtp({ email, challengeId, code }) {
  window.dispatchEvent(new Event("mg:customer-auth-request"));
  const firebaseAuthPromise = loadFirebaseAuthModule();
  const response = await apiFetch("/api/customer-auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, challengeId, code }),
  }, { expectJson: true });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Kode tidak dapat diverifikasi.");
  const { signInCustomerWithToken } = await firebaseAuthPromise;
  await signInCustomerWithToken(data.customToken);
  return data;
}

async function customerAuthorizationHeader() {
  const { auth } = await loadFirebaseAuthModule();
  if (!auth.currentUser) return {};
  const token = await auth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function loadCustomerAccount({ force = false } = {}) {
  const { auth } = await loadFirebaseAuthModule();
  const currentUser = auth.currentUser;
  const uid = currentUser?.uid || "";
  const now = Date.now();

  if (!force && accountCache?.uid === uid && now - accountCache.savedAt < ACCOUNT_CACHE_TTL_MS) {
    return accountCache.data;
  }
  if (accountRequest?.uid === uid) return accountRequest.promise;

  const promise = (async () => {
    const headers = currentUser
      ? { Authorization: `Bearer ${await currentUser.getIdToken()}` }
      : {};
    const response = await apiFetch("/api/customer/account", { headers }, { expectJson: true });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "Akun tidak dapat dimuat.");
    accountCache = { uid, savedAt: Date.now(), data };
    return data;
  })().finally(() => {
    if (accountRequest?.promise === promise) accountRequest = null;
  });

  accountRequest = { uid, promise };
  return promise;
}

async function saveCustomerAddresses(addresses) {
  const headers = await customerAuthorizationHeader();
  const response = await apiFetch("/api/customer/account/addresses", {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ addresses }),
  }, { expectJson: true });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Alamat tidak dapat disimpan.");
  accountCache = null;
  return data.addresses || [];
}

function invalidateCustomerAccountCache() {
  accountCache = null;
}

export {
  preloadCustomerAuth,
  requestCustomerOtp,
  verifyCustomerOtp,
  customerAuthorizationHeader,
  loadCustomerAccount,
  saveCustomerAddresses,
  invalidateCustomerAccountCache,
};
