// routes/products.js
// Endpoints: update product (admin), stock notifications

import { Router } from "express";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { verifyAdmin } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimiter.js";
import { log } from "../services/logger.js";
import { sendBackInStockEmails } from "../services/email.js";
import { saveNotification } from "../services/notifications.js";
import { invalidatePromptCache } from "../services/gesaPrompt.js";

const router = Router();

// PATCH /api/products/:productId — admin update product + back-in-stock trigger
router.patch("/api/products/:productId", verifyAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const updates = req.body;
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Tidak ada data untuk diupdate." });
    }

    const db = getAdminDb();
    const productRef = db.collection("products").doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) return res.status(404).json({ error: "Produk tidak ditemukan." });

    const oldData = productSnap.data();
    const oldStock = oldData.stock || 0;
    const newStock = updates.stock !== undefined ? updates.stock : oldStock;

    await productRef.update(updates);

    if (oldStock === 0 && newStock > 0) {
      sendBackInStockEmails(productId, oldData.name || productId).catch((err) =>
        log("error", "products", "Back-in-stock trigger error", { error: err.message })
      );
      const productNameId = oldData.name || productId;
      const productNameEn = oldData.nameEn || oldData.translations?.en?.name || productNameId;
      saveNotification(
        `${productNameId} tersedia kembali!`,
        "Stok sudah diperbarui. Segera dapatkan sebelum kehabisan.",
        `/id/produk/${productId}`,
        "produk",
        null,
        {
          titleEn: `${productNameEn} is back in stock!`,
          bodyEn: "Stock has been updated. Get it before it sells out again.",
          urlEn: `/en/product/${productId}`,
        }
      );
    }

    // Invalidate GESA prompt cache
    invalidatePromptCache();

    return res.status(200).json({ message: "Produk diperbarui.", productId });
  } catch (err) {
    log("error", "products", "update-product error", { error: err.message });
    return res.status(500).json({ error: "Gagal memperbarui produk." });
  }
});

// GET /api/stock-notifications — admin view subscribers
router.get("/api/stock-notifications", verifyAdmin, async (req, res) => {
  try {
    const db = getAdminDb();
    const { productId } = req.query;
    const snap = await db.collection("stock_notifications").orderBy("createdAt", "desc").limit(100).get();
    let subs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (productId) subs = subs.filter((s) => s.productId === productId);
    return res.status(200).json({ notifications: subs });
  } catch (err) {
    log("error", "products", "stock-notifications error", { error: err.message });
    return res.status(500).json({ error: "Gagal memuat data." });
  }
});

// POST /api/notify-stock — public subscribe
router.post("/api/notify-stock", rateLimit, async (req, res) => {
  try {
    const { email, productId, productName } = req.body;
    if (!email || !productId) return res.status(400).json({ error: "Email dan produk wajib diisi." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Format email tidak valid." });

    const db = getAdminDb();
    const existing = await db.collection("stock_notifications")
      .where("email", "==", email).where("productId", "==", productId).where("notified", "==", false).get();
    if (!existing.empty) return res.status(200).json({ message: "Kamu sudah terdaftar untuk notifikasi produk ini." });

    await db.collection("stock_notifications").add({
      email, productId, productName: productName || "", notified: false, createdAt: new Date().toISOString(),
    });
    return res.status(200).json({ message: "Kamu akan dinotifikasi saat produk tersedia." });
  } catch (err) {
    log("error", "products", "notify-stock error", { error: err.message });
    return res.status(500).json({ error: "Gagal mendaftarkan notifikasi." });
  }
});

// POST /api/admin/seed — admin: seed initial products & coupons if empty
// Ini menggantikan client-side seed yang sebelumnya ada di useFirestoreData.js.
// Hanya menulis dokumen yang belum ada (merge safe).
router.post("/api/admin/seed", verifyAdmin, async (req, res) => {
  try {
    const db = getAdminDb();
    const { products: seedProducts, coupons: seedCoupons } = req.body;
    const results = { products: { seeded: 0, skipped: 0 }, coupons: { seeded: 0, skipped: 0 } };

    if (Array.isArray(seedProducts)) {
      for (const p of seedProducts) {
        if (!p.id) continue;
        const snap = await db.collection("products").doc(p.id).get();
        if (!snap.exists) {
          await db.collection("products").doc(p.id).set(p);
          results.products.seeded++;
        } else {
          results.products.skipped++;
        }
      }
    }

    if (Array.isArray(seedCoupons)) {
      for (const c of seedCoupons) {
        if (!c.code) continue;
        const snap = await db.collection("coupons").doc(c.code).get();
        if (!snap.exists) {
          await db.collection("coupons").doc(c.code).set(c);
          results.coupons.seeded++;
        } else {
          results.coupons.skipped++;
        }
      }
    }

    // Invalidate GESA prompt cache after seeding
    invalidatePromptCache();

    log("info", "admin", "Seed data completed", results);
    return res.status(200).json({ message: "Seed selesai.", ...results });
  } catch (err) {
    log("error", "admin", "seed error", { error: err.message });
    return res.status(500).json({ error: "Gagal seed data." });
  }
});

export default router;
