import { API_BASE } from "../config/constants.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function unique(values) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

/**
 * Local development always uses the same-origin /api path. Vite forwards it
 * to the backend on port 3002, so the browser never needs to connect directly
 * to localhost:3002 or to the production API domain.
 */
export function getApiBaseCandidates() {
  const configured = normalizeBase(API_BASE);

  if (typeof window === "undefined") {
    return [configured || ""];
  }

  if (LOCAL_HOSTS.has(window.location.hostname)) {
    return [""];
  }

  return unique(configured ? [configured, ""] : [""]);
}

function joinApiUrl(base, path) {
  const normalizedPath = String(path || "").startsWith("/") ? String(path) : `/${path}`;
  return `${base}${normalizedPath}`;
}

function mergeSignals(controller, externalSignal) {
  if (!externalSignal) return () => {};
  if (externalSignal.aborted) controller.abort(externalSignal.reason);
  const abort = () => controller.abort(externalSignal.reason);
  externalSignal.addEventListener("abort", abort, { once: true });
  return () => externalSignal.removeEventListener("abort", abort);
}

export async function apiFetch(path, options = {}, config = {}) {
  const {
    timeoutMs = 20000,
    retryStatuses = [502, 503, 504],
    expectJson = false,
  } = config;

  const bases = getApiBaseCandidates();
  let lastError = null;
  let lastResponse = null;

  for (let index = 0; index < bases.length; index += 1) {
    const controller = new AbortController();
    const detachSignal = mergeSignals(controller, options.signal);
    const timeout = globalThis.setTimeout(
      () => controller.abort(new DOMException("Request timeout", "AbortError")),
      timeoutMs
    );

    try {
      const response = await fetch(joinApiUrl(bases[index], path), {
        ...options,
        signal: controller.signal,
      });

      lastResponse = response;
      const contentType = response.headers.get("content-type") || "";
      const invalidPayload = expectJson && !contentType.includes("application/json");
      const shouldRetry =
        (retryStatuses.includes(response.status) || invalidPayload) &&
        index < bases.length - 1;

      if (!shouldRetry) return response;
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted) throw error;
      if (index === bases.length - 1) throw error;
    } finally {
      globalThis.clearTimeout(timeout);
      detachSignal();
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error("API tidak dapat dihubungi.");
}

export async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};
  return response.json().catch(() => ({}));
}
