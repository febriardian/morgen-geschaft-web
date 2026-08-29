// Firebase admin authorization. Production access is based on the
// signed Firebase custom claim { admin: true }.

import { getAdminAuth } from "../config/firebaseAdmin.js";
import { log } from "../services/logger.js";
import { hasAdminClaim, hasAdminMfa } from "../utils/security.js";

function bearerToken(req) {
  const value = String(req.headers.authorization || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function decodeAdmin(req) {
  const token = bearerToken(req);
  if (!token) return null;

  const decoded = await getAdminAuth().verifyIdToken(token, true);
  if (!hasAdminClaim(decoded)) return null;
  if (process.env.REQUIRE_ADMIN_MFA === "true" && !hasAdminMfa(decoded)) {
    const error = new Error("Admin MFA diperlukan.");
    error.code = "ADMIN_MFA_REQUIRED";
    throw error;
  }
  return decoded;
}

export async function decodeFirebaseUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  return getAdminAuth().verifyIdToken(token, true);
}

export async function optionalFirebaseUser(req) {
  try {
    return await decodeFirebaseUser(req);
  } catch {
    return null;
  }
}

export async function optionalCustomerUser(req) {
  const decoded = await optionalFirebaseUser(req);
  return decoded?.customer === true && decoded?.email_verified === true ? decoded : null;
}

export async function verifyCustomer(req, res, next) {
  try {
    const decoded = await decodeFirebaseUser(req);
    if (!decoded?.email || decoded.email_verified !== true || decoded.customer !== true) {
      return res.status(401).json({ error: "Sesi pelanggan tidak valid." });
    }
    req.customer = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: "Sesi pelanggan berakhir. Silakan masuk lagi." });
  }
}

export async function verifyAdmin(req, res, next) {
  try {
    const decoded = await decodeAdmin(req);
    if (!decoded) {
      log("warn", "verify-admin", "Akses admin ditolak", { path: req.path });
      return res.status(403).json({ error: "Akun ini tidak memiliki custom claim admin." });
    }
    req.adminUid = decoded.uid;
    req.adminEmail = decoded.email || "";
    return next();
  } catch (err) {
    log("warn", "verify-admin", "Token admin tidak valid", { error: err.message, path: req.path });
    return res.status(403).json({
      code: err.code === "ADMIN_MFA_REQUIRED" ? "ADMIN_MFA_REQUIRED" : "ADMIN_TOKEN_INVALID",
      error: err.code === "ADMIN_MFA_REQUIRED"
        ? "Verifikasi dua langkah admin wajib diselesaikan."
        : "Token admin tidak valid atau sudah kedaluwarsa.",
    });
  }
}

export async function hasValidAdminToken(req) {
  try {
    return Boolean(await decodeAdmin(req));
  } catch {
    return false;
  }
}
