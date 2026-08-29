const SNAP_SCRIPT_ID = "mg-midtrans-snap-script";
const SNAP_LOAD_TIMEOUT_MS = 10000;

const configuredClientKey = String(
  import.meta.env.VITE_MIDTRANS_CLIENT_KEY || ""
).trim();

const configuredProduction =
  String(import.meta.env.VITE_MIDTRANS_IS_PRODUCTION ?? "true")
    .trim()
    .toLowerCase() !== "false";

function isProductionRedirect(redirectUrl = "") {
  const normalizedUrl = String(redirectUrl || "").toLowerCase();

  if (normalizedUrl.includes("app.sandbox.midtrans.com")) return false;
  if (normalizedUrl.includes("app.midtrans.com")) return true;

  return configuredProduction;
}

function getSnapScriptUrl(isProduction) {
  return isProduction
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
}

function removeMismatchedSnapScript(expectedUrl) {
  const currentScript = document.getElementById(SNAP_SCRIPT_ID);
  if (!currentScript) return;

  const currentUrl = currentScript.getAttribute("src") || "";
  if (currentUrl === expectedUrl) return;

  currentScript.remove();

  try {
    delete window.snap;
  } catch {
    window.snap = undefined;
  }
}

export async function ensureMidtransSnap({ redirectUrl = "" } = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  // Tanpa Production Client Key, aplikasi menggunakan redirect_url dari
  // backend. Dengan begitu transaksi tetap mengikuti environment token.
  if (!configuredClientKey) return false;

  const isProduction = isProductionRedirect(redirectUrl);
  const scriptUrl = getSnapScriptUrl(isProduction);

  removeMismatchedSnapScript(scriptUrl);

  const currentScript = document.getElementById(SNAP_SCRIPT_ID);
  if (
    currentScript?.getAttribute("src") === scriptUrl &&
    typeof window.snap?.pay === "function"
  ) {
    return true;
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId;

    const finish = (ready) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(Boolean(ready && typeof window.snap?.pay === "function"));
    };

    const script = currentScript || document.createElement("script");
    script.id = SNAP_SCRIPT_ID;
    script.src = scriptUrl;
    script.async = true;
    script.setAttribute("data-client-key", configuredClientKey);

    script.addEventListener("load", () => finish(true), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });

    if (!currentScript) {
      document.head.appendChild(script);
    }

    timeoutId = window.setTimeout(
      () => finish(false),
      SNAP_LOAD_TIMEOUT_MS
    );
  });
}

export async function openMidtransPayment({
  token,
  redirectUrl,
  callbacks = {},
}) {
  const normalizedToken = String(token || "").trim();
  const normalizedRedirectUrl = String(redirectUrl || "").trim();

  const snapReady = normalizedToken
    ? await ensureMidtransSnap({ redirectUrl: normalizedRedirectUrl })
    : false;

  if (snapReady) {
    window.snap.pay(normalizedToken, callbacks);
    return { mode: "popup" };
  }

  // Redirect URL dibuat oleh backend Midtrans dengan environment yang sama
  // seperti token. Ini menjadi fallback aman jika Client Key frontend belum
  // diisi atau Snap.js gagal dimuat.
  if (normalizedRedirectUrl) {
    window.location.assign(normalizedRedirectUrl);
    return { mode: "redirect" };
  }

  throw new Error(
    "Sesi pembayaran tidak memiliki Snap Redirect URL. Buat transaksi baru atau isi VITE_MIDTRANS_CLIENT_KEY dengan Production Client Key."
  );
}
