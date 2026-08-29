const REFERRAL_PATTERN = /^MG[A-F0-9]{8}$/;
const REFERRAL_STORAGE_KEY = "mg_pending_referral";

function normalizeReferralCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

function isValidReferralCode(value) {
  return REFERRAL_PATTERN.test(normalizeReferralCode(value));
}

function getReferralCodeFromSearch(search) {
  const code = normalizeReferralCode(new URLSearchParams(String(search || "")).get("ref"));
  return isValidReferralCode(code) ? code : "";
}

function readPendingReferralCode() {
  try {
    const code = normalizeReferralCode(window.sessionStorage.getItem(REFERRAL_STORAGE_KEY));
    return isValidReferralCode(code) ? code : "";
  } catch {
    return "";
  }
}

function savePendingReferralCode(value) {
  const code = normalizeReferralCode(value);
  if (!isValidReferralCode(code)) return "";
  try { window.sessionStorage.setItem(REFERRAL_STORAGE_KEY, code); } catch {}
  return code;
}

function clearPendingReferralCode() {
  try { window.sessionStorage.removeItem(REFERRAL_STORAGE_KEY); } catch {}
}

function buildReferralUrl(origin, homePath, referralCode) {
  const code = normalizeReferralCode(referralCode);
  if (!isValidReferralCode(code)) return "";
  const url = new URL(homePath || "/", origin);
  url.searchParams.set("ref", code);
  return url.toString();
}

export {
  buildReferralUrl,
  clearPendingReferralCode,
  getReferralCodeFromSearch,
  isValidReferralCode,
  normalizeReferralCode,
  readPendingReferralCode,
  savePendingReferralCode,
};
