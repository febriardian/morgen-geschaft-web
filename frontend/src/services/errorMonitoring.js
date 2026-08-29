let sentryModulePromise = null;
let sentryInitialized = false;

function sentryConfiguration() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  const parsedRate = Number.parseFloat(
    import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? ""
  );
  const tracesSampleRate =
    Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 1
      ? parsedRate
      : import.meta.env.PROD
        ? 0.1
        : 1;

  return { dsn, tracesSampleRate };
}

async function loadSentry() {
  const { dsn, tracesSampleRate } = sentryConfiguration();
  if (!dsn) return null;

  if (!sentryModulePromise) {
    sentryModulePromise = import("@sentry/react")
      .then((Sentry) => {
        if (!sentryInitialized) {
          Sentry.init({
            dsn,
            environment: import.meta.env.MODE,
            integrations: [Sentry.browserTracingIntegration()],
            tracesSampleRate,
            sendDefaultPii: false,
          });
          sentryInitialized = true;
        }
        return Sentry;
      })
      .catch(() => null);
  }

  return sentryModulePromise;
}

/**
 * Monitoring is intentionally kept out of the critical render path. It starts
 * after the storefront has settled, while boundary-caught errors can still
 * trigger it immediately through captureMonitoredException().
 */
function scheduleErrorMonitoring(delayMs = 15000) {
  if (!sentryConfiguration().dsn || typeof window === "undefined") return () => {};

  let idleId = null;
  const timerId = window.setTimeout(() => {
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(() => {
        loadSentry();
      }, { timeout: 5000 });
    } else {
      loadSentry();
    }
  }, delayMs);

  return () => {
    window.clearTimeout(timerId);
    if (idleId !== null && "cancelIdleCallback" in window) {
      window.cancelIdleCallback(idleId);
    }
  };
}

async function captureMonitoredException(error, boundary, info) {
  try {
    const Sentry = await loadSentry();
    if (!Sentry) return;
    Sentry.withScope((scope) => {
      scope.setTag("error.boundary", boundary);
      scope.setContext("react", {
        componentStack: String(info?.componentStack || "").slice(0, 4000),
      });
      Sentry.captureException(error);
    });
  } catch {
    // Monitoring must never cause a secondary application error.
  }
}

export { captureMonitoredException, scheduleErrorMonitoring };
