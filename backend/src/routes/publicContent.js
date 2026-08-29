import { Router } from "express";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { log } from "../services/logger.js";
import { trackFunnelEvent } from "../services/funnelAnalytics.js";

const router = Router();
const publicContentCache = new Map();

function readPublicCache(key, request) {
  const requestCacheControl = String(request.get("cache-control") || "").toLowerCase();
  if (requestCacheControl.includes("no-cache") || requestCacheControl.includes("no-store")) {
    return null;
  }
  const cached = publicContentCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    publicContentCache.delete(key);
    return null;
  }
  return cached.value;
}

function writePublicCache(key, value, ttlMs) {
  publicContentCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function setPublicCacheHeaders(res, maxAge, staleWhileRevalidate) {
  res.setHeader(
    "Cache-Control",
    `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  );
}

// Public product list. Endpoint ini juga menjadi sumber page-view funnel.
// Frontend lama yang masih membaca Firestore langsung tetap tidak terganggu.
router.get("/api/products", async (req, res) => {
  try {
    const cached = readPublicCache("products", req);
    if (cached) {
      trackFunnelEvent("pageView").catch(() => {});
      setPublicCacheHeaders(res, 60, 300);
      res.setHeader("X-Morgen-Cache", "HIT");
      return res.status(200).json({ products: cached });
    }

    const db = getAdminDb();
    const snapshot = await db.collection("products").limit(200).get();
    const products = snapshot.docs
      .map((document) => ({
        id: document.id,
        ...document.data(),
      }))
      .filter((product) => product.isArchived !== true)
      .sort((a, b) => {
        const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : 999999;
        const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : 999999;
        return orderA - orderB || String(a.name || "").localeCompare(String(b.name || ""));
      });

    trackFunnelEvent("pageView").catch(() => {});
    writePublicCache("products", products, 60_000);
    setPublicCacheHeaders(res, 60, 300);
    res.setHeader("X-Morgen-Cache", "MISS");
    return res.status(200).json({ products });
  } catch (error) {
    log("error", "public-content", "fetch public products failed", {
      error: error.message,
    });
    return res.status(500).json({ error: "Gagal mengambil produk." });
  }
});

function toTimestamp(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value?._seconds === "number") return value._seconds * 1000;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isPublicBlog(post) {
  const status = String(post?.status || "published").toLowerCase();
  return (
    post?.isArchived !== true &&
    post?.draft !== true &&
    status !== "draft" &&
    status !== "archived"
  );
}

function serializeBlog(document) {
  const post = { id: document.id, ...document.data() };
  const timestamp = toTimestamp(post.date || post.publishedAt || post.createdAt);

  return {
    ...post,
    id: document.id,
    date:
      typeof post.date === "string"
        ? post.date
        : timestamp
          ? new Date(timestamp).toISOString()
          : "",
    createdAt: toTimestamp(post.createdAt) || null,
    updatedAt: toTimestamp(post.updatedAt) || null,
  };
}

function isPublicReview(review) {
  const status = String(review?.status || "published").toLowerCase();
  return status === "approved" || status === "published";
}

function serializeReview(document) {
  const review = { id: document.id, ...document.data() };
  return {
    id: review.id,
    nama: String(review.nama || ""),
    produk: String(review.produk || ""),
    rating: Math.min(5, Math.max(1, Number(review.rating || 5))),
    komentar: String(review.komentar || ""),
    photoUrl: String(review.photoUrl || ""),
    photoDataUrl: String(review.photoDataUrl || ""),
    verifiedPurchase: review.verifiedPurchase === true,
    helpfulCount: Math.max(0, Number(review.helpfulCount || 0)),
    featured: review.featured === true,
    status: String(review.status || "published"),
    createdAt: toTimestamp(review.createdAt) || null,
  };
}

function isExpired(coupon) {
  if (!coupon?.expiresAt) return false;
  const timestamp = toTimestamp(coupon.expiresAt);
  return timestamp > 0 && timestamp < Date.now();
}

function serializeCoupon(document) {
  const data = document.data();
  return {
    code: document.id,
    type: data.type === "fixed" ? "fixed" : "percent",
    value: Math.max(0, Number(data.value || 0)),
    minOrder: Math.max(0, Number(data.minOrder || 0)),
    desc: String(data.desc || ""),
    label: String(data.label || ""),
    expiresAt: data.expiresAt || null,
    singleUse: data.singleUse === true,
    translations:
      data.translations && typeof data.translations === "object"
        ? data.translations
        : undefined,
  };
}

// Public reviews shown on the storefront. Legacy reviews without an explicit
// status are treated as published because they were already visible before the
// admin API migration.
router.get("/api/testimoni", async (req, res) => {
  try {
    const cached = readPublicCache("reviews", req);
    if (cached) {
      setPublicCacheHeaders(res, 30, 120);
      res.setHeader("X-Morgen-Route", "public-content-v4");
      res.setHeader("X-Morgen-Count", String(cached.length));
      res.setHeader("X-Morgen-Cache", "HIT");
      return res.status(200).json({ reviews: cached });
    }

    const db = getAdminDb();
    const snapshot = await db.collection("testimoni").limit(200).get();
    const reviews = snapshot.docs
      .filter((document) => isPublicReview(document.data()))
      .map(serializeReview)
      .sort((a, b) => {
        const featuredOrder = Number(b.featured) - Number(a.featured);
        return featuredOrder || Number(b.createdAt || 0) - Number(a.createdAt || 0);
      })
      .slice(0, 100);

    writePublicCache("reviews", reviews, 30_000);
    setPublicCacheHeaders(res, 30, 120);
    res.setHeader("X-Morgen-Route", "public-content-v4");
    res.setHeader("X-Morgen-Count", String(reviews.length));
    res.setHeader("X-Morgen-Cache", "MISS");
    return res.status(200).json({ reviews });
  } catch (error) {
    log("error", "public-content", "fetch public reviews failed", {
      error: error.message,
    });
    return res.status(500).json({ error: "Gagal mengambil ulasan." });
  }
});

// Public promotions shown on the storefront. Old coupons without `isPublic`
// remain visible; only an explicit `isPublic: false` keeps a code private.
router.get("/api/promotions", async (req, res) => {
  try {
    const cached = readPublicCache("promotions", req);
    if (cached) {
      setPublicCacheHeaders(res, 30, 120);
      res.setHeader("X-Morgen-Route", "public-content-v4");
      res.setHeader("X-Morgen-Count", String(cached.length));
      res.setHeader("X-Morgen-Cache", "HIT");
      return res.status(200).json({ coupons: cached });
    }

    const db = getAdminDb();
    const snapshot = await db.collection("coupons").limit(100).get();
    const coupons = snapshot.docs
      .filter((document) => {
        const data = document.data();
        return data.active !== false && data.isPublic !== false && !isExpired(data);
      })
      .map(serializeCoupon);

    writePublicCache("promotions", coupons, 30_000);
    setPublicCacheHeaders(res, 30, 120);
    res.setHeader("X-Morgen-Route", "public-content-v4");
    res.setHeader("X-Morgen-Count", String(coupons.length));
    res.setHeader("X-Morgen-Cache", "MISS");
    return res.status(200).json({ coupons });
  } catch (error) {
    log("error", "public-content", "fetch public promotions failed", {
      error: error.message,
    });
    return res.status(500).json({ error: "Gagal mengambil promo." });
  }
});

// Public article list. Keeping this on the backend avoids loading the full
// Firestore browser SDK on every storefront visit.
router.get("/api/blogs", async (req, res) => {
  try {
    const cached = readPublicCache("blogs", req);
    if (cached) {
      setPublicCacheHeaders(res, 60, 300);
      res.setHeader("X-Morgen-Route", "public-content-v4");
      res.setHeader("X-Morgen-Count", String(cached.length));
      res.setHeader("X-Morgen-Cache", "HIT");
      return res.status(200).json({ posts: cached });
    }

    const db = getAdminDb();
    const snapshot = await db.collection("blogs").limit(200).get();
    const posts = snapshot.docs
      .filter((document) => isPublicBlog(document.data()))
      .map(serializeBlog)
      .sort((a, b) => {
        const timeA = toTimestamp(a.date || a.createdAt);
        const timeB = toTimestamp(b.date || b.createdAt);
        return timeB - timeA || String(a.id).localeCompare(String(b.id));
      });

    writePublicCache("blogs", posts, 60_000);
    setPublicCacheHeaders(res, 60, 300);
    res.setHeader("X-Morgen-Route", "public-content-v4");
    res.setHeader("X-Morgen-Count", String(posts.length));
    res.setHeader("X-Morgen-Cache", "MISS");
    return res.status(200).json({ posts });
  } catch (error) {
    log("error", "public-content", "fetch public blogs failed", {
      error: error.message,
    });
    return res.status(500).json({ error: "Gagal mengambil artikel." });
  }
});

export default router;
export { isPublicBlog, serializeBlog };
