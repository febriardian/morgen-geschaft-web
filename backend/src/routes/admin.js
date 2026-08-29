// routes/admin.js
// Upload, testimoni, push notifications, notification center

import { Router } from "express";
import multer from "multer";
import path from "path";
import { log } from "../services/logger.js";
import { moderateReviewPhoto } from "../services/photoModeration.js";
import fs from "fs";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { verifyAdmin, hasValidAdminToken } from "../middleware/auth.js";
import { rateLimit, reviewPhotoRateLimit, reviewSubmitRateLimit, reviewHelpfulRateLimit } from "../middleware/rateLimiter.js";
import { sanitizeText } from "../utils/index.js";
import { isValidReviewPhotoDataUrl } from "../utils/security.js";
import { verifyOpaqueToken } from "../utils/customerSecurity.js";
import { sniffImageType } from "../utils/imageType.js";
import { saveNotification } from "../services/notifications.js";
import {
  isAllowedUploadedImageUrl,
  uploadImageWithFallback,
} from "../services/imageCdn.js";

const router = Router();

function reviewTimestamp(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value?._seconds === "number") return value._seconds * 1000;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isPublicReview(review) {
  const status = String(review?.status || "published").toLowerCase();
  return status === "approved" || status === "published";
}

// Upload setup
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Ekstensi ditentukan dari MIME yang di-whitelist, BUKAN dari nama file yang
// dikirim client. Ini mencegah nama seperti `x.php`/`x.svg` tersimpan ke disk.
const MIME_TO_EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype] || ".bin";
      const base = path
        .basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 60) || "img";
      cb(null, `${Date.now()}_${base}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) cb(null, true);
    else cb(new Error("Format harus JPG, PNG, atau WebP."));
  },
});

// Middleware pasca-upload: verifikasi isi file benar-benar gambar. Jika bukan,
// hapus file dari disk dan tolak. Dipasang setelah `upload.single(...)`.
function verifyUploadedImage(req, res, next) {
  if (!req.file) return next();
  let fd;
  try {
    fd = fs.openSync(req.file.path, "r");
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    const detected = sniffImageType(buf);
    if (!detected) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "File bukan gambar yang valid (JPG, PNG, atau WebP)." });
    }
    return next();
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    log("error", "upload", "Gagal memverifikasi gambar", { error: err.message });
    return res.status(400).json({ error: "Gagal memverifikasi file." });
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

async function moderateUploadedReviewPhoto(req, res, next) {
  if (!req.file) return next();

  try {
    const buffer = await fs.promises.readFile(req.file.path);
    const mimeType = req.file.mimetype || "image/jpeg";
    const imageDataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    const moderation = await moderateReviewPhoto(imageDataUrl);

    if (!moderation.safe) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      log("warn", "admin", "Uploaded review photo rejected by moderation", {
        reason: moderation.reason || "unsafe",
      });
      return res.status(400).json({ error: "Foto ulasan tidak lolos moderasi." });
    }

    return next();
  } catch (error) {
    log("warn", "admin", "Review photo moderation skipped after read failure", {
      error: error.message,
    });
    return next();
  }
}

// POST /api/upload — admin image upload
router.post("/api/upload", verifyAdmin, upload.single("image"), verifyUploadedImage, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Tidak ada file." });
  const stored = await uploadImageWithFallback(req.file, {
    folder: "admin",
    tags: ["morgen-geschaft", "admin-upload"],
  });
  return res.status(200).json({
    url: stored.url,
    filename: stored.filename,
    storage: stored.storage,
    publicId: stored.publicId,
  });
});


// Public review listing is handled only by routes/publicContent.js.

// POST /api/testimoni/photo — public review image upload with strict limits
router.post("/api/testimoni/photo", reviewPhotoRateLimit, upload.single("image"), verifyUploadedImage, moderateUploadedReviewPhoto, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Tidak ada foto yang diunggah." });
  const stored = await uploadImageWithFallback(req.file, {
    folder: "reviews",
    tags: ["morgen-geschaft", "review-photo"],
  });
  return res.status(200).json({ url: stored.url, storage: stored.storage });
});

// POST /api/testimoni
router.post("/api/testimoni", reviewSubmitRateLimit, async (req, res) => {
  try {
    const { nama, produk, rating, komentar, photoDataUrl, photoUrl } = req.body;
    if (!nama || typeof nama !== "string" || nama.trim().length < 2 || nama.trim().length > 100) return res.status(400).json({ error: "Nama harus 2-100 karakter." });
    if (!komentar || typeof komentar !== "string" || komentar.trim().length < 10 || komentar.trim().length > 1000) return res.status(400).json({ error: "Ulasan harus 10-1000 karakter." });
    const sanitizedRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));
    const urlCount = (komentar.match(/https?:\/\//g) || []).length;
    if (urlCount > 1) return res.status(400).json({ error: "Ulasan tidak boleh mengandung banyak link." });
    if (/(.)\\1{9,}/.test(komentar)) return res.status(400).json({ error: "Ulasan tidak valid." });

    const cleanNama = sanitizeText(nama, 100);
    const cleanKomentar = sanitizeText(komentar, 1000);
    const cleanProduk = sanitizeText(produk || "", 200);

    let cleanPhotoDataUrl = "";
    if (photoDataUrl) {
      if (typeof photoDataUrl !== "string") return res.status(400).json({ error: "Format foto ulasan tidak valid." });
      if (!isValidReviewPhotoDataUrl(photoDataUrl)) return res.status(400).json({ error: "Foto ulasan tidak valid atau terlalu besar." });
      cleanPhotoDataUrl = photoDataUrl;
    }
    const cleanPhotoUrl = typeof photoUrl === "string" && isAllowedUploadedImageUrl(photoUrl)
      ? photoUrl
      : "";

    if (cleanPhotoDataUrl) {
      const moderation = await moderateReviewPhoto(cleanPhotoDataUrl);
      if (!moderation.safe) {
        log("warn", "admin", "Review photo rejected by moderation", {
          reason: moderation.reason || "unsafe",
        });
        return res.status(400).json({ error: "Foto ulasan tidak lolos moderasi." });
      }
    }

    const db = getAdminDb();
    const docRef = await db.collection("testimoni").add({
      nama: cleanNama, produk: cleanProduk, rating: sanitizedRating, komentar: cleanKomentar,
      photoDataUrl: cleanPhotoDataUrl, photoUrl: cleanPhotoUrl, verifiedPurchase: false, helpfulCount: 0, status: "pending",
      createdAt: Date.now(), ip: req.ip || req.connection?.remoteAddress || "",
    });

    saveNotification(
      `Ulasan baru dari ${cleanNama}`,
      `★${sanitizedRating} — "${cleanKomentar.slice(0, 80)}${cleanKomentar.length > 80 ? "..." : ""}"`,
      "/#testimoni", "ulasan"
    );

    return res.status(200).json({
      id: docRef.id, nama: cleanNama, produk: cleanProduk, rating: sanitizedRating,
      komentar: cleanKomentar, photoDataUrl: cleanPhotoDataUrl, photoUrl: cleanPhotoUrl, createdAt: Date.now(),
    });
  } catch (err) { log("error", "admin", "testimoni error", { error: err.message }); return res.status(500).json({ error: "Gagal menyimpan ulasan." }); }
});

// POST /api/testimoni/:id/helpful
router.post("/api/testimoni/:id/helpful", reviewHelpfulRateLimit, async (req, res) => {
  try {
    const reviewId = String(req.params.id || "").trim();
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(reviewId)) return res.status(400).json({ error: "ID ulasan tidak valid." });
    const delta = req.body?.helpful === false ? -1 : 1;
    const db = getAdminDb();
    const reviewRef = db.collection("testimoni").doc(reviewId);
    const helpfulCount = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reviewRef);
      if (!snapshot.exists) throw new Error("REVIEW_NOT_FOUND");
      const current = Number(snapshot.data()?.helpfulCount || 0);
      const next = Math.max(0, current + delta);
      transaction.update(reviewRef, { helpfulCount: next });
      return next;
    });
    return res.status(200).json({ helpfulCount });
  } catch (err) {
    if (err.message === "REVIEW_NOT_FOUND") return res.status(404).json({ error: "Ulasan tidak ditemukan." });
    log("error", "admin", "review helpful error", { error: err.message }); return res.status(500).json({ error: "Gagal menyimpan respons ulasan." });
  }
});

// Push notifications
let webpush = null;
try {
  webpush = (await import("web-push")).default;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails("mailto:morgengeschaft@gmail.com", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  } else { webpush = null; }
} catch { /* web-push not installed */ }

router.post("/api/push/subscribe", rateLimit, async (req, res) => {
  try {
    const { subscription, locale } = req.body;
    if (!subscription || !subscription.endpoint) return res.status(400).json({ error: "Subscription data tidak valid." });
    const db = getAdminDb();
    const id = Buffer.from(subscription.endpoint).toString("base64url").slice(0, 100);
    await db.collection("push_subscriptions").doc(id).set({
      ...subscription,
      locale: locale === "en" ? "en" : "id",
      createdAt: new Date().toISOString(),
    }, { merge: true });
    return res.status(200).json({ message: "Subscribed." });
  } catch (err) { log("error", "admin", "push subscribe error", { error: err.message }); return res.status(500).json({ error: "Gagal menyimpan subscription." }); }
});

router.post("/api/push/broadcast", verifyAdmin, async (req, res) => {
  if (!webpush) return res.status(503).json({ error: "Web Push belum dikonfigurasi." });
  try {
    const { title, body, url, titleEn, bodyEn, urlEn } = req.body;
    if (!title || !body) return res.status(400).json({ error: "Title dan body wajib diisi." });
    const db = getAdminDb();
    const snap = await db.collection("push_subscriptions").get();
    let sent = 0, failed = 0;
    const stale = [];
    for (const doc of snap.docs) {
      const subscription = doc.data();
      const useEnglish = subscription.locale === "en";
      const payload = JSON.stringify({
        title: useEnglish && titleEn ? titleEn : title,
        body: useEnglish && bodyEn ? bodyEn : body,
        url: useEnglish ? (urlEn || "/en") : (url || "/id"),
      });
      try { await webpush.sendNotification(subscription, payload); sent++; }
      catch (err) { failed++; if (err.statusCode === 410 || err.statusCode === 404) stale.push(doc.id); }
    }
    for (const id of stale) await db.collection("push_subscriptions").doc(id).delete();
    await saveNotification(title, body, url || "/id", "broadcast", null, {
      titleEn,
      bodyEn,
      urlEn: urlEn || "/en",
    });
    return res.status(200).json({ message: `Terkirim: ${sent}, Gagal: ${failed}, Dihapus: ${stale.length}` });
  } catch (err) { log("error", "admin", "push broadcast error", { error: err.message }); return res.status(500).json({ error: "Gagal mengirim broadcast." }); }
});

router.get("/api/push/vapid-key", (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(503).json({ error: "VAPID key belum dikonfigurasi." });
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Notification center
router.get("/api/notifications", rateLimit, async (req, res) => {
  try {
    const includeAllOrders = await hasValidAdminToken(req);
    const db = getAdminDb();
    const snap = await db.collection("notifications").orderBy("sentAt", "desc").limit(50).get();
    const notifications = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((n) => {
        const category = String(n.category || "").toLowerCase();
        const title = String(n.title || "").trim().toLowerCase();
        const isOrderNotification = category === "pesanan" || title.startsWith("pesanan") || title.startsWith("pembayaran");
        if (!isOrderNotification) return true;
        if (includeAllOrders) return true;
        return false;
      });
    res.json({ notifications });
  } catch (err) { log("error", "admin", "fetch notifications error", { error: err.message }); res.status(500).json({ error: "Gagal mengambil notifikasi." }); }
});

router.post("/api/notifications/orders", rateLimit, async (req, res) => {
  try {
    const proofs = Array.isArray(req.body?.orders) ? req.body.orders.slice(0, 10) : [];
    const db = getAdminDb();
    const allowedOrderIds = new Set();
    await Promise.all(proofs.map(async (proof) => {
      const orderId = String(proof?.orderId || "").trim();
      if (!/^MG-[A-Za-z0-9-]{8,64}$/.test(orderId)) return;
      const snapshot = await db.collection("orders").doc(orderId).get();
      if (!snapshot.exists) return;
      const order = snapshot.data();
      if (verifyOpaqueToken(proof?.customerAccessToken, order.customerAccessTokenHash)) {
        allowedOrderIds.add(orderId);
      }
    }));
    const snap = await db.collection("notifications").orderBy("sentAt", "desc").limit(50).get();
    const notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((notification) => {
      const category = String(notification.category || "").toLowerCase();
      const title = String(notification.title || "").trim().toLowerCase();
      const isOrder = category === "pesanan" || title.startsWith("pesanan") || title.startsWith("pembayaran");
      return !isOrder || allowedOrderIds.has(String(notification.orderId || ""));
    });
    return res.status(200).json({ notifications });
  } catch (error) {
    log("error", "admin", "secure notification fetch error", { error: error.message });
    return res.status(500).json({ error: "Gagal mengambil notifikasi." });
  }
});

router.delete("/api/notifications", verifyAdmin, async (req, res) => {
  try {
    const db = getAdminDb();
    const snap = await db.collection("notifications").get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    res.json({ message: "Semua notifikasi dihapus.", deleted: snap.size });
  } catch (err) { log("error", "admin", "clear notifications error", { error: err.message }); res.status(500).json({ error: "Gagal menghapus notifikasi." }); }
});

export { UPLOAD_DIR };
export default router;
