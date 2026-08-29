// utils.js
// Fungsi utilitas murni (pure functions) yang diekstrak dari server.js
// agar bisa diimport langsung oleh test tanpa menyalakan server.

import crypto from "crypto";

/**
 * Strip HTML tags + encode entities untuk prevent XSS.
 *
 * Urutan: encode entities DULU, baru strip residual patterns.
 * Ini mencegah double-encoding (&lt; → &amp;lt;) dan bypass via
 * malformed tags (e.g. `<img src=x onerror=alert(1) ` tanpa closing `>`).
 */
export function sanitizeText(str, maxLength = 1000) {
  if (typeof str !== "string") return "";
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/&/g, "&amp;")             // 1. encode ampersand FIRST
    .replace(/</g, "&lt;")              // 2. encode < (neutralizes ALL tags, including malformed)
    .replace(/>/g, "&gt;")              // 3. encode >
    .replace(/"/g, "&quot;")            // 4. encode double quotes
    .replace(/'/g, "&#x27;")            // 5. encode single quotes
    .replace(/javascript:/gi, "")       // 6. strip JS protocol
    .replace(/on\w+\s*=/gi, "");        // 7. strip inline event handlers
}

/**
 * Hash token pembatalan pesanan oleh customer
 */
export function hashCustomerCancelToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

/**
 * Verifikasi token pembatalan (timing-safe comparison)
 */
export function verifyCustomerCancelToken(token, expectedHash) {
  if (!token || !expectedHash) return false;
  const actual = Buffer.from(hashCustomerCancelToken(token), "hex");
  const expected = Buffer.from(String(expectedHash), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
