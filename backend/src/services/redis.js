// services/redis.js
// Shared Upstash Redis REST client for cluster-safe infrastructure components.
// Uses HTTPS instead of a persistent TCP socket, which is more reliable on
// Windows/local networks and remains safe when PM2 runs multiple workers.

import "dotenv/config";
import { Redis } from "@upstash/redis";
import { log } from "./logger.js";

const REST_URL = String(process.env.UPSTASH_REDIS_REST_URL || "").trim();
const REST_TOKEN = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const LEGACY_REDIS_URL = String(process.env.REDIS_URL || "").trim();

const RATE_LIMIT_STORE = String(
  process.env.RATE_LIMIT_STORE ||
    (REST_URL || REST_TOKEN || LEGACY_REDIS_URL ? "redis" : "memory")
)
  .trim()
  .toLowerCase();

const REQUEST_TIMEOUT_MS = Math.max(
  1000,
  Number(
    process.env.UPSTASH_REDIS_REST_TIMEOUT_MS ||
      process.env.REDIS_CONNECT_TIMEOUT_MS ||
      5000
  )
);
const RETRY_COOLDOWN_MS = Math.max(
  5000,
  Number(process.env.REDIS_RETRY_COOLDOWN_MS || 30000)
);

let client = null;
let verificationPromise = null;
let currentStatus = "not_connected";
let lastError = null;
let lastErrorAt = null;
let lastErrorLogAt = 0;
let nextConnectAllowedAt = 0;

function looksLikePlaceholder(value) {
  if (!value) return false;

  const normalized = value.toLowerCase();
  return [
    "password@host:port",
    "password_asli",
    "host_asli",
    "port_asli",
    "your-password",
    "your-host",
    "your-token",
    "<password>",
    "<host>",
    "<port>",
    "<token>",
  ].some((token) => normalized.includes(token));
}

function deriveCredentialsFromLegacyUrl() {
  if (!LEGACY_REDIS_URL) return null;
  if (looksLikePlaceholder(LEGACY_REDIS_URL)) return null;

  try {
    const parsed = new URL(LEGACY_REDIS_URL);
    if (!["redis:", "rediss:"].includes(parsed.protocol)) return null;
    if (!parsed.hostname || !parsed.password) return null;

    // Upstash's Redis protocol password is also its database token, and the
    // REST endpoint uses HTTPS on the same database hostname.
    return {
      url: `https://${parsed.hostname}`,
      token: decodeURIComponent(parsed.password),
      source: "legacy_redis_url",
    };
  } catch {
    return null;
  }
}

function getCredentials() {
  if (REST_URL && REST_TOKEN) {
    return {
      url: REST_URL.replace(/\/+$/, ""),
      token: REST_TOKEN,
      source: "rest_env",
    };
  }

  return deriveCredentialsFromLegacyUrl();
}

function getConfigurationProblem() {
  if (!isRedisRequested()) return null;

  if (REST_URL || REST_TOKEN) {
    if (!REST_URL) return "UPSTASH_REDIS_REST_URL belum diisi";
    if (!REST_TOKEN) return "UPSTASH_REDIS_REST_TOKEN belum diisi";
    if (looksLikePlaceholder(REST_URL) || looksLikePlaceholder(REST_TOKEN)) {
      return "Kredensial Upstash masih berupa contoh";
    }

    try {
      const parsed = new URL(REST_URL);
      if (parsed.protocol !== "https:") {
        return "UPSTASH_REDIS_REST_URL harus diawali https://";
      }
      if (!parsed.hostname) return "Host REST Upstash tidak valid";
    } catch {
      return "Format UPSTASH_REDIS_REST_URL tidak valid";
    }

    return null;
  }

  if (!LEGACY_REDIS_URL) {
    return "RATE_LIMIT_STORE=redis tetapi kredensial Upstash belum diisi";
  }
  if (looksLikePlaceholder(LEGACY_REDIS_URL)) {
    return "REDIS_URL masih berupa contoh";
  }
  if (!deriveCredentialsFromLegacyUrl()) {
    return "REDIS_URL lama tidak dapat dikonversi menjadi kredensial Upstash REST";
  }

  return null;
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timeout setelah ${timeoutMs} ms`)),
      timeoutMs
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function recordRedisError(err) {
  lastError = err instanceof Error ? err.message : String(err);
  lastErrorAt = new Date().toISOString();
  currentStatus = "error";

  const now = Date.now();
  if (now - lastErrorLogAt >= 30_000) {
    lastErrorLogAt = now;
    log("error", "redis", "Upstash Redis REST bermasalah", {
      error: lastError,
    });
  }
}

function createRedisClient() {
  const credentials = getCredentials();
  if (!credentials) return null;

  return new Redis({
    url: credentials.url,
    token: credentials.token,
    enableTelemetry: false,
  });
}

export function isRedisRequested() {
  return RATE_LIMIT_STORE === "redis";
}

export function isRedisConfigured() {
  return isRedisRequested() && !getConfigurationProblem();
}

/**
 * Verify the connectionless REST client with PING. The same Redis instance is
 * reused so read-your-writes behavior and HTTP connection pooling are retained.
 */
export async function ensureRedisConnection() {
  if (!isRedisRequested()) {
    currentStatus = "disabled";
    return null;
  }

  const configurationProblem = getConfigurationProblem();
  if (configurationProblem) {
    currentStatus = "invalid_config";
    lastError = configurationProblem;
    lastErrorAt = new Date().toISOString();
    return null;
  }

  if (currentStatus === "ready" && client) return client;
  if (Date.now() < nextConnectAllowedAt) {
    currentStatus = "cooldown";
    return null;
  }
  if (verificationPromise) return verificationPromise;

  if (!client) client = createRedisClient();
  if (!client) {
    currentStatus = "invalid_config";
    return null;
  }

  currentStatus = "connecting";
  verificationPromise = withTimeout(
    client.ping(),
    REQUEST_TIMEOUT_MS,
    "Upstash Redis REST"
  )
    .then((result) => {
      if (String(result).toUpperCase() !== "PONG") {
        throw new Error(`Respons PING tidak valid: ${String(result)}`);
      }

      currentStatus = "ready";
      lastError = null;
      lastErrorAt = null;
      nextConnectAllowedAt = 0;
      log("info", "redis", "Upstash Redis REST siap untuk shared rate limiter");
      return client;
    })
    .catch((err) => {
      recordRedisError(err);
      nextConnectAllowedAt = Date.now() + RETRY_COOLDOWN_MS;
      client = null;
      return null;
    })
    .finally(() => {
      verificationPromise = null;
    });

  return verificationPromise;
}

/**
 * Non-blocking accessor for request middleware. Starts verification in the
 * background and returns a client only after PING succeeds.
 */
export function getReadyRedisClient() {
  if (!isRedisRequested()) return null;

  if (currentStatus === "ready" && client) return client;
  if (
    !verificationPromise &&
    Date.now() >= nextConnectAllowedAt &&
    currentStatus !== "invalid_config"
  ) {
    void ensureRedisConnection();
  }

  return null;
}

/** Mark the REST client unavailable after a command failure. */
export function reportRedisCommandError(err) {
  recordRedisError(err);
  nextConnectAllowedAt = Date.now() + RETRY_COOLDOWN_MS;
  client = null;
}

export function getRedisStatus() {
  const configurationProblem = isRedisRequested()
    ? getConfigurationProblem()
    : null;

  let status = "disabled";
  if (!isRedisRequested()) status = "disabled";
  else if (configurationProblem) status = "invalid_config";
  else if (currentStatus === "ready" && client) status = "ready";
  else if (verificationPromise || currentStatus === "connecting") status = "connecting";
  else if (Date.now() < nextConnectAllowedAt) status = "cooldown";
  else if (lastError) status = "error";
  else status = "not_connected";

  return {
    requested: isRedisRequested(),
    configured: isRedisConfigured(),
    status,
    transport: "https-rest",
    lastError: configurationProblem || lastError,
    lastErrorAt,
    retryAfterMs: Math.max(0, nextConnectAllowedAt - Date.now()),
  };
}

/** Upstash REST is connectionless, so shutdown only clears local state. */
export async function closeRedisConnection() {
  client = null;
  verificationPromise = null;
  if (isRedisRequested()) currentStatus = "not_connected";
}
