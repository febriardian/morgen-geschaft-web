// server.js
//
// Backend Express.js mandiri — orchestrator yang mengimport semua modul.
// Server ini NYALA TERUS-MENERUS (bukan serverless).
//
// Cara jalanin:
//   npm install
//   node app.js
//
// Lihat .env.example untuk daftar environment variables.

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { getAdminDb } from "./config/firebaseAdmin.js";
import { log } from "./services/logger.js";
import { expirePendingOrders } from "./services/orders.js";
import { persistRateLimiterState } from "./middleware/rateLimiter.js";
import { closeRedisConnection } from "./services/redis.js";
import { requireSSL } from "./middleware/sslRedirect.js";
import { sendAbandonedCartReminders } from "./services/abandonedCart.js";
import { checkAndAlertLowStock } from "./services/stockAlert.js";
import { initSentry, setupSentryErrorHandler } from "./services/sentry.js";
import analyticsRoutes from "./routes/analytics.js";
import { buildContentSecurityPolicyDirectives } from "./config/contentSecurityPolicy.js";

// Routes
import checkoutRoutes from "./routes/checkout.js";
import orderRoutes from "./routes/orders.js";
import productRoutes from "./routes/products.js";
import chatRoutes from "./routes/chat.js";
import shippingRoutes from "./routes/shipping.js";
import biteshipWebhookRoutes from "./routes/biteshipWebhook.js";
import adminRoutes, { UPLOAD_DIR } from "./routes/admin.js";
import seoRoutes from "./routes/seo.js";
import healthRoutes from "./routes/health.js";
import promotionRoutes from "./routes/promotions.js";
import publicContentRoutes from "./routes/publicContent.js";
import returnRoutes from "./routes/returns.js";
import flashSaleRoutes from "./routes/flashSales.js";
import customerAuthRoutes from "./routes/customerAuth.js";
import customerAccountRoutes from "./routes/customerAccount.js";
import featureFlagRoutes from "./routes/featureFlags.js";

await initSentry();

// ---------------------------------------------------------------------------
// STARTUP: Validasi environment variables wajib
// ---------------------------------------------------------------------------
const runtimeIsProduction = process.env.NODE_ENV === "production";
const REQUIRED_ENVS = [
  "MIDTRANS_SERVER_KEY",
  "FIREBASE_SERVICE_ACCOUNT_BASE64",
  "GEMINI_API_KEY",
  "BITESHIP_API_KEY",
  ...(runtimeIsProduction ? ["SHIPPING_QUOTE_SECRET", "CUSTOMER_AUTH_SECRET"] : []),
];
const missingEnvs = REQUIRED_ENVS.filter((key) => !process.env[key]);
if (missingEnvs.length > 0) {
  console.error(`FATAL: Environment variables berikut belum diset: ${missingEnvs.join(", ")}`);
  console.error("Lihat backend/.env.example untuk daftar lengkap.");
  process.exit(1);
}
if (runtimeIsProduction && String(process.env.CUSTOMER_AUTH_SECRET || "").trim().length < 64) {
  throw new Error("CUSTOMER_AUTH_SECRET wajib memakai minimal 64 karakter acak di production.");
}

// Local development may reuse the Midtrans server key as a signing secret so
// the API can boot before a dedicated SHIPPING_QUOTE_SECRET is created.
// Production still requires a separate secret through REQUIRED_ENVS above.
if (!process.env.SHIPPING_QUOTE_SECRET && process.env.MIDTRANS_SERVER_KEY) {
  process.env.SHIPPING_QUOTE_SECRET = process.env.MIDTRANS_SERVER_KEY;
  console.warn("SHIPPING_QUOTE_SECRET belum diisi; fallback lokal memakai MIDTRANS_SERVER_KEY.");
}

const app = express();
const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(SERVER_DIR, "..");
const FRONTEND_BUILD_DIR = path.resolve(BACKEND_ROOT, "public");
const PORT = process.env.PORT || 3002; // FIX #13: match vite proxy

// ---------------------------------------------------------------------------
// TRUST PROXY — wajib jika di belakang reverse proxy (Nginx/Cloudflare)
// Tanpa ini, req.ip akan selalu IP proxy, bukan IP client sebenarnya.
// Set ke angka sesuai jumlah layer proxy, atau 'loopback' untuk localhost proxy.
// ---------------------------------------------------------------------------
const TRUST_PROXY = process.env.TRUST_PROXY || false;
if (TRUST_PROXY) {
  const parsed = /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY;
  app.set("trust proxy", parsed);
  console.log(`trust proxy diset ke: ${parsed}`);
}

// ---------------------------------------------------------------------------
// CONDITIONAL CSP — sandbox URLs hanya di development
// ---------------------------------------------------------------------------
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

// HTTPS enforcement (Midtrans production wajib HTTPS)
app.use(requireSSL);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: buildContentSecurityPolicyDirectives(isProduction),
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((s) => s.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

// Reject wildcard "*" di production — terlalu berbahaya untuk payment/admin endpoints
if (isProduction && ALLOWED_ORIGINS.includes("*")) {
  console.error(
    "FATAL: FRONTEND_URL tidak boleh '*' di production mode (MIDTRANS_IS_PRODUCTION=true)."
  );
  process.exit(1);
}

const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const LOCAL_REQUEST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

app.use(
  cors((req, callback) => {
    const origin = req.get("Origin");
    const requestHost = String(req.hostname || "").toLowerCase();
    const localProxyRequest =
      LOCAL_REQUEST_HOSTS.has(requestHost) && Boolean(origin && LOCAL_ORIGIN_PATTERN.test(origin));
    const allowed =
      !origin ||
      ALLOWED_ORIGINS.includes(origin) ||
      localProxyRequest ||
      (!isProduction && ALLOWED_ORIGINS.includes("*"));

    callback(null, {
      origin: allowed,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Customer-Access-Token"],
      credentials: true,
    });
  })
);

// Body parser khusus harus dipasang sebelum parser default. Jika parser 10kb
// dipasang lebih dulu, request admin berukuran besar akan ditolak sebelum
// mencapai batas route-specific.
app.use("/api/create-transaction", express.json({ limit: "50kb" }));
app.use("/api/admin", express.json({ limit: "1mb" }));
app.use("/api/testimoni", express.json({ limit: "700kb" }));
app.use("/api/validate-stock", express.json({ limit: "20kb" }));
app.use(express.json({ limit: "10kb" }));

// ---------------------------------------------------------------------------
// REQUEST ID — setiap request dapat unique ID untuk tracing
// ---------------------------------------------------------------------------
import crypto from "crypto";
app.use((req, _res, next) => {
  req.requestId = req.headers["x-request-id"] || crypto.randomBytes(8).toString("hex");
  _res.setHeader("X-Request-ID", req.requestId);
  next();
});

// ---------------------------------------------------------------------------
// REQUEST LOGGING
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path === "/api/health" || req.path.startsWith("/uploads/")) return;
    log(
      res.statusCode >= 400 ? "warn" : "info",
      "http",
      `${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
      { ip: req.ip, status: res.statusCode, ms: duration, rid: req.requestId }
    );
  });
  const originalEnd = res.end;
  res.end = function instrumentedEnd(...args) {
    if (!res.headersSent) {
      const duration = Math.max(0, Date.now() - start);
      res.setHeader("Server-Timing", `app;dur=${duration}`);
    }
    return originalEnd.apply(this, args);
  };
  next();
});

// ---------------------------------------------------------------------------
// STATIC FILES (uploaded images)
// ---------------------------------------------------------------------------
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    maxAge: process.env.NODE_ENV === "production" ? "30d" : 0,
    immutable: process.env.NODE_ENV === "production",
  })
);

// ---------------------------------------------------------------------------
// LOCAL/DEPLOYMENT DIAGNOSTIC
// Confirms which backend process is actually serving port 3002.
// ---------------------------------------------------------------------------
app.get("/api/_version", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    build: "security-commerce-platform-v5",
    entry: "backend/app.js",
    publicRoutes: [
      "/api/testimoni",
      "/api/promotions",
      "/api/blogs",
      "/api/biteship-webhook",
      "/api/returns",
      "/api/flash-sales/current",
    ],
  });
});

// ---------------------------------------------------------------------------
// MOUNT ROUTES
// ---------------------------------------------------------------------------
app.use(checkoutRoutes);
app.use(customerAuthRoutes);
app.use(customerAccountRoutes);
app.use(featureFlagRoutes);
app.use(orderRoutes);
app.use(returnRoutes);
app.use(flashSaleRoutes);
app.use(productRoutes);
app.use(publicContentRoutes);
app.use(promotionRoutes);
app.use(chatRoutes);
app.use(shippingRoutes);
app.use(biteshipWebhookRoutes);
app.use(adminRoutes);
app.use(seoRoutes);
app.use(healthRoutes);
app.use(analyticsRoutes);

// ---------------------------------------------------------------------------
// PRODUCTION FRONTEND — one-domain deployment for cPanel/Rumahweb
// `npm run build:hosting` copies frontend/dist into backend/public.
// ---------------------------------------------------------------------------
const serveFrontend =
  process.env.SERVE_FRONTEND !== "false" &&
  fs.existsSync(path.join(FRONTEND_BUILD_DIR, "index.html"));
if (serveFrontend) {
  const frontendIndexTemplate = fs.readFileSync(
    path.join(FRONTEND_BUILD_DIR, "index.html"),
    "utf8"
  );
  const publicSiteOrigin = String(process.env.PUBLIC_SITE_URL || "https://morgengeschaft.com")
    .trim()
    .replace(/\/$/, "");

  const localizedFrontendHtml = (pathname) => {
    const isEnglish = pathname === "/en" || pathname.startsWith("/en/");
    const canonical = new URL(pathname === "/" ? "/id" : pathname, publicSiteOrigin).href;
    const title = isEnglish
      ? "Morgen Geschäft — Clearly Labelled Skincare"
      : "Morgen Geschäft — Skincare yang Ditandai Seperti Resep";
    const description = isEnglish
      ? "Shop skincare with clearly labelled active ingredients and skin-type guidance."
      : "Belanja skincare dengan label bahan aktif dan panduan jenis kulit yang jelas.";

    return frontendIndexTemplate
      .replace(/<html lang="[^"]*">/i, `<html lang="${isEnglish ? "en" : "id"}">`)
      .replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
      .replace(
        /<link rel="canonical" href="[^"]*"\s*\/?>/i,
        `<link rel="canonical" href="${canonical}" />`
      )
      .replace(
        /<meta name="description" content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${description}" />`
      )
      .replace(
        /<meta property="og:title" content="[^"]*"\s*\/?>/i,
        `<meta property="og:title" content="${title}" />`
      )
      .replace(
        /<meta property="og:description" content="[^"]*"\s*\/?>/i,
        `<meta property="og:description" content="${description}" />`
      )
      .replace(
        /<meta property="og:url" content="[^"]*"\s*\/?>/i,
        `<meta property="og:url" content="${canonical}" />`
      )
      .replace(
        /<meta name="twitter:title" content="[^"]*"\s*\/?>/i,
        `<meta name="twitter:title" content="${title}" />`
      )
      .replace(
        /<meta name="twitter:description" content="[^"]*"\s*\/?>/i,
        `<meta name="twitter:description" content="${description}" />`
      );
  };

  app.use(
    express.static(FRONTEND_BUILD_DIR, {
      index: false,
      maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
      setHeaders(response, filePath) {
        if (filePath.endsWith("service-worker.js") || filePath.endsWith("manifest.json")) {
          response.setHeader("Cache-Control", "no-cache");
          return;
        }
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }
        if (/\.(?:avif|webp|png|jpe?g|gif|svg|woff2?)$/i.test(filePath)) {
          response.setHeader(
            "Cache-Control",
            "public, max-age=2592000, stale-while-revalidate=86400"
          );
        }
      },
    })
  );

  const knownFrontendPath = (pathname) => {
    if (["/", "/id", "/en"].includes(pathname)) return true;
    const parts = String(pathname || "").split("/").filter(Boolean);
    if (!['id', 'en'].includes(parts[0])) return false;
    const isEnglish = parts[0] === "en";
    const fixedPages = new Set(isEnglish
      ? ["catalog", "reviews", "faq", "skin-type-quiz", "articles", "privacy-policy", "terms-and-conditions", "install"]
      : ["katalog", "ulasan", "faq", "kuis-tipe-kulit", "artikel", "kebijakan-privasi", "syarat-ketentuan", "install"]);
    if (parts.length === 2) return fixedPages.has(parts[1]);
    if (parts.length === 3 && parts[1] === (isEnglish ? "product" : "produk")) return true;
    if (parts.length === 3 && parts[1] === (isEnglish ? "catalog" : "katalog")) {
      const categories = new Set(isEnglish
        ? ["face-wash", "body-wash", "sunscreen", "serum", "bundles"]
        : ["face-wash", "body-wash", "sunscreen", "serum", "bundle"]);
      return categories.has(parts[2]);
    }
    if (parts.length === 3 && parts[1] === (isEnglish ? "articles" : "artikel")) return true;
    if (parts.length === 4 && parts[1] === (isEnglish ? "articles" : "artikel") && parts[2] === (isEnglish ? "category" : "kategori")) {
      const categories = new Set(isEnglish
        ? ["skincare-guides", "active-ingredients", "daily-care", "product-news"]
        : ["panduan-skincare", "bahan-aktif", "perawatan-harian", "berita-produk"]);
      return categories.has(parts[3]);
    }
    return false;
  };

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return next();
    if (!req.accepts("html")) return next();
    if (!knownFrontendPath(req.path)) {
      return res.status(404).type("html").send("<!doctype html><html lang=\"id\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex\"><title>404 — Morgen Geschäft</title></head><body><main><h1>Halaman tidak ditemukan</h1><p><a href=\"/id\">Kembali ke Morgen Geschäft</a></p></main></body></html>");
    }
    // `no-cache` allows safe browser storage/revalidation and back-forward
    // cache restoration. `no-transform` also prevents Cloudflare from injecting
    // its RUM beacon into HTML when privacy extensions would block it.
    res.setHeader("Cache-Control", "private, no-cache, must-revalidate, no-transform");
    return res.status(200).type("html").send(localizedFrontendHtml(req.path));
  });
}

// ---------------------------------------------------------------------------
// ERROR HANDLERS (HARUS setelah routes agar bisa menangkap error dari routes)
// ---------------------------------------------------------------------------
import multer from "multer";

// Multer-specific errors (file upload)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ error: "Ukuran file maks 2MB." });
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes("Format harus")) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// Global catch-all error handler — mencegah Express mengirim HTML stack trace
setupSentryErrorHandler(app);
app.use((err, req, res, _next) => {
  log("error", "unhandled", err.message, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    rid: req.requestId,
  });
  res.status(500).json({ error: "Terjadi kesalahan server." });
});

// ---------------------------------------------------------------------------
// PERIODIC TASKS
// ---------------------------------------------------------------------------
// PM2 memberi NODE_APP_INSTANCE pada setiap worker cluster ("0", "1", dst.).
// Jalankan tugas terjadwal hanya pada worker utama agar tidak dieksekusi ganda.
const isPrimaryWorker =
  process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === "0";

if (isPrimaryWorker) {
  setInterval(
    async () => {
      try {
        const db = getAdminDb();
        const count = await expirePendingOrders(db);

        if (count > 0) {
          log("info", "cron", `Expired ${count} pending orders`);
        }
      } catch (err) {
        log("error", "cron", "expirePendingOrders failed", {
          error: err.message,
        });
      }
    },
    5 * 60 * 1000
  );

  // Abandoned cart reminders — setiap 10 menit
  setInterval(
    async () => {
      try {
        const count = await sendAbandonedCartReminders();
        if (count > 0) log("info", "cron", `Sent ${count} abandoned cart reminders`);
      } catch (err) {
        log("error", "cron", "abandonedCartReminders failed", { error: err.message });
      }
    },
    10 * 60 * 1000
  );

  // Low stock alerts — setiap 30 menit
  setInterval(
    async () => {
      try {
        await checkAndAlertLowStock();
      } catch (err) {
        log("error", "cron", "checkAndAlertLowStock failed", { error: err.message });
      }
    },
    30 * 60 * 1000
  );

  log("info", "cron", "Abandoned cart + stock alert crons aktif");

  log("info", "cron", "Periodic order expiration aktif pada worker utama", {
    nodeAppInstance: process.env.NODE_APP_INSTANCE ?? "standalone",
  });
} else {
  log("info", "cron", "Periodic order expiration dilewati pada worker sekunder", {
    nodeAppInstance: process.env.NODE_APP_INSTANCE,
  });
}

// ---------------------------------------------------------------------------
// START SERVER
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  log("info", "server", `Server jalan di port ${PORT}`);
});

// ---------------------------------------------------------------------------
// GRACEFUL SHUTDOWN
// ---------------------------------------------------------------------------
let shutdownStarted = false;

function gracefulShutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;

  log("info", "server", `${signal} diterima, mulai graceful shutdown...`);

  // Persist hanya state fallback lokal; state Redis tersimpan secara shared.
  persistRateLimiterState();

  server.close(async () => {
    await closeRedisConnection();
    log("info", "server", "Semua koneksi ditutup, proses selesai.");
    process.exit(0);
  });

  setTimeout(async () => {
    log("warn", "server", "Graceful shutdown timeout, force exit.");
    await closeRedisConnection();
    process.exit(1);
  }, 15000).unref();
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  log("error", "process", "Unhandled promise rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on("uncaughtException", (err) => {
  log("error", "process", "Uncaught exception — shutting down", {
    error: err.message,
    stack: err.stack,
  });
  persistRateLimiterState();
  setTimeout(async () => {
    await closeRedisConnection();
    process.exit(1);
  }, 1000).unref();
});
