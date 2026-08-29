import process from "node:process";

const DEFAULT_BASE_URL = "https://morgengeschaft.com";
const args = process.argv.slice(2);
const baseArgIndex = args.findIndex((value) => value === "--base");
const baseUrl = String(
  (baseArgIndex >= 0 ? args[baseArgIndex + 1] : "") ||
    process.env.PRODUCTION_BASE_URL ||
    DEFAULT_BASE_URL
)
  .trim()
  .replace(/\/+$/, "");

const timeoutMs = Math.max(
  3000,
  Number.parseInt(process.env.PRODUCTION_CHECK_TIMEOUT_MS || "15000", 10) || 15000
);

function joinUrl(pathname) {
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

async function request(pathname, { expect = "json" } = {}) {
  const url = joinUrl(pathname);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Morgen-Production-Verifier/1.0",
        accept: expect === "json" ? "application/json" : "text/html,*/*",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const body =
      expect === "json"
        ? await response.json().catch(() => null)
        : await response.text().catch(() => "");

    return { url, response, contentType, body };
  } finally {
    clearTimeout(timeout);
  }
}

function resultLine(ok, label, detail = "") {
  const mark = ok ? "OK" : "GAGAL";
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`${mark.padEnd(5)} ${label}${suffix}`);
}

function productImageCandidates(imagePath) {
  const raw = String(imagePath || "").trim();
  if (!raw) return [];
  const candidates = [raw];
  if (/\.(png|jpe?g)$/i.test(raw)) {
    candidates.unshift(raw.replace(/\.(png|jpe?g)$/i, ".webp"));
  }
  return [...new Set(candidates)];
}

const checks = [];
let products = [];

async function runCheck(label, action) {
  try {
    const detail = await action();
    resultLine(true, label, detail);
    checks.push({ label, ok: true });
  } catch (error) {
    resultLine(false, label, error?.message || String(error));
    checks.push({ label, ok: false });
  }
}

console.log(`Memeriksa production: ${baseUrl}\n`);

await runCheck("Health API", async () => {
  const { response, body } = await request("/api/health");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (body?.status !== "ok") throw new Error(`status=${body?.status || "tidak valid"}`);
  return "status ok";
});

await runCheck("Backend version", async () => {
  const { response, body } = await request("/api/_version");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (body?.build !== "performance-console-fix-v4") {
    throw new Error(`build=${body?.build || "tidak diketahui"}`);
  }
  return body.build;
});

await runCheck("Products API", async () => {
  const { response, body } = await request("/api/products");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  products = Array.isArray(body?.products) ? body.products : [];
  if (products.length === 0) throw new Error("products kosong");
  return `${products.length} produk`;
});

await runCheck("Promotions API", async () => {
  const { response, body } = await request("/api/promotions");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const coupons = Array.isArray(body?.coupons) ? body.coupons : [];
  return `${coupons.length} kupon`;
});

await runCheck("Blogs API", async () => {
  const { response, body } = await request("/api/blogs");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const posts = Array.isArray(body?.posts) ? body.posts : [];
  return `${posts.length} artikel`;
});

await runCheck("Flash sale API", async () => {
  const { response, body } = await request("/api/flash-sales/current");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (response.headers.get("x-morgen-route") !== "flash-sale-v3") {
    throw new Error("route backend masih versi lama");
  }
  if (typeof body?.active !== "boolean" || !body?.serverTime) {
    throw new Error("format respons tidak valid");
  }
  if (body.temporarilyUnavailable === true) {
    throw new Error("Firestore flash sale masih tidak dapat dibaca");
  }
  if ((response.headers.get("cache-control") || "").toLowerCase().includes("no-store") === false) {
    throw new Error("respons belum memakai no-store");
  }
  if (body.active) {
    if (!body.sale?.id || !Array.isArray(body.sale?.prices)) {
      throw new Error("jadwal aktif tidak memiliki harga server");
    }
    return `aktif · ${body.sale.prices.length} harga`;
  }
  return "tidak ada jadwal aktif";
});

await runCheck("Reviews API", async () => {
  const { response, body } = await request("/api/testimoni");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reviews = Array.isArray(body?.reviews) ? body.reviews : [];
  return `${reviews.length} ulasan`;
});

await runCheck("Frontend /id", async () => {
  const { response, contentType, body } = await request("/id", { expect: "html" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!contentType.includes("text/html"))
    throw new Error(`content-type ${contentType || "kosong"}`);
  if (!body.includes('id="root"') && !body.includes("id='root'")) {
    throw new Error("root React tidak ditemukan");
  }
  const csp = response.headers.get("content-security-policy") || "";
  if (!csp.includes("https://static.cloudflareinsights.com")) {
    throw new Error("CSP belum mengizinkan Cloudflare Web Analytics");
  }
  const cacheControl = response.headers.get("cache-control") || "";
  if (!cacheControl.includes("no-transform")) {
    throw new Error("HTML belum mencegah injeksi RUM otomatis");
  }
  return "HTML tersedia · bfcache/no-transform aktif";
});

await runCheck("Manifest PWA", async () => {
  const { response } = await request("/manifest.json", { expect: "html" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return "tersedia";
});

await runCheck("Sampel gambar produk", async () => {
  const imagePaths = products
    .flatMap((product) => [product.image, ...(Array.isArray(product.images) ? product.images : [])])
    .filter(Boolean)
    .slice(0, 8);

  if (imagePaths.length === 0) throw new Error("tidak ada path gambar pada API");

  let available = 0;
  const failed = [];

  for (const imagePath of imagePaths) {
    let loaded = false;
    for (const candidate of productImageCandidates(imagePath)) {
      try {
        const response = await fetch(joinUrl(candidate), {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.ok) {
          loaded = true;
          available += 1;
          break;
        }
      } catch {
        // Lanjut ke kandidat berikutnya.
      }
    }
    if (!loaded) failed.push(imagePath);
  }

  if (failed.length > 0) {
    throw new Error(`${failed.length} gambar gagal, contoh: ${failed[0]}`);
  }
  return `${available} gambar tersedia`;
});

const failedCount = checks.filter((item) => !item.ok).length;
console.log(`\nHasil: ${checks.length - failedCount}/${checks.length} pemeriksaan berhasil.`);
process.exitCode = failedCount > 0 ? 1 : 0;
