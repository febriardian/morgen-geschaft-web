// Optional Sentry integration for backend error monitoring.
// The application keeps running when SENTRY_DSN is empty or the package is not installed.

import { log } from "./logger.js";

let Sentry = null;
let initialized = false;
let lastError = null;
let activeSampleRate = 0;

function readSampleRate() {
  const fallback = process.env.NODE_ENV === "production" ? 0.1 : 1;
  const parsed = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function removeSensitiveObjectFields(value) {
  if (!value || typeof value !== "object") return value;
  const clone = Array.isArray(value) ? [...value] : { ...value };
  const blocked = [
    "authorization",
    "cookie",
    "password",
    "token",
    "serverKey",
    "apiKey",
    "serviceAccount",
    "shippingQuoteSecret",
  ];

  for (const key of Object.keys(clone)) {
    if (blocked.some((item) => key.toLowerCase().includes(item.toLowerCase()))) {
      clone[key] = "[Filtered]";
    }
  }
  return clone;
}

export async function initSentry() {
  if (!process.env.SENTRY_DSN) {
    initialized = false;
    lastError = null;
    log("info", "sentry", "SENTRY_DSN not set, skipping Sentry initialization");
    return;
  }

  try {
    Sentry = await import("@sentry/node");
    activeSampleRate = readSampleRate();

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
      release: process.env.SENTRY_RELEASE || process.env.npm_package_version || "unknown",
      tracesSampleRate: activeSampleRate,
      ignoreErrors: ["ECONNRESET", "EPIPE", "socket hang up", "aborted"],
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        if (event.request?.cookies) event.request.cookies = {};
        if (event.request?.data) {
          event.request.data = removeSensitiveObjectFields(event.request.data);
        }
        return event;
      },
    });

    initialized = true;
    lastError = null;
    log("info", "sentry", "Sentry initialized", {
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
      tracesSampleRate: activeSampleRate,
    });
  } catch (error) {
    initialized = false;
    lastError = error?.message || String(error);
    log("warn", "sentry", "Failed to initialize Sentry", { error: lastError });
  }
}

export function setupSentryErrorHandler(app) {
  if (!initialized || !Sentry) return;

  try {
    Sentry.setupExpressErrorHandler(app);
  } catch {
    try {
      app.use(Sentry.Handlers?.errorHandler?.() || ((error, _req, _res, next) => next(error)));
    } catch {
      log("warn", "sentry", "Could not setup Express error handler");
    }
  }
}

export function captureException(error, context = {}) {
  if (!initialized || !Sentry) return;

  try {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, removeSensitiveObjectFields(value));
      }
      Sentry.captureException(error);
    });
  } catch {
    // Error reporting must never cause a secondary crash.
  }
}

export function captureMessage(message, level = "warning") {
  if (!initialized || !Sentry) return;
  try {
    Sentry.captureMessage(message, level);
  } catch {
    // Ignore monitoring errors.
  }
}

export function setUser(user) {
  if (!initialized || !Sentry) return;
  try {
    Sentry.setUser(user ? { id: user.uid, email: user.email } : null);
  } catch {
    // Ignore monitoring errors.
  }
}

export function getSentryStatus() {
  const configured = Boolean(process.env.SENTRY_DSN);
  return {
    configured,
    initialized,
    status: initialized ? "ready" : configured ? "error" : "disabled",
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    tracesSampleRate: activeSampleRate,
    lastError: lastError || null,
  };
}
