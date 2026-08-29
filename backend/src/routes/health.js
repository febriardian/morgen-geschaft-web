import { Router } from "express";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { verifyAdmin } from "../middleware/auth.js";
import { getRateLimiterStats } from "../middleware/rateLimiter.js";
import { ensureRedisConnection, getRedisStatus } from "../services/redis.js";
import { verifySmtpConnection } from "../services/email.js";
import { log } from "../services/logger.js";
import { captureException, getSentryStatus } from "../services/sentry.js";
import {
  getCloudinaryStatus,
  verifyCloudinaryConnection,
} from "../services/imageCdn.js";

const router = Router();
const parsedSmtpHealthTimeout = Number.parseInt(
  process.env.SMTP_HEALTH_TIMEOUT_MS || "30000",
  10,
);
const SMTP_HEALTH_TIMEOUT_MS = Number.isFinite(parsedSmtpHealthTimeout)
  ? Math.min(60000, Math.max(5000, parsedSmtpHealthTimeout))
  : 30000;

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timeout setelah ${timeoutMs} ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function detailedHealthReport() {
  const checks = {
    firestore: "unknown",
    midtrans: process.env.MIDTRANS_SERVER_KEY ? "configured" : "missing_key",
    biteship: process.env.BITESHIP_API_KEY ? "configured" : "missing_key",
    gemini: "unknown",
    smtp: "unknown",
    redis: "unknown",
    sentry: "unknown",
    cloudinary: "unknown",
  };
  let healthy = checks.midtrans === "configured" && checks.biteship === "configured";
  let cloudinary = getCloudinaryStatus();
  let smtp = {
    configured: false,
    status: "unknown",
    latencyMs: -1,
    errorCode: "",
    missing: [],
  };

  const firestoreCheck = withTimeout(
    (async () => {
      const db = getAdminDb();
      await db.collection("products").limit(1).get();
      return "ok";
    })(),
    3500,
    "Firestore",
  );

  const geminiCheck = process.env.GEMINI_API_KEY
    ? withTimeout(
      (async () => {
        const startedAt = Date.now();
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${process.env.GEMINI_API_KEY}`,
          { method: "GET", signal: AbortSignal.timeout(4500) },
        );
        return { status: response.ok ? "ok" : "error", ms: Date.now() - startedAt };
      })(),
      5000,
      "Gemini",
    )
    : Promise.resolve({ status: "missing_key", ms: -1 });

  const [firestoreResult, geminiResult, smtpResult, redisResult, cloudinaryResult] = await Promise.allSettled([
    firestoreCheck,
    geminiCheck,
    // SMTP hosting/domain dapat membutuhkan beberapa tahap berurutan: DNS,
    // koneksi, TLS, lalu greeting. Beri waktu sampai transport mengembalikan
    // diagnosisnya sendiri agar koneksi yang sehat tidak salah ditandai timeout.
    withTimeout(verifySmtpConnection(), SMTP_HEALTH_TIMEOUT_MS, "SMTP"),
    withTimeout(ensureRedisConnection(), 5000, "Redis"),
    withTimeout(verifyCloudinaryConnection(), 5000, "Cloudinary"),
  ]);

  if (firestoreResult.status === "fulfilled") checks.firestore = firestoreResult.value;
  else {
    checks.firestore = "timeout_or_error";
    healthy = false;
    log("error", "health", "Firestore check failed", { error: firestoreResult.reason?.message });
  }

  if (geminiResult.status === "fulfilled") {
    checks.gemini = geminiResult.value.status;
    checks.geminiMs = geminiResult.value.ms;
    if (checks.gemini !== "ok") healthy = false;
  } else {
    checks.gemini = "timeout_or_error";
    checks.geminiMs = -1;
    healthy = false;
    log("error", "health", "Gemini check failed", { error: geminiResult.reason?.message });
  }

  if (smtpResult.status === "fulfilled") {
    smtp = smtpResult.value;
    checks.smtp = smtp.status;
    if (checks.smtp !== "ok") healthy = false;
  } else {
    checks.smtp = "timeout_or_error";
    healthy = false;
    smtp = {
      ...smtp,
      configured: true,
      status: "timeout_or_error",
      errorCode: "HEALTH_TIMEOUT",
    };
    log("warn", "health", "SMTP check failed", { error: smtpResult.reason?.message });
  }

  if (redisResult.status === "rejected") {
    log("warn", "health", "Redis check failed", { error: redisResult.reason?.message });
  }

  const redis = getRedisStatus();
  checks.redis = redis.status;
  if (redis.requested && redis.status !== "ready") healthy = false;

  const sentry = getSentryStatus();
  checks.sentry = sentry.status;
  if (sentry.configured && sentry.status !== "ready") healthy = false;

  if (cloudinaryResult.status === "fulfilled") {
    cloudinary = cloudinaryResult.value;
    checks.cloudinary = cloudinary.status;
  } else {
    cloudinary = {
      ...cloudinary,
      status: "timeout_or_error",
      lastError: cloudinaryResult.reason?.message || "Cloudinary health check failed.",
    };
    checks.cloudinary = cloudinary.status;
    log("warn", "health", "Cloudinary check failed", {
      error: cloudinaryResult.reason?.message,
    });
  }
  if (cloudinary.requested && checks.cloudinary !== "ready") healthy = false;

  return {
    status: healthy ? "ok" : "degraded",
    time: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    checks,
    redis: {
      requested: redis.requested,
      configured: redis.configured,
      status: redis.status,
      transport: redis.transport,
      retryAfterMs: redis.retryAfterMs,
    },
    sentry: {
      configured: sentry.configured,
      initialized: sentry.initialized,
      status: sentry.status,
      environment: sentry.environment,
      tracesSampleRate: sentry.tracesSampleRate,
      lastError: sentry.lastError,
    },
    cloudinary: {
      requested: cloudinary.requested,
      configured: cloudinary.configured,
      status: cloudinary.status,
      missing: cloudinary.missing,
      rootFolder: cloudinary.rootFolder,
      lastError: cloudinary.lastError || "",
    },
    smtp: {
      configured: smtp.configured,
      status: smtp.status,
      latencyMs: smtp.latencyMs,
      errorCode: smtp.errorCode,
      missing: smtp.missing,
    },
    rateLimiter: getRateLimiterStats(),
  };
}

// Public probes intentionally expose only process availability.
router.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// CLIENT ERROR REPORTING — frontend ErrorBoundary sends crash reports here.
// Rate-limited implicitly by sendBeacon (browsers batch these). We only log,
// never expose internal state back to the client.
// ---------------------------------------------------------------------------
const CLIENT_ERROR_COOLDOWN_MS = 5000;
let lastClientErrorAt = 0;

router.post("/api/health/client-error", (req, res) => {
  const now = Date.now();
  if (now - lastClientErrorAt < CLIENT_ERROR_COOLDOWN_MS) {
    return res.status(204).end();
  }
  lastClientErrorAt = now;

  const { message, stack, context, url, timestamp } = req.body || {};
  const safeMessage = String(message || "Unknown client error").slice(0, 500);
  const errorContext = {
    stack: String(stack || "").slice(0, 1000),
    context: String(context || "").slice(0, 100),
    pageUrl: String(url || "").slice(0, 300),
    clientTime: String(timestamp || ""),
  };

  log("warn", "client-error", safeMessage, errorContext);
  captureException(new Error(`Frontend: ${safeMessage}`), errorContext);

  return res.status(204).end();
});

// Detailed dependency checks are restricted to authenticated administrators.
router.get("/api/admin/health", verifyAdmin, async (_req, res) => {
  const report = await detailedHealthReport();
  res.setHeader("Cache-Control", "no-store");
  return res.status(report.status === "ok" ? 200 : 503).json(report);
});

export default router;
