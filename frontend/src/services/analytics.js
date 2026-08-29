let _gaReady = false;
let _metaReady = false;
let gaState = "idle";
let metaState = "idle";
let analyticsInitTimer = null;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PLACEHOLDER_ID_PATTERN = /(X{4,}|YOUR[_ -]?ID|CHANGE[_ -]?ME|EXAMPLE|PLACEHOLDER)/i;

export function isValidGoogleAnalyticsId(value) {
  const id = String(value || "").trim();
  return /^G-[A-Z0-9]{6,20}$/.test(id) && !PLACEHOLDER_ID_PATTERN.test(id);
}

export function isValidMetaPixelId(value) {
  const id = String(value || "").trim();
  return /^\d{5,20}$/.test(id);
}

export function getAnalyticsConfig(environment = import.meta.env) {
  const rawGaId = String(environment?.VITE_GA_ID || "").trim();
  const rawMetaPixelId = String(environment?.VITE_META_PIXEL_ID || "").trim();

  return {
    gaId: isValidGoogleAnalyticsId(rawGaId) ? rawGaId : "",
    metaPixelId: isValidMetaPixelId(rawMetaPixelId) ? rawMetaPixelId : "",
  };
}

function hasAnalyticsConsent() {
  try {
    return localStorage.getItem("mg_analytics_consent") === "accepted";
  } catch {
    return false;
  }
}

export function browserRequestsNoTracking(navigatorValue = globalThis.navigator) {
  const globalDnt = typeof globalThis.doNotTrack === "string" ? globalThis.doNotTrack : "";
  const dnt = String(
    navigatorValue?.doNotTrack ?? navigatorValue?.msDoNotTrack ?? globalDnt ?? ""
  ).toLowerCase();

  return navigatorValue?.globalPrivacyControl === true || dnt === "1" || dnt === "yes";
}

function analyticsEnvironmentAllowsLoading() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (LOCAL_HOSTS.has(window.location.hostname)) return false;
  return !browserRequestsNoTracking(window.navigator);
}

export function browserLikelyBlocksTracking(documentValue = globalThis.document) {
  if (!documentValue?.body || typeof globalThis.getComputedStyle !== "function") return false;

  const bait = documentValue.createElement("div");
  bait.className = "adsbox ad-banner ad-unit google-ad";
  bait.setAttribute("aria-hidden", "true");
  bait.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;width:10px;height:10px;pointer-events:none;";
  documentValue.body.appendChild(bait);
  const style = globalThis.getComputedStyle(bait);
  const blocked =
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.width === "0px" ||
    style.height === "0px";
  bait.remove();
  return blocked;
}

function disableGoogleAnalytics(gaId) {
  if (typeof window === "undefined" || !gaId) return;
  window[`ga-disable-${gaId}`] = true;
}

function loadGoogleAnalytics(gaId) {
  if (!gaId || gaState !== "idle") return;
  gaState = "loading";

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };
  window.gtag("js", new Date());
  window.gtag("config", gaId, {
    send_page_view: true,
    anonymize_ip: true,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  script.dataset.morgenAnalytics = "google";
  script.addEventListener(
    "load",
    () => {
      gaState = "ready";
      _gaReady = true;
    },
    { once: true }
  );
  script.addEventListener(
    "error",
    () => {
      gaState = "blocked";
      _gaReady = false;
      disableGoogleAnalytics(gaId);
    },
    { once: true }
  );
  document.head.appendChild(script);
}

function createMetaQueue() {
  if (window.fbq) return window.fbq;

  const fbq = function fbq() {
    if (fbq.callMethod) {
      fbq.callMethod.apply(fbq, arguments);
    } else {
      fbq.queue.push(arguments);
    }
  };
  window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = false;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  return fbq;
}

function loadMetaPixel(metaPixelId) {
  if (!metaPixelId || metaState !== "idle") return;
  metaState = "loading";

  const fbq = createMetaQueue();
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  script.dataset.morgenAnalytics = "meta";
  script.addEventListener(
    "load",
    () => {
      metaState = "ready";
      _metaReady = true;
      fbq.loaded = true;
    },
    { once: true }
  );
  script.addEventListener(
    "error",
    () => {
      metaState = "blocked";
      _metaReady = false;
    },
    { once: true }
  );
  document.head.appendChild(script);

  fbq("init", metaPixelId);
  fbq("track", "PageView");
}

function setAnalyticsConsent(accepted) {
  try {
    localStorage.setItem("mg_analytics_consent", accepted ? "accepted" : "declined");
  } catch {}

  if (accepted) {
    initAnalytics(true);
    return;
  }

  const { gaId } = getAnalyticsConfig();
  disableGoogleAnalytics(gaId);
  _gaReady = false;
  _metaReady = false;
}

function initAnalytics(force = false) {
  if ((!force && !hasAnalyticsConsent()) || !analyticsEnvironmentAllowsLoading()) return;
  if (analyticsInitTimer !== null || gaState !== "idle" || metaState !== "idle") return;

  // Analytics must not compete with the hero/LCP. The CSS bait also avoids
  // requesting known tracker URLs when the browser is clearly blocking them,
  // preventing avoidable ERR_BLOCKED_BY_CLIENT noise.
  const start = () => {
    analyticsInitTimer = null;
    if (browserLikelyBlocksTracking()) return;
    const { gaId, metaPixelId } = getAnalyticsConfig();
    loadGoogleAnalytics(gaId);
    loadMetaPixel(metaPixelId);
  };

  analyticsInitTimer = globalThis.setTimeout(() => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 3000 });
    } else {
      start();
    }
  }, force ? 0 : 8000);
}

function track(eventName, parameters = {}) {
  if ((gaState === "loading" || _gaReady) && window.gtag) {
    window.gtag("event", eventName, parameters);
  }

  if ((metaState === "loading" || _metaReady) && window.fbq) {
    if (eventName === "purchase") {
      window.fbq("track", "Purchase", { value: parameters.value, currency: "IDR" });
    } else if (eventName === "add_to_cart") {
      window.fbq("track", "AddToCart", {
        content_name: parameters.item_name,
        value: parameters.price,
        currency: "IDR",
      });
    } else if (eventName === "view_item") {
      window.fbq("track", "ViewContent", { content_name: parameters.item_name });
    } else if (eventName === "begin_checkout") {
      window.fbq("track", "InitiateCheckout", {
        value: parameters.value,
        currency: "IDR",
      });
    }
  }
}

const analytics = {
  viewProduct: (product) =>
    track("view_item", {
      item_id: product.id,
      item_name: product.name,
      price: product.price,
    }),
  addToCart: (product) =>
    track("add_to_cart", {
      item_id: product.id,
      item_name: product.name,
      price: product.price,
    }),
  beginCheckout: (cart) =>
    track("begin_checkout", {
      value: cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    }),
  purchase: (id, amount) =>
    track("purchase", {
      transaction_id: id,
      value: amount,
      currency: "IDR",
    }),
  search: (query) => track("search", { search_term: query }),
};

export {
  _gaReady,
  _metaReady,
  initAnalytics,
  track,
  analytics,
  hasAnalyticsConsent,
  setAnalyticsConsent,
};
