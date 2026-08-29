// middleware/rateLimiter.js
// Cluster-safe sliding-window rate limiter using Redis, with an in-memory
// fallback so the API remains available when Redis is disabled/unavailable.

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getAdminDb } from "../config/firebaseAdmin.js";
import {
  getReadyRedisClient,
  getRedisStatus,
  isRedisRequested,
  reportRedisCommandError,
} from "../services/redis.js";
import { log } from "../services/logger.js";

const RATE_LIMIT_MAX_ENTRIES = 10000;
// Saat Redis mati, fallback in-memory bersifat per-worker. Di PM2 cluster dengan
// N worker, batas efektif jadi N×. Set RATE_LIMIT_CLUSTER_INSTANCES = jumlah
// worker agar batas per-worker dibagi rata (total ≈ batas yang diinginkan).
const CLUSTER_INSTANCES = Math.max(1, Number(process.env.RATE_LIMIT_CLUSTER_INSTANCES) || 1);
const REDIS_KEY_PREFIX = String(
  process.env.RATE_LIMIT_REDIS_PREFIX || "morgen:rate-limit"
).replace(/:+$/, "");
const allLimiterMaps = [];
let redisCommandErrors = 0;
let redisFallbackRequests = 0;

// Local fallback persistence path. Redis mode itself does not need this file.
const PERSISTENCE_FILE = path.join(process.cwd(), ".rate-limiter-state.json");

const abuseCounters = new Map();
const ABUSE_THRESHOLD = 5;
const ABUSE_LOG_COOLDOWN = 10 * 60 * 1000;

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local windowMs = tonumber(ARGV[1])
local maxHits = tonumber(ARGV[2])
local member = ARGV[3]

local redisTime = redis.call('TIME')
local nowMs = (tonumber(redisTime[1]) * 1000) + math.floor(tonumber(redisTime[2]) / 1000)
local cutoff = nowMs - windowMs

redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)
local current = redis.call('ZCARD', key)

if current >= maxHits then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfterMs = windowMs
  if oldest[2] then
    retryAfterMs = math.max(1, tonumber(oldest[2]) + windowMs - nowMs)
  end
  redis.call('PEXPIRE', key, windowMs)
  return {0, current, retryAfterMs}
end

redis.call('ZADD', key, nowMs, member)
redis.call('PEXPIRE', key, windowMs)
return {1, current + 1, 0}
`;

const ABUSE_COUNTER_LUA = `
local key = KEYS[1]
local threshold = tonumber(ARGV[1])
local cooldownMs = tonumber(ARGV[2])

local count = redis.call('INCR', key)
if count == 1 then
  redis.call('PEXPIRE', key, cooldownMs)
end

if count >= threshold then
  redis.call('DEL', key)
  return 1
end
return 0
`;

function hashIdentifier(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 32);
}

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || "unknown";
}

async function writeAbuseLog(ip, requestPath) {
  try {
    const db = getAdminDb();
    await db.collection("abuse_logs").add({
      ip,
      path: requestPath,
      hitCount: ABUSE_THRESHOLD,
      loggedAt: new Date().toISOString(),
    });
    log("warn", "rate-limiter", "Abuse logged to Firestore", {
      ip,
      path: requestPath,
    });
  } catch (err) {
    log("error", "rate-limiter", "Gagal log abuse ke Firestore", {
      error: err.message,
    });
  }
}

async function logAbuseWithMemory(ip, requestPath) {
  const entry = abuseCounters.get(ip) || { count: 0, lastLogged: 0 };
  entry.count++;
  abuseCounters.set(ip, entry);

  if (
    entry.count >= ABUSE_THRESHOLD &&
    Date.now() - entry.lastLogged > ABUSE_LOG_COOLDOWN
  ) {
    entry.lastLogged = Date.now();
    entry.count = 0;
    await writeAbuseLog(ip, requestPath);
  }
}

async function logAbuse(ip, requestPath) {
  const redis = getReadyRedisClient();

  if (redis) {
    try {
      const key = `${REDIS_KEY_PREFIX}:abuse:${hashIdentifier(ip)}`;
      const shouldLog = await redis.eval(
        ABUSE_COUNTER_LUA,
        [key],
        [String(ABUSE_THRESHOLD), String(ABUSE_LOG_COOLDOWN)]
      );

      if (Number(shouldLog) === 1) {
        await writeAbuseLog(ip, requestPath);
      }
      return;
    } catch (err) {
      redisCommandErrors++;
      reportRedisCommandError(err);
      log("warn", "rate-limiter", "Redis abuse counter gagal; memakai fallback lokal", {
        error: err.message,
      });
    }
  }

  await logAbuseWithMemory(ip, requestPath);
}

function setRateLimitHeaders(res, max, current, windowMs) {
  res.set("RateLimit-Limit", String(max));
  res.set("RateLimit-Remaining", String(Math.max(0, max - current)));
  res.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
}

function applyMemoryLimit({ limiterState, req, res, next, message }) {
  const { hits, windowMs } = limiterState;
  // Bagi batas per-worker agar total antar-worker cluster mendekati batas asli.
  const max = Math.max(1, Math.floor(limiterState.max / CLUSTER_INSTANCES));
  const ip = getClientIp(req);
  const now = Date.now();
  const cutoff = now - windowMs;

  if (hits.size > RATE_LIMIT_MAX_ENTRIES) {
    hits.clear();
    log("warn", "rate-limiter", "Fallback map flushed — exceeded max entries");
  }

  let timestamps = hits.get(ip);
  if (!timestamps) {
    timestamps = [];
    hits.set(ip, timestamps);
  }

  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= max) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((timestamps[0] + windowMs - now) / 1000)
    );
    res.set("Retry-After", String(retryAfterSec));
    setRateLimitHeaders(res, max, timestamps.length, windowMs);
    void logAbuse(ip, req.originalUrl || req.path);
    return res.status(429).json({ error: message });
  }

  timestamps.push(now);
  setRateLimitHeaders(res, max, timestamps.length, windowMs);
  return next();
}

export function createRateLimiter({
  name = "default",
  windowMs = 60000,
  max = 10,
  message = "Terlalu banyak request. Coba lagi nanti.",
} = {}) {
  const limiterState = { name, hits: new Map(), windowMs, max };
  allLimiterMaps.push(limiterState);

  return async function limiter(req, res, next) {
    const redis = getReadyRedisClient();

    if (!redis) {
      if (isRedisRequested()) redisFallbackRequests++;
      return applyMemoryLimit({ limiterState, req, res, next, message });
    }

    const ip = getClientIp(req);
    const key = `${REDIS_KEY_PREFIX}:${name}:${hashIdentifier(ip)}`;
    const member = `${Date.now()}-${process.pid}-${crypto.randomUUID()}`;

    try {
      const result = await redis.eval(
        SLIDING_WINDOW_LUA,
        [key],
        [String(windowMs), String(max), member]
      );

      const [allowedRaw, currentRaw, retryAfterMsRaw] = Array.isArray(result)
        ? result
        : [0, max, windowMs];
      const allowed = Number(allowedRaw) === 1;
      const current = Number(currentRaw);
      const retryAfterMs = Number(retryAfterMsRaw);

      setRateLimitHeaders(res, max, current, windowMs);

      if (!allowed) {
        const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
        res.set("Retry-After", String(retryAfterSec));
        void logAbuse(ip, req.originalUrl || req.path);
        return res.status(429).json({ error: message });
      }

      return next();
    } catch (err) {
      redisCommandErrors++;
      redisFallbackRequests++;
      reportRedisCommandError(err);
      log("warn", "rate-limiter", "Perintah Redis gagal; memakai fallback in-memory", {
        limiter: name,
        error: err.message,
      });
      return applyMemoryLimit({ limiterState, req, res, next, message });
    }
  };
}

/** Expose stats for health/monitoring. */
export function getRateLimiterStats() {
  let totalEntries = 0;
  for (const { hits } of allLimiterMaps) totalEntries += hits.size;

  const redis = getRedisStatus();
  const store = redis.status === "ready"
    ? "redis"
    : redis.requested
      ? "memory-fallback"
      : "memory";

  return {
    store,
    limiters: allLimiterMaps.length,
    totalTrackedIPs: totalEntries,
    abuseTracked: abuseCounters.size,
    redisStatus: redis.status,
    redisFallbackRequests,
    redisCommandErrors,
  };
}

export const rateLimit = createRateLimiter({
  name: "general",
  windowMs: 60000,
  max: 10,
});
export const customerOtpRequestRateLimit = createRateLimiter({
  name: "customer-otp-request",
  windowMs: 15 * 60000,
  max: 5,
  message: "Terlalu banyak permintaan kode. Tunggu beberapa menit.",
});
export const customerOtpVerifyRateLimit = createRateLimiter({
  name: "customer-otp-verify",
  windowMs: 15 * 60000,
  max: 12,
  message: "Terlalu banyak percobaan kode. Tunggu beberapa menit.",
});
export const webhookRateLimit = createRateLimiter({
  name: "webhook",
  windowMs: 60000,
  max: 60,
  message: "Too many webhook requests.",
});
export const chatRateLimit = createRateLimiter({
  name: "chat",
  windowMs: 60000,
  max: 5,
  message: "Terlalu banyak pesan. Tunggu sebentar ya.",
});
export const reviewPhotoRateLimit = createRateLimiter({
  name: "review-photo",
  windowMs: 10 * 60000,
  max: 5,
  message: "Terlalu banyak unggahan foto ulasan. Tunggu beberapa menit.",
});
export const reviewSubmitRateLimit = createRateLimiter({
  name: "review-submit",
  windowMs: 10 * 60000,
  max: 3,
  message: "Kamu baru saja mengirim ulasan. Tunggu beberapa menit.",
});
// Alias lama dipertahankan agar import lama tidak langsung rusak.
export const testimoniRateLimit = reviewSubmitRateLimit;
export const reviewHelpfulRateLimit = createRateLimiter({
  name: "review-helpful",
  windowMs: 60000,
  max: 12,
  message: "Terlalu banyak respons ulasan. Tunggu sebentar.",
});
export const returnSubmitRateLimit = createRateLimiter({
  name: "return-submit",
  windowMs: 30 * 60000,
  max: 3,
  message: "Terlalu banyak pengajuan komplain. Tunggu beberapa menit.",
});
export const returnEvidenceRateLimit = createRateLimiter({
  name: "return-evidence",
  windowMs: 30 * 60000,
  max: 6,
  message: "Terlalu banyak unggahan bukti. Tunggu beberapa menit.",
});

// Clean only local fallback entries. Redis keys expire automatically.
setInterval(() => {
  const now = Date.now();
  let totalCleaned = 0;

  for (const { hits, windowMs } of allLimiterMaps) {
    const cutoff = now - windowMs;
    for (const [ip, timestamps] of hits) {
      while (timestamps.length > 0 && timestamps[0] <= cutoff) timestamps.shift();
      if (timestamps.length === 0) {
        hits.delete(ip);
        totalCleaned++;
      }
    }
  }

  if (totalCleaned > 0) {
    log("info", "rate-limiter", `Cleaned ${totalCleaned} stale fallback entries`);
  }
}, 5 * 60 * 1000).unref();

/** Persist only local fallback state; Redis state already survives workers. */
export function persistRateLimiterState() {
  try {
    const now = Date.now();
    const state = [];

    for (const { name, hits, windowMs } of allLimiterMaps) {
      const cutoff = now - windowMs;
      const entries = {};
      for (const [ip, timestamps] of hits) {
        const valid = timestamps.filter((timestamp) => timestamp > cutoff);
        if (valid.length > 0) entries[ip] = valid;
      }
      state.push({ name, windowMs, entries });
    }

    const entryCount = state.reduce(
      (count, limiter) => count + Object.keys(limiter.entries).length,
      0
    );

    if (entryCount === 0) {
      try {
        fs.unlinkSync(PERSISTENCE_FILE);
      } catch {
        // File may not exist.
      }
      return;
    }

    fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify({ savedAt: now, state }));
    log("info", "rate-limiter", `Fallback state persisted: ${entryCount} IPs`);
  } catch (err) {
    log("error", "rate-limiter", "Failed to persist fallback state", {
      error: err.message,
    });
  }
}

function restoreRateLimiterState() {
  try {
    if (!fs.existsSync(PERSISTENCE_FILE)) return;

    const raw = JSON.parse(fs.readFileSync(PERSISTENCE_FILE, "utf-8"));
    const now = Date.now();
    const maxAge = 10 * 60 * 1000;

    if (!raw.savedAt || now - raw.savedAt > maxAge) {
      fs.unlinkSync(PERSISTENCE_FILE);
      return;
    }

    let restored = 0;
    for (const saved of raw.state || []) {
      const limiter = allLimiterMaps.find(
        (item) => item.name === saved.name || item.windowMs === saved.windowMs
      );
      if (!limiter) continue;

      const cutoff = now - limiter.windowMs;
      for (const [ip, timestamps] of Object.entries(saved.entries || {})) {
        const valid = timestamps.filter((timestamp) => timestamp > cutoff);
        if (valid.length > 0) {
          limiter.hits.set(ip, valid);
          restored++;
        }
      }
    }

    fs.unlinkSync(PERSISTENCE_FILE);
    if (restored > 0) {
      log("info", "rate-limiter", `Restored ${restored} fallback IP entries`);
    }
  } catch (err) {
    log("warn", "rate-limiter", "Failed to restore fallback state", {
      error: err.message,
    });
    try {
      fs.unlinkSync(PERSISTENCE_FILE);
    } catch {
      // Ignore cleanup failure.
    }
  }
}

restoreRateLimiterState();

log("info", "rate-limiter", isRedisRequested()
  ? "Redis shared rate limiter diminta; in-memory fallback tetap aktif."
  : "In-memory rate limiter aktif. Isi REDIS_URL sebelum mengaktifkan PM2 cluster.", {
  limiters: allLimiterMaps.length,
  maxEntries: RATE_LIMIT_MAX_ENTRIES,
});
