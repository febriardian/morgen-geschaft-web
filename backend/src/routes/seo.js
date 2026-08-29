// routes/seo.js
// Crawler-only metadata, bilingual sitemap, and localized static-page metadata.

import { Router } from "express";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { log } from "../services/logger.js";

const router = Router();
const CRAWLER_UA =
  /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|googlebot|bingbot|applebot|yandex|pinterest|redditbot|duckduckbot|baiduspider|embedly|vkshare|w3c_validator|skypeuripreview/i;
const SUPPORTED_LOCALES = new Set(["id", "en"]);
const lookupCache = new Map();
const LOOKUP_CACHE_MS = 60_000;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function siteUrl() {
  return String(
    process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || "https://morgengeschaft.com"
  )
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");
}

function isCrawler(req) {
  return CRAWLER_UA.test(req.headers["user-agent"] || "");
}

function localeValue(record, field, locale) {
  if (!record) return "";
  const value = record[field];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value[locale] ?? value.id ?? value.en ?? "";
  }
  if (locale === "en") {
    return (
      record.translations?.en?.[field] ??
      record.i18n?.en?.[field] ??
      record[`${field}En`] ??
      record[`${field}_en`] ??
      value ??
      ""
    );
  }
  return value ?? "";
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function productPath(locale, slug) {
  return locale === "en" ? `/en/product/${slug}` : `/id/produk/${slug}`;
}

function blogPath(locale, slug) {
  return locale === "en" ? `/en/articles/${slug}` : `/id/artikel/${slug}`;
}

function absoluteAsset(baseUrl, value, fallback = "/photos/logo-512.png") {
  const source = String(value || fallback);
  if (/^https?:\/\//i.test(source)) return source.replace(/ /g, "%20");
  return `${baseUrl}${source.startsWith("/") ? source : `/${source}`}`.replace(/ /g, "%20");
}

function localizedHead({
  locale,
  title,
  description,
  canonicalPath,
  idPath,
  enPath,
  image,
  type = "website",
  extra = "",
}) {
  const baseUrl = siteUrl();
  const canonicalUrl = `${baseUrl}${canonicalPath}`;
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image || `${baseUrl}/photos/logo-512.png`);

  return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${safeTitle}</title><meta name="description" content="${safeDescription}"/><link rel="canonical" href="${escapeHtml(canonicalUrl)}"/><link rel="alternate" hreflang="id" href="${escapeHtml(`${baseUrl}${idPath}`)}"/><link rel="alternate" hreflang="en" href="${escapeHtml(`${baseUrl}${enPath}`)}"/><link rel="alternate" hreflang="x-default" href="${escapeHtml(`${baseUrl}${idPath}`)}"/><meta property="og:locale" content="${locale === "en" ? "en_US" : "id_ID"}"/><meta property="og:title" content="${safeTitle}"/><meta property="og:description" content="${safeDescription}"/><meta property="og:type" content="${type}"/><meta property="og:url" content="${escapeHtml(canonicalUrl)}"/><meta property="og:image" content="${safeImage}"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${safeTitle}"/><meta name="twitter:description" content="${safeDescription}"/><meta name="twitter:image" content="${safeImage}"/>${extra}<meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}"/></head><body><p>${locale === "en" ? "Redirecting..." : "Mengalihkan..."}</p></body></html>`;
}

// JSON-LD Product schema → hasil pencarian Google bisa menampilkan harga,
// ketersediaan, dan rating. Semua `<` di-escape agar tidak memutus tag <script>.
function jsonLdScript(data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function productJsonLd({
  name,
  description,
  image,
  canonicalUrl,
  price,
  inStock,
  sku,
  brandName,
  rating,
  reviewCount,
}) {
  const data = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name,
    image: image ? [image] : undefined,
    description: description || undefined,
    sku: sku || undefined,
    brand: { "@type": "Brand", name: brandName || "Morgen Geschäft" },
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: "IDR",
      price: String(Math.round(Number(price) || 0)),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
  // Hanya sertakan rating jika datanya nyata (kebijakan Google melarang rating palsu).
  const ratingValue = Number(rating);
  const ratingCount = Number(reviewCount);
  if (
    Number.isFinite(ratingValue) &&
    ratingValue > 0 &&
    Number.isFinite(ratingCount) &&
    ratingCount > 0
  ) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: ratingValue.toFixed(1),
      reviewCount: String(ratingCount),
    };
  }
  return jsonLdScript(data);
}

async function findProductBySlug(slug) {
  const cacheKey = `product:${slug}`;
  const cached = lookupCache.get(cacheKey);
  if (cached && Date.now() - cached.at < LOOKUP_CACHE_MS) return cached.value;
  const db = getAdminDb();
  const parts = String(slug || "")
    .split("-")
    .filter(Boolean);
  const candidates = [slug, parts.at(-1), parts.slice(-2).join("-")].filter(Boolean);
  for (const id of [...new Set(candidates)]) {
    const snapshot = await db.collection("products").doc(id).get();
    if (snapshot.exists) {
      const value = { id: snapshot.id, ...snapshot.data() };
      lookupCache.set(cacheKey, { at: Date.now(), value });
      return value;
    }
  }
  lookupCache.set(cacheKey, { at: Date.now(), value: null });
  return null;
}

async function findBlogBySlug(slug) {
  const cacheKey = `blog:${slug}`;
  const cached = lookupCache.get(cacheKey);
  if (cached && Date.now() - cached.at < LOOKUP_CACHE_MS) return cached.value;
  const db = getAdminDb();
  const parts = String(slug || "")
    .split("-")
    .filter(Boolean);
  const candidates = [slug, parts.slice(-2).join("-"), parts.at(-1)].filter(Boolean);
  for (const id of [...new Set(candidates)]) {
    const snapshot = await db.collection("blogs").doc(id).get();
    if (snapshot.exists) {
      const value = { id: snapshot.id, ...snapshot.data() };
      lookupCache.set(cacheKey, { at: Date.now(), value });
      return value;
    }
  }
  lookupCache.set(cacheKey, { at: Date.now(), value: null });
  return null;
}

function sendNotFound(res, locale = "id") {
  const isEnglish = locale === "en";
  return res.status(404).type("html").send(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404 — Morgen Geschäft</title></head><body><main><h1>${isEnglish ? "Page not found" : "Halaman tidak ditemukan"}</h1><p><a href="/${locale}">${isEnglish ? "Back to Morgen Geschäft" : "Kembali ke Morgen Geschäft"}</a></p></main></body></html>`);
}

async function sendProductMeta(req, res, next, locale) {
  try {
    const product = await findProductBySlug(req.params.slug);
    if (!product) return sendNotFound(res, locale);
    if (!isCrawler(req)) return next();

    const currentLocale = SUPPORTED_LOCALES.has(locale) ? locale : "id";
    const idName = localeValue(product, "name", "id") || product.id;
    const enName = localeValue(product, "name", "en") || idName;
    const idSlug = `${slugify(idName)}-${product.id}`;
    const enSlug = `${slugify(enName)}-${product.id}`;
    const currentName = currentLocale === "en" ? enName : idName;
    const currentDescription = localeValue(product, "blurb", currentLocale);
    const price = `Rp${Number(product.price || 0).toLocaleString("id-ID")}`;
    const baseUrl = siteUrl();
    const image = absoluteAsset(baseUrl, product.image);
    const idPath = productPath("id", idSlug);
    const enPath = productPath("en", enSlug);
    const canonicalPath = currentLocale === "en" ? enPath : idPath;
    const canonicalUrl = `${baseUrl}${canonicalPath}`;
    const inStock = Number(product.stock || 0) > 0;

    const jsonLd = productJsonLd({
      name: currentName,
      description: currentDescription,
      image,
      canonicalUrl,
      price: product.price,
      inStock,
      sku: product.id,
      brandName: product.brand,
      rating: product.rating ?? product.ratingAverage,
      reviewCount: product.reviewCount ?? product.ratingCount,
    });

    res.type("html").send(
      localizedHead({
        locale: currentLocale,
        title: `${currentName} — ${price} — Morgen Geschäft`,
        description: currentDescription,
        canonicalPath,
        idPath,
        enPath,
        image,
        type: "product",
        extra: `<meta property="product:price:amount" content="${Number(product.price || 0)}"/><meta property="product:price:currency" content="IDR"/><meta property="product:availability" content="${inStock ? "in stock" : "out of stock"}"/>${jsonLd}`,
      })
    );
  } catch (error) {
    log("error", "seo", "SEO product error", { error: error.message });
    next();
  }
}

async function sendBlogMeta(req, res, next, locale) {
  try {
    const blog = await findBlogBySlug(req.params.slug);
    if (!blog) return sendNotFound(res, locale);
    if (!isCrawler(req)) return next();

    const currentLocale = SUPPORTED_LOCALES.has(locale) ? locale : "id";
    const idTitle = localeValue(blog, "title", "id") || blog.id;
    const enTitle = localeValue(blog, "title", "en") || idTitle;
    const idSlug = `${slugify(idTitle)}-${blog.id}`;
    const enSlug = `${slugify(enTitle)}-${blog.id}`;
    const currentTitle = currentLocale === "en" ? enTitle : idTitle;
    const currentDescription = localeValue(blog, "excerpt", currentLocale);
    const baseUrl = siteUrl();
    const image = absoluteAsset(baseUrl, blog.coverImage || blog.image);
    const idPath = blogPath("id", idSlug);
    const enPath = blogPath("en", enSlug);
    const canonicalPath = currentLocale === "en" ? enPath : idPath;

    res.type("html").send(
      localizedHead({
        locale: currentLocale,
        title: `${currentTitle} — Morgen Geschäft`,
        description: currentDescription,
        canonicalPath,
        idPath,
        enPath,
        image,
        type: "article",
      })
    );
  } catch (error) {
    log("error", "seo", "SEO blog error", { error: error.message });
    next();
  }
}

router.get("/id/produk/:slug", (req, res, next) => sendProductMeta(req, res, next, "id"));
router.get("/en/product/:slug", (req, res, next) => sendProductMeta(req, res, next, "en"));
router.get("/produk/:slug", (req, res, next) => sendProductMeta(req, res, next, "id"));
router.get("/id/artikel/:slug", (req, res, next) => sendBlogMeta(req, res, next, "id"));
router.get("/en/articles/:slug", (req, res, next) => sendBlogMeta(req, res, next, "en"));
router.get("/blog/:slug", (req, res, next) => sendBlogMeta(req, res, next, "id"));

const CATALOG_CATEGORY_PAIRS = [
  { idSlug: "face-wash", enSlug: "face-wash", idName: "Face Wash", enName: "Face Wash" },
  { idSlug: "body-wash", enSlug: "body-wash", idName: "Body Wash", enName: "Body Wash" },
  { idSlug: "sunscreen", enSlug: "sunscreen", idName: "Sunscreen", enName: "Sunscreen" },
  { idSlug: "serum", enSlug: "serum", idName: "Serum", enName: "Serum" },
  { idSlug: "bundle", enSlug: "bundles", idName: "Bundle Hemat", enName: "Value Bundles" },
];

const BLOG_CATEGORY_PAIRS = [
  {
    idSlug: "panduan-skincare",
    enSlug: "skincare-guides",
    idName: "Panduan Skincare",
    enName: "Skincare Guides",
  },
  {
    idSlug: "bahan-aktif",
    enSlug: "active-ingredients",
    idName: "Bahan Aktif",
    enName: "Active Ingredients",
  },
  {
    idSlug: "perawatan-harian",
    enSlug: "daily-care",
    idName: "Perawatan Harian",
    enName: "Daily Care",
  },
  {
    idSlug: "berita-produk",
    enSlug: "product-news",
    idName: "Berita Produk",
    enName: "Product News",
  },
];

function sendCategoryMeta(req, res, next, { locale, type }) {
  if (!isCrawler(req)) return next();
  const baseUrl = siteUrl();
  const category = String(req.params.category || "").toLowerCase();
  const isCatalog = type === "catalog";
  const pairs = isCatalog ? CATALOG_CATEGORY_PAIRS : BLOG_CATEGORY_PAIRS;
  const pair = pairs.find((item) => item[locale === "en" ? "enSlug" : "idSlug"] === category);
  if (!pair) return next();

  const currentName = locale === "en" ? pair.enName : pair.idName;
  const idPath = isCatalog ? `/id/katalog/${pair.idSlug}` : `/id/artikel/kategori/${pair.idSlug}`;
  const enPath = isCatalog ? `/en/catalog/${pair.enSlug}` : `/en/articles/category/${pair.enSlug}`;
  const canonicalPath = locale === "en" ? enPath : idPath;
  const title = isCatalog
    ? `${currentName} — ${locale === "en" ? "Product Catalog" : "Katalog Produk"} — Morgen Geschäft`
    : `${currentName} — ${locale === "en" ? "Skincare Articles" : "Artikel Skincare"} — Morgen Geschäft`;
  const description = isCatalog
    ? locale === "en"
      ? `Browse authentic ${currentName.toLowerCase()} products with clear ingredients and skin-type information.`
      : `Temukan produk ${currentName.toLowerCase()} original dengan informasi bahan aktif dan jenis kulit yang jelas.`
    : locale === "en"
      ? `Read Morgen Geschäft articles about ${currentName.toLowerCase()}.`
      : `Baca artikel Morgen Geschäft seputar ${currentName.toLowerCase()}.`;

  res.type("html").send(
    localizedHead({
      locale,
      title,
      description,
      canonicalPath,
      idPath,
      enPath,
      image: `${baseUrl}/photos/logo-512.png`,
    })
  );
}

const STATIC_PAIRS = [
  {
    id: {
      path: "/id",
      title: "Morgen Geschäft — Skincare Original",
      desc: "Belanja skincare original dengan informasi produk yang jelas.",
    },
    en: {
      path: "/en",
      title: "Morgen Geschäft — Authentic Skincare",
      desc: "Shop authentic skincare with clear product information.",
    },
    priority: "1.0",
    changefreq: "daily",
  },
  {
    id: {
      path: "/id/katalog",
      title: "Katalog Produk — Morgen Geschäft",
      desc: "Pilihan produk skincare original dengan informasi bahan aktif dan jenis kulit.",
    },
    en: {
      path: "/en/catalog",
      title: "Product Catalog — Morgen Geschäft",
      desc: "Browse authentic skincare with active-ingredient and skin-type information.",
    },
    priority: "0.9",
    changefreq: "daily",
  },
  {
    id: {
      path: "/id/kuis-tipe-kulit",
      title: "Kuis Tipe Kulit — Morgen Geschäft",
      desc: "Jawab lima pertanyaan nonmedis dan temukan produk yang sedang tersedia sesuai kebutuhan dasar kulitmu.",
    },
    en: {
      path: "/en/skin-type-quiz",
      title: "Skin Type Quiz — Morgen Geschäft",
      desc: "Answer five non-medical questions and find currently available products for your skin's basic needs.",
    },
    priority: "0.7",
    changefreq: "weekly",
  },
  {
    id: {
      path: "/id/ulasan",
      title: "Ulasan Pelanggan — Morgen Geschäft",
      desc: "Baca pengalaman pelanggan Morgen Geschäft dengan produk skincare original.",
    },
    en: {
      path: "/en/reviews",
      title: "Customer Reviews — Morgen Geschäft",
      desc: "Read customer experiences with authentic skincare from Morgen Geschäft.",
    },
    priority: "0.6",
    changefreq: "weekly",
  },
  {
    id: {
      path: "/id/faq",
      title: "FAQ — Morgen Geschäft",
      desc: "Pertanyaan umum seputar produk, pesanan, pembayaran, dan pengiriman.",
    },
    en: {
      path: "/en/faq",
      title: "FAQ — Morgen Geschäft",
      desc: "Common questions about products, orders, payments, and shipping.",
    },
    priority: "0.5",
    changefreq: "monthly",
  },
  {
    id: {
      path: "/id/artikel",
      title: "Artikel Skincare — Morgen Geschäft",
      desc: "Tips dan panduan skincare dari Morgen Geschäft.",
    },
    en: {
      path: "/en/articles",
      title: "Skincare Articles — Morgen Geschäft",
      desc: "Skincare tips and guides from Morgen Geschäft.",
    },
    priority: "0.7",
    changefreq: "weekly",
  },
  {
    id: {
      path: "/id/kebijakan-privasi",
      title: "Kebijakan Privasi — Morgen Geschäft",
      desc: "Kebijakan privasi dan perlindungan data pelanggan Morgen Geschäft.",
    },
    en: {
      path: "/en/privacy-policy",
      title: "Privacy Policy — Morgen Geschäft",
      desc: "Privacy and customer-data protection policy for Morgen Geschäft.",
    },
    priority: "0.3",
    changefreq: "yearly",
  },
  {
    id: {
      path: "/id/syarat-ketentuan",
      title: "Syarat & Ketentuan — Morgen Geschäft",
      desc: "Syarat dan ketentuan penggunaan layanan Morgen Geschäft.",
    },
    en: {
      path: "/en/terms-and-conditions",
      title: "Terms & Conditions — Morgen Geschäft",
      desc: "Terms for using Morgen Geschäft services.",
    },
    priority: "0.3",
    changefreq: "yearly",
  },
  {
    id: {
      path: "/id/install",
      title: "Install Aplikasi — Morgen Geschäft",
      desc: "Install Morgen Geschäft di layar utama untuk akses lebih cepat.",
    },
    en: {
      path: "/en/install",
      title: "Install App — Morgen Geschäft",
      desc: "Install Morgen Geschäft on your home screen for faster access.",
    },
    priority: "0.4",
    changefreq: "monthly",
  },
];

router.get("/", (req, res, next) => {
  if (!isCrawler(req)) return next();
  const pair = STATIC_PAIRS[0];
  res.type("html").send(
    localizedHead({
      locale: "id",
      title: pair.id.title,
      description: pair.id.desc,
      canonicalPath: pair.id.path,
      idPath: pair.id.path,
      enPath: pair.en.path,
      image: `${siteUrl()}/photos/logo-512.png`,
    })
  );
});

router.get("/id/katalog/:category", (req, res, next) =>
  sendCategoryMeta(req, res, next, { locale: "id", type: "catalog" })
);
router.get("/en/catalog/:category", (req, res, next) =>
  sendCategoryMeta(req, res, next, { locale: "en", type: "catalog" })
);
router.get("/id/artikel/kategori/:category", (req, res, next) =>
  sendCategoryMeta(req, res, next, { locale: "id", type: "blog" })
);
router.get("/en/articles/category/:category", (req, res, next) =>
  sendCategoryMeta(req, res, next, { locale: "en", type: "blog" })
);

for (const pair of STATIC_PAIRS) {
  for (const locale of ["id", "en"]) {
    const meta = pair[locale];
    router.get(meta.path, (req, res, next) => {
      if (!isCrawler(req)) return next();
      res.type("html").send(
        localizedHead({
          locale,
          title: meta.title,
          description: meta.desc,
          canonicalPath: meta.path,
          idPath: pair.id.path,
          enPath: pair.en.path,
          image: `${siteUrl()}/photos/logo-512.png`,
        })
      );
    });
  }
}

router.get("/sitemap.xml", async (_req, res) => {
  const baseUrl = siteUrl();
  const pairs = STATIC_PAIRS.map((pair) => ({
    id: pair.id.path,
    en: pair.en.path,
    priority: pair.priority,
    changefreq: pair.changefreq,
  }));

  CATALOG_CATEGORY_PAIRS.forEach((pair) => {
    pairs.push({
      id: `/id/katalog/${pair.idSlug}`,
      en: `/en/catalog/${pair.enSlug}`,
      priority: "0.7",
      changefreq: "weekly",
    });
  });
  BLOG_CATEGORY_PAIRS.forEach((pair) => {
    pairs.push({
      id: `/id/artikel/kategori/${pair.idSlug}`,
      en: `/en/articles/category/${pair.enSlug}`,
      priority: "0.5",
      changefreq: "monthly",
    });
  });

  try {
    const db = getAdminDb();
    const [productsSnapshot, blogsSnapshot] = await Promise.all([
      db.collection("products").get(),
      db.collection("blogs").orderBy("date", "desc").get(),
    ]);

    for (const document of productsSnapshot.docs) {
      const product = { id: document.id, ...document.data() };
      if (product.isArchived) continue;
      const idName = localeValue(product, "name", "id") || product.id;
      const enName = localeValue(product, "name", "en") || idName;
      pairs.push({
        id: productPath("id", `${slugify(idName)}-${product.id}`),
        en: productPath("en", `${slugify(enName)}-${product.id}`),
        priority: "0.8",
        changefreq: "weekly",
      });
    }

    for (const document of blogsSnapshot.docs) {
      const blog = { id: document.id, ...document.data() };
      if (blog.status === "draft") continue;
      const idTitle = localeValue(blog, "title", "id") || blog.id;
      const enTitle = localeValue(blog, "title", "en") || idTitle;
      pairs.push({
        id: blogPath("id", `${slugify(idTitle)}-${blog.id}`),
        en: blogPath("en", `${slugify(enTitle)}-${blog.id}`),
        priority: "0.6",
        changefreq: "monthly",
      });
    }
  } catch (error) {
    log("error", "sitemap", "Failed to fetch dynamic pages", { error: error.message });
  }

  const entries = pairs.flatMap((pair) => [
    { loc: pair.id, locale: "id", alternateId: pair.id, alternateEn: pair.en, ...pair },
    { loc: pair.en, locale: "en", alternateId: pair.id, alternateEn: pair.en, ...pair },
  ]);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map((entry) => `  <url><loc>${escapeHtml(`${baseUrl}${entry.loc}`)}</loc><xhtml:link rel="alternate" hreflang="id" href="${escapeHtml(`${baseUrl}${entry.alternateId}`)}"/><xhtml:link rel="alternate" hreflang="en" href="${escapeHtml(`${baseUrl}${entry.alternateEn}`)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(`${baseUrl}${entry.alternateId}`)}"/><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`).join("\n")}
</urlset>`;

  res.type("application/xml").send(xml);
});

export default router;
