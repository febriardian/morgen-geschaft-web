// ---------- Slug generator ----------
function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o").replace(/[ùúûü]/g, "u").replace(/[ñ]/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}



const formatIDR = (n) => "Rp" + n.toLocaleString("id-ID");



// Product images stored in Firestore may still point to old PNG/JPG paths.
// The production assets in /photos are WebP, so prefer the matching WebP file
// while preserving external URLs, data URLs, query strings, and hashes.
function resolveProductImage(productOrSource) {
  const source = typeof productOrSource === "string"
    ? productOrSource
    : productOrSource?.image || productOrSource?.images?.[0] || "";

  const value = String(source || "").trim();
  if (!value || /^(data:|blob:)/i.test(value)) return value;

  const match = value.match(/^([^?#]+)([?#].*)?$/);
  const pathname = match?.[1] || value;
  const suffix = match?.[2] || "";

  if (/\/photos\/.+\.(png|jpe?g)$/i.test(pathname)) {
    return pathname.replace(/\.(png|jpe?g)$/i, ".webp") + suffix;
  }

  return value;
}


// QR Code generator: uses Google Charts API (no dependency needed)
function generateQRUrl(text, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&margin=8`;
}



// Clipboard API kadang tidak tersedia di HTTP/non-secure context.
// Gunakan fallback textarea agar tombol salin tetap bekerja.
async function copyTextWithFallback(value) {
  const textValue = String(value || "");
  if (!textValue) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textValue);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = textValue;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch (error) {
    console.error("Gagal menyalin teks:", error);
    return false;
  }
}



// ---------- Admin panel ----------

// ---------- Tab Pesanan untuk Admin ----------

function adminDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}



function adminDateLabel(value, withTime = true) {
  const date = adminDate(value);
  if (!date) return "-";
  return date.toLocaleString("id-ID", withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}



function escapeAdminHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}



// Helper: convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export { toSlug, formatIDR, resolveProductImage, generateQRUrl, copyTextWithFallback, adminDate, adminDateLabel, escapeAdminHtml, urlBase64ToUint8Array };

