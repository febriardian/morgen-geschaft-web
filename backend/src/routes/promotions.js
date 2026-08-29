import { Router } from "express";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { rateLimit } from "../middleware/rateLimiter.js";
import { log } from "../services/logger.js";

const router = Router();

function isExpired(coupon) {
  if (!coupon?.expiresAt) return false;
  const expiresAt = new Date(coupon.expiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt < new Date();
}

function publicCoupon(doc) {
  const data = doc.data ? doc.data() : doc;
  const code = doc.id || data.code;
  return {
    code,
    type: data.type === "fixed" ? "fixed" : "percent",
    value: Math.max(0, Number(data.value || 0)),
    minOrder: Math.max(0, Number(data.minOrder || 0)),
    desc: String(data.desc || ""),
    label: String(data.label || ""),
    expiresAt: data.expiresAt || null,
    singleUse: data.singleUse === true,
    translations: data.translations && typeof data.translations === "object" ? data.translations : undefined,
  };
}

// Public promotion listing is handled only by routes/publicContent.js.
router.post("/api/coupons/validate", rateLimit, async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const subtotal = Math.max(0, Number(req.body?.subtotal || 0));
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").replace(/\D/g, "");

    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
      return res.status(400).json({ error: "Kode kupon tidak valid." });
    }

    const db = getAdminDb();
    const snap = await db.collection("coupons").doc(code).get();
    if (!snap.exists) return res.status(404).json({ error: "Kode kupon tidak ditemukan." });

    const data = snap.data();
    if (data.active === false || isExpired(data)) {
      return res.status(400).json({ error: "Kupon sudah tidak berlaku." });
    }
    if (subtotal < Number(data.minOrder || 0)) {
      return res.status(400).json({
        error: `Minimum belanja untuk kupon ini adalah Rp${Number(data.minOrder || 0).toLocaleString("id-ID")}.`,
      });
    }

    if (data.singleUse && (email || phone)) {
      const identifier = email || phone;
      const claimDocId = `${code}__${identifier.replace(/[^a-zA-Z0-9@._-]/g, "_")}`;
      const claim = await db.collection("couponClaims").doc(claimDocId).get();
      if (claim.exists) {
        return res.status(409).json({ error: "Kupon ini sudah pernah digunakan oleh pelanggan ini." });
      }
    }

    const coupon = publicCoupon({ id: code, data: () => data });
    const rawDiscount = coupon.type === "percent"
      ? Math.round(subtotal * coupon.value / 100)
      : coupon.value;
    const discount = Math.min(subtotal, Math.max(0, rawDiscount));

    return res.json({ valid: true, coupon, discount });
  } catch (err) {
    log("error", "promotions", "validate coupon error", { error: err.message });
    return res.status(500).json({ error: "Gagal memvalidasi kupon." });
  }
});

export default router;
