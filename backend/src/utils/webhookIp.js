// utils/webhookIp.js
// Helper murni untuk validasi IP webhook terhadap daftar CIDR/IP.
// Dipisah dari routes/checkout.js agar bisa diuji tanpa memuat seluruh route.

/**
 * Parse notasi CIDR ke { networkInt, maskInt }. Mendukung IP tunggal (dianggap
 * /32). Mengembalikan null jika format tidak valid.
 */
export function parseCidr(cidr) {
  const [ipStr, prefixStr] = String(cidr || "").split("/");
  const prefix = prefixStr ? parseInt(prefixStr, 10) : 32;
  const parts = String(ipStr || "").split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => p < 0 || p > 255 || !Number.isFinite(p))) return null;
  if (prefix < 0 || prefix > 32) return null;
  const ipInt = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  const maskInt = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return { networkInt: (ipInt & maskInt) >>> 0, maskInt };
}

/** True jika `ip` cocok dengan salah satu CIDR yang sudah di-parse. */
export function ipMatchesCidrs(ip, parsedCidrs) {
  if (!Array.isArray(parsedCidrs) || parsedCidrs.length === 0) return false;
  const normalizedIp = String(ip || "").replace(/^::ffff:/, "");
  const parts = normalizedIp.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => p < 0 || p > 255 || !Number.isFinite(p))) return false;
  const ipInt = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  return parsedCidrs.some(({ networkInt, maskInt }) => ((ipInt & maskInt) >>> 0) === networkInt);
}
