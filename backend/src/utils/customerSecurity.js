import crypto from "node:crypto";

const ORDER_ID_PATTERN = /^MG-[A-F0-9]{32}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const REFERRAL_CODE_PATTERN = /^MG[A-F0-9]{8}$/;

function secret(env = process.env) {
  const value = String(env.CUSTOMER_AUTH_SECRET || env.SHIPPING_QUOTE_SECRET || "").trim();
  if (!value) throw new Error("CUSTOMER_AUTH_SECRET belum dikonfigurasi.");
  return value;
}

export function normalizeCustomerEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidCustomerEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeCustomerEmail(value));
}

export function isValidIdempotencyKey(value) {
  return IDEMPOTENCY_KEY_PATTERN.test(String(value || ""));
}

export function normalizeReferralCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function isValidReferralCode(value) {
  return REFERRAL_CODE_PATTERN.test(normalizeReferralCode(value));
}

export function generateSecureOrderId() {
  return `MG-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;
}

export function isSecureOrderId(value) {
  return ORDER_ID_PATTERN.test(String(value || ""));
}

export function hashOpaqueToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

export function deriveCheckoutToken(idempotencyKey, purpose, env = process.env) {
  return crypto
    .createHmac("sha256", secret(env))
    .update(`${purpose}:${String(idempotencyKey || "")}`)
    .digest("base64url");
}

export function verifyOpaqueToken(value, expectedHash) {
  if (!value || !expectedHash) return false;
  const actual = Buffer.from(hashOpaqueToken(value), "hex");
  const expected = Buffer.from(String(expectedHash), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function hashOtp(challengeId, email, code, env = process.env) {
  return crypto
    .createHmac("sha256", secret(env))
    .update(`otp:${challengeId}:${normalizeCustomerEmail(email)}:${String(code || "")}`)
    .digest("hex");
}

export function verifyOtp(challengeId, email, code, expectedHash, env = process.env) {
  if (!expectedHash) return false;
  const actual = Buffer.from(hashOtp(challengeId, email, code, env), "hex");
  const expected = Buffer.from(String(expectedHash), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function createReferralCode(uid, env = process.env) {
  const suffix = crypto
    .createHmac("sha256", secret(env))
    .update(`referral:${uid}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  return `MG${suffix}`;
}
