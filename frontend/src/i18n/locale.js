export const SUPPORTED_LOCALES = ["id", "en"];
export const DEFAULT_LOCALE = "id";
export const LOCALE_STORAGE_KEY = "mg_locale";

const ROUTE_SEGMENTS = {
  id: {
    product: "produk",
    catalog: "katalog",
    reviews: "ulasan",
    faq: "faq",
    skinQuiz: "kuis-tipe-kulit",
    blog: "artikel",
    blogCategory: "kategori",
    privacy: "kebijakan-privasi",
    terms: "syarat-ketentuan",
    install: "install",
  },
  en: {
    product: "product",
    catalog: "catalog",
    reviews: "reviews",
    faq: "faq",
    skinQuiz: "skin-type-quiz",
    blog: "articles",
    blogCategory: "category",
    privacy: "privacy-policy",
    terms: "terms-and-conditions",
    install: "install",
  },
};

const CATEGORY_SLUGS = {
  id: {
    semua: "",
    facewash: "face-wash",
    bodywash: "body-wash",
    sunscreen: "sunscreen",
    serum: "serum",
    bundle: "bundle",
  },
  en: {
    semua: "",
    facewash: "face-wash",
    bodywash: "body-wash",
    sunscreen: "sunscreen",
    serum: "serum",
    bundle: "bundles",
  },
};

const BLOG_CATEGORY_SLUGS = {
  id: {
    "panduan-skincare": "panduan-skincare",
    "bahan-aktif": "bahan-aktif",
    "perawatan-harian": "perawatan-harian",
    "berita-produk": "berita-produk",
  },
  en: {
    "panduan-skincare": "skincare-guides",
    "bahan-aktif": "active-ingredients",
    "perawatan-harian": "daily-care",
    "berita-produk": "product-news",
  },
};

const SECTION_HASHES = {
  id: {
    katalog: "katalog",
    promo: "promo",
    tentang: "tentang",
    lacak: "lacak",
    faq: "faq",
    blog: "artikel",
    kontak: "kontak",
  },
  en: {
    katalog: "catalog",
    promo: "promotions",
    tentang: "about",
    lacak: "track-order",
    faq: "faq",
    blog: "articles",
    kontak: "contact",
  },
};

export function normalizeLocale(value) {
  const locale = String(value || "").toLowerCase();
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

export function getStoredLocale() {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function getLocaleFromPath(pathname) {
  const first = String(pathname || "/")
    .split("/")
    .filter(Boolean)[0];
  return SUPPORTED_LOCALES.includes(first) ? first : null;
}

export function categorySlug(locale, categoryId) {
  return (
    CATEGORY_SLUGS[normalizeLocale(locale)]?.[categoryId] ?? CATEGORY_SLUGS.id[categoryId] ?? ""
  );
}

export function categoryIdFromSlug(locale, slug) {
  const normalized = decodeURIComponent(String(slug || "")).replace(/^\/+|\/+$/g, "");
  const table = CATEGORY_SLUGS[normalizeLocale(locale)] || CATEGORY_SLUGS.id;
  return Object.entries(table).find(([, value]) => value === normalized)?.[0] || "semua";
}

export function blogCategorySlug(locale, categoryId) {
  return (
    BLOG_CATEGORY_SLUGS[normalizeLocale(locale)]?.[categoryId] ??
    BLOG_CATEGORY_SLUGS.id[categoryId] ??
    categoryId
  );
}

export function blogCategoryIdFromSlug(locale, slug) {
  const normalized = decodeURIComponent(String(slug || "")).replace(/^\/+|\/+$/g, "");
  const table = BLOG_CATEGORY_SLUGS[normalizeLocale(locale)] || BLOG_CATEGORY_SLUGS.id;
  return (
    Object.entries(table).find(([, value]) => value === normalized)?.[0] || normalized || "semua"
  );
}

export function localizedSectionHash(locale, internalSectionId) {
  return SECTION_HASHES[normalizeLocale(locale)]?.[internalSectionId] || internalSectionId;
}

export function internalSectionId(locale, localizedHash) {
  const hash = decodeURIComponent(String(localizedHash || "")).replace(/^#/, "");
  if (!hash) return "";
  const table = SECTION_HASHES[normalizeLocale(locale)] || SECTION_HASHES.id;
  return Object.entries(table).find(([, value]) => value === hash)?.[0] || hash;
}

export function routePath(locale, routeKey, params = {}) {
  const lang = normalizeLocale(locale);
  const segments = ROUTE_SEGMENTS[lang];
  const prefix = `/${lang}`;

  switch (routeKey) {
    case "home":
      return prefix;
    case "product":
      return `${prefix}/${segments.product}/${encodeURIComponent(params.id || "")}`;
    case "catalog": {
      const slug = params.categoryId ? categorySlug(lang, params.categoryId) : "";
      return slug ? `${prefix}/${segments.catalog}/${slug}` : `${prefix}/${segments.catalog}`;
    }
    case "reviews":
      return `${prefix}/${segments.reviews}`;
    case "faq":
      return `${prefix}/${segments.faq}`;
    case "skinQuiz":
      return `${prefix}/${segments.skinQuiz}`;
    case "blog":
      return `${prefix}/${segments.blog}`;
    case "blogCategory":
      return `${prefix}/${segments.blog}/${segments.blogCategory}/${blogCategorySlug(lang, params.categoryId || "semua")}`;
    case "blogDetail":
      return `${prefix}/${segments.blog}/${encodeURIComponent(params.blogId || "")}`;
    case "privacy":
      return `${prefix}/${segments.privacy}`;
    case "terms":
      return `${prefix}/${segments.terms}`;
    case "install":
      return `${prefix}/${segments.install}`;
    default:
      return prefix;
  }
}

export function parseLocalizedPath(pathname) {
  const clean = `/${String(pathname || "/").replace(/^\/+|\/+$/g, "")}`;
  const parts = clean.split("/").filter(Boolean);
  const locale = SUPPORTED_LOCALES.includes(parts[0]) ? parts[0] : null;
  if (!locale) return { locale: null, key: "legacy", params: {}, pathname: clean };

  const segments = ROUTE_SEGMENTS[locale];
  const rest = parts.slice(1);
  if (rest.length === 0) return { locale, key: "home", params: {} };

  if (rest[0] === segments.product && rest[1]) {
    return { locale, key: "product", params: { id: decodeURIComponent(rest.slice(1).join("/")) } };
  }
  if (rest[0] === segments.catalog) {
    return {
      locale,
      key: "catalog",
      params: { categoryId: categoryIdFromSlug(locale, rest[1] || "") },
    };
  }
  if (rest[0] === segments.reviews) return { locale, key: "reviews", params: {} };
  if (rest[0] === segments.faq) return { locale, key: "faq", params: {} };
  if (rest[0] === segments.skinQuiz) return { locale, key: "skinQuiz", params: {} };
  if (rest[0] === segments.blog) {
    if (rest[1] === segments.blogCategory && rest[2]) {
      return {
        locale,
        key: "blogCategory",
        params: { categoryId: blogCategoryIdFromSlug(locale, rest[2]) },
      };
    }
    if (rest[1]) {
      return {
        locale,
        key: "blogDetail",
        params: { blogId: decodeURIComponent(rest.slice(1).join("/")) },
      };
    }
    return { locale, key: "blog", params: {} };
  }
  if (rest[0] === segments.privacy) return { locale, key: "privacy", params: {} };
  if (rest[0] === segments.terms) return { locale, key: "terms", params: {} };
  if (rest[0] === segments.install) return { locale, key: "install", params: {} };
  return { locale, key: "notFound", params: {} };
}

export function switchLocalePath(pathname, targetLocale, hash = "") {
  const target = normalizeLocale(targetLocale);
  const info = parseLocalizedPath(pathname);
  let nextPath;

  if (!info.locale || info.key === "legacy" || info.key === "notFound") {
    const stripped = String(pathname || "/").replace(/^\/(id|en)(?=\/|$)/, "");
    nextPath =
      stripped === "/"
        ? routePath(target, "home")
        : `/${target}${stripped.startsWith("/") ? stripped : `/${stripped}`}`;
  } else {
    nextPath = routePath(target, info.key, info.params);
  }

  const currentLocale = info.locale || DEFAULT_LOCALE;
  const currentInternalHash = internalSectionId(currentLocale, hash);
  const nextHash = currentInternalHash
    ? `#${localizedSectionHash(target, currentInternalHash)}`
    : "";
  return `${nextPath}${nextHash}`;
}

const PRODUCT_EN = {
  b1: {
    name: "Acne Care Starter Kit",
    tag: "BUNDLE · SAVE 15%",
    blurb:
      "A complete acne care set with face wash and B5 acne serum. Save 15% compared with buying each item separately.",
  },
  b2: {
    name: "Daily Protection Set",
    tag: "BUNDLE · SAVE 10%",
    blurb:
      "A gentle cleanser and SPF 40 sunscreen. This practical duo supports daily protection and saves you IDR 6,000.",
  },
  p1: {
    name: "Kahf Oil and Acne Care Face Wash",
    blurb:
      "A men's facial cleanser for oily skin that is prone to acne. It helps remove excess oil and cleanse the pores.",
  },
  p1782544937735: {
    name: "Kahf Acne and Pore Cleanse",
    blurb:
      "A gentle facial scrub with salicylic acid that helps lift dead skin cells, cleanse pores, and calm breakouts.",
  },
  p2: {
    name: "Kahf Energizing and Brightening Face Wash",
    blurb:
      "Refreshes skin that looks tired and dull. The cooling sensation leaves the face feeling more energized.",
  },
  p3: {
    name: "Kahf Bright Revitalizing AminoGel",
    blurb:
      "A gentle cleansing gel with amino acids and vitamin C. It helps brighten the skin without stripping away moisture.",
  },
  p4: {
    name: "Kahf Triple Action Oil and Comedo Defense",
    blurb:
      "A charcoal formula with three benefits. It helps remove comedones, control excess oil, and keep pores clean.",
  },
  p5: {
    name: "Somethinc Low pH Gentle Jelly Cleanser",
    blurb:
      "A gentle jelly cleanser with a low pH. It helps maintain skin balance without leaving the face dry or tight.",
  },
  p6: {
    name: "Wardah Crystal Secret Facewash",
    blurb:
      "A daily cleanser that helps reduce dullness and maintain a more even and radiant complexion.",
  },
  p7: {
    name: "Kahf Body Wash Relaxing and Acne Fight",
    blurb:
      "A men's body wash that helps care for body acne while providing a relaxing shower experience.",
  },
  p8: {
    name: "Implora Perfect Shield Sunscreen SPF 40 PA++++",
    blurb:
      "A lightweight, affordable sunscreen that protects against UVA and UVB without feeling sticky.",
  },
  p9: {
    name: "The Originote Acne B5 Serum",
    blurb:
      "A daily panthenol serum that helps soothe redness and support the skin barrier for skin that is prone to acne.",
  },
};

const BLOG_EN = {
  "blog-1": {
    title: "The Correct Skincare Order for Beginners",
    excerpt:
      "Not sure where to start? Follow this simple skincare order to build an effective routine.",
    readTime: "3 min read",
    tags: ["basic skincare", "beginners"],
    content: `Many beginners buy several skincare products without knowing the right order. Applying them in the correct sequence helps each active ingredient work more effectively.

**1. Cleanser**
Always start with clean skin. Choose a gel cleanser for oily skin. A jelly or cream cleanser is usually more comfortable for dry or sensitive skin.

**2. Serum or Treatment**
Serums contain concentrated active ingredients. Salicylic acid or niacinamide can support acne care. Hyaluronic acid is a useful option when the skin needs hydration.

**3. Moisturizer**
Moisturizer locks in hydration and supports the skin barrier. Oily skin still needs this step.

**4. Sunscreen in the Morning**
UV protection is one of the most effective ways to reduce early signs of aging. Use at least SPF 30 and reapply every 2–3 hours when you are outdoors.

Tip: start with only two products, a cleanser and sunscreen. Add a serum after two or three weeks once your skin is comfortable with the routine.`,
  },
  "blog-2": {
    title: "Salicylic Acid vs Niacinamide: Which One Do You Need?",
    excerpt:
      "Both are popular for acne care, but they work differently. Here is how to choose the right one.",
    readTime: "4 min read",
    tags: ["active ingredients", "acne care"],
    content: `Both ingredients are commonly used for acne care, but they support the skin in different ways.

**Salicylic Acid (BHA)**
- It dissolves in oil, so it can work inside the pores
- It is suitable for blackheads, whiteheads, and oily skin
- A common concentration is 0.5–2%
- Frequent use may leave the skin feeling dry

**Niacinamide (Vitamin B3)**
- It helps calm redness and irritation
- It supports sebum control without making the skin feel excessively dry
- It helps strengthen the skin barrier
- A common concentration is 2–10%
- Most skin types tolerate it well

**Which one should you choose?**
- Choose salicylic acid when comedones and visible pores are the main concern
- Choose niacinamide when the skin is sensitive or acne looks inflamed
- Both ingredients can be used in one routine. For example, use niacinamide in the morning and salicylic acid at night

Several products at Morgen Geschäft combine both ingredients in balanced formulas.`,
  },
  "blog-3": {
    title: "Why Sunscreen Is Essential, Even Indoors",
    excerpt:
      "UVA can pass through windows. This is why dermatologists consider sunscreen an essential daily step.",
    readTime: "4 min read",
    tags: ["sunscreen", "UV protection"],
    content: `Many people skip sunscreen when staying indoors. However, UVA is associated with premature aging and hyperpigmentation, and it can pass through window glass.

**Facts people often overlook**
- Window glass blocks much of UVB, but it does not block all UVA
- Blue light from phones and laptops may contribute to skin stress, although its effect is much smaller than UV exposure
- UV damage builds over time and may become visible years later

**How to choose sunscreen**
- SPF 30 is suitable for everyday use, while SPF 50 is useful for longer outdoor activity
- PA++++ indicates a high level of UVA protection
- Chemical sunscreen often feels lighter. Mineral sunscreen may feel more comfortable on sensitive skin
- Reapply every 2–3 hours during direct sun exposure

Sunscreen is one of the most valuable skincare products for long term care. Its benefits become clearer over time.`,
  },
};

const LOCALIZABLE_FIELDS = [
  "name",
  "tag",
  "blurb",
  "title",
  "excerpt",
  "content",
  "description",
  "label",
  "readTime",
  "seoTitle",
  "seoDescription",
  "benefit",
  "usage",
];

function localizedField(record, field, locale, fallbackRecord) {
  if (!record) return "";
  if (locale === "id") {
    const value = record[field];
    if (value && typeof value === "object" && !Array.isArray(value))
      return value.id ?? value.en ?? "";
    return value ?? "";
  }

  const nestedValue = record[field];
  if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
    return nestedValue.en ?? nestedValue.id ?? "";
  }

  const translations = record.translations?.en || record.i18n?.en || null;
  const candidates = [
    translations?.[field],
    record[`${field}En`],
    record[`${field}_en`],
    fallbackRecord?.[field],
    record[field],
  ];
  return candidates.find((value) => value !== undefined && value !== null && value !== "") ?? "";
}

export function localizeRecord(record, locale, type = "generic") {
  if (!record || typeof record !== "object") return record;
  const lang = normalizeLocale(locale);
  const fallback =
    type === "product" ? PRODUCT_EN[record.id] : type === "blog" ? BLOG_EN[record.id] : null;
  const localized = { ...record, _raw: record, locale: lang };

  LOCALIZABLE_FIELDS.forEach((field) => {
    if (
      field in record ||
      fallback?.[field] !== undefined ||
      record[`${field}En`] !== undefined ||
      record[`${field}_en`] !== undefined
    ) {
      localized[field] = localizedField(record, field, lang, fallback);
    }
  });

  if (Array.isArray(record.ingredients)) {
    const ingredientsEn =
      record.ingredientsEn || record.ingredients_en || record.translations?.en?.ingredients;
    localized.ingredients =
      lang === "en" && Array.isArray(ingredientsEn) ? ingredientsEn : record.ingredients;
  }
  if (Array.isArray(record.tags)) {
    const tagsEn =
      record.tagsEn || record.tags_en || record.translations?.en?.tags || fallback?.tags;
    localized.tags = lang === "en" && Array.isArray(tagsEn) ? tagsEn : record.tags;
  }
  if (Array.isArray(record.bundleItems)) localized.bundleItems = [...record.bundleItems];
  return localized;
}

export function rawRecord(record) {
  return record?._raw || record;
}

export const UI_COPY = {
  id: {
    routeLoading: "Memuat halaman...",
    adminLoading: "Memuat dashboard admin...",
    skipCatalog: "Langsung ke katalog",
    switchLanguage: "Pilih bahasa",
  },
  en: {
    routeLoading: "Loading page...",
    adminLoading: "Loading admin dashboard...",
    skipCatalog: "Skip to catalog",
    switchLanguage: "Choose language",
  },
};

const EXACT_EN = new Map(
  Object.entries({
    "Memuat halaman...": "Loading page...",
    "Memuat dashboard admin...": "Loading admin dashboard...",
    "Menyiapkan halaman": "Preparing page",
    "Menyiapkan semua produk": "Preparing all products",
    "Menyiapkan ulasan": "Preparing reviews",
    "Menyiapkan FAQ": "Preparing FAQ",
    "Menyiapkan kuis tipe kulit": "Preparing skin type quiz",
    "Menyiapkan artikel": "Preparing articles",
    "Membuka artikel": "Opening article",
    "Mengembalikan halaman terakhir": "Returning to the last page",
    "Mengembalikan halaman": "Returning to the page",
    "Langsung ke katalog": "Skip to catalog",
    Katalog: "Catalog",
    "Semua Produk": "All Products",
    "Semua produk": "All products",
    Produk: "Products",
    Promo: "Promotions",
    "Semua Promo": "All Promotions",
    "Kode Kupon": "Coupon Codes",
    "Promo Pembeli Baru": "New Customer Offers",
    "Bundle Hemat": "Value Bundles",
    "Aktifkan Notifikasi Promo": "Enable Promotion Notifications",
    "Notifikasi Promo Aktif": "Promotion Notifications On",
    "Notifikasi sudah aktif": "Notifications are already enabled",
    "Dapatkan kabar promo terbaru": "Get the latest promotion updates",
    Ulasan: "Reviews",
    "Semua Ulasan": "All Reviews",
    "Ulasan Produk": "Product Reviews",
    "Tulis Ulasan": "Write a Review",
    "Tulis ulasan": "Write a review",
    "Pengalaman pelanggan Morgen Geschäft": "Experiences shared by Morgen Geschäft customers",
    "Buka produk untuk melihat ulasan detail": "Open a product to read detailed reviews",
    "Bagikan pengalaman menggunakan produk": "Share your product experience",
    Artikel: "Articles",
    "Semua Artikel": "All Articles",
    Terbaru: "Latest",
    "Baca artikel terbaru": "Read the latest article",
    "Panduan Skincare": "Skincare Guides",
    "Bahan Aktif": "Active Ingredients",
    "Perawatan Harian": "Daily Care",
    "Berita Produk": "Product News",
    "Tentang Kami": "About Us",
    Lainnya: "More",
    "Kuis Tipe Kulit": "Skin Type Quiz",
    "Temukan produk sesuai kebutuhan dasar kulit": "Find products for your skin's basic needs",
    "Lacak Pesanan": "Track Order",
    Kontak: "Contact",
    Menu: "Menu",
    "Pilih halaman atau kategori": "Choose a page or category",
    "Tutup menu": "Close menu",
    "Buka menu": "Open menu",
    "Cari produk...": "Search products...",
    "Cari produk": "Search products",
    "Cari nama atau bahan aktif...": "Search by name or active ingredient...",
    "Cari produk atau bahan aktif": "Search products or active ingredients",
    "HASIL PENCARIAN": "SEARCH RESULTS",
    "Tidak ada produk yang sesuai filter.": "No products match the selected filters.",
    "Coba gunakan kata kunci lain atau hapus filter yang sedang aktif.":
      "Try another keyword or remove the active filters.",
    "Reset filter": "Reset filters",
    "Urutan default": "Default order",
    "Harga termurah": "Lowest price",
    "Harga termahal": "Highest price",
    "Stok terbanyak": "Highest stock",
    "Semua harga": "All prices",
    "Di bawah Rp30rb": "Under IDR 30K",
    "Rp30rb–Rp50rb": "IDR 30K–50K",
    "Di atas Rp50rb": "Above IDR 50K",
    "Semua stok": "All stock levels",
    "Stok tersedia": "In stock",
    "Stok menipis": "Low stock",
    "Stok habis": "Out of stock",
    "Tambah ke keranjang": "Add to cart",
    "Tambah ke Keranjang": "Add to Cart",
    "Lihat detail": "View details",
    "Lihat produk": "View product",
    "Lihat Katalog": "View Catalog",
    "Lihat semua": "View all",
    Kembali: "Back",
    "Kembali ke katalog": "Back to catalog",
    "Kembali ke Beranda": "Back to Home",
    "PRODUK TIDAK DITEMUKAN": "PRODUCT NOT FOUND",
    "Produk yang kamu cari tidak tersedia.": "The product you are looking for is unavailable.",
    "Link mungkin sudah berubah atau produknya telah dihapus dari katalog.":
      "The link may have changed or the product may have been removed from the catalog.",
    "DETAIL PRODUK": "PRODUCT DETAILS",
    "BAHAN AKTIF": "ACTIVE INGREDIENTS",
    "Cocok untuk": "Suitable for",
    "Kandungan kunci": "Key ingredients",
    "Informasi Produk": "Product Information",
    "PRODUK SERUPA": "SIMILAR PRODUCTS",
    "Pilihan lain untuk dibandingkan": "Other options to compare",
    "Sering dibeli bersama": "Frequently bought together",
    "LENGKAPI RUTINITAS": "COMPLETE YOUR ROUTINE",
    "Bagikan produk": "Share product",
    "Disalin!": "Copied!",
    Tersalin: "Copied",
    Wishlist: "Wishlist",
    "Wishlist masih kosong": "Your wishlist is empty",
    "Hapus dari wishlist": "Remove from wishlist",
    Keranjang: "Cart",
    "Tutup keranjang": "Close cart",
    Subtotal: "Subtotal",
    Total: "Total",
    "Lanjut ke pembayaran": "Proceed to payment",
    "Lanjutkan pembayaran": "Continue payment",
    "Belanja lagi": "Continue shopping",
    "Nama penerima": "Recipient name",
    "Alamat pengiriman": "Shipping address",
    "ALAMAT PENGIRIMAN": "SHIPPING ADDRESS",
    Nama: "Name",
    "No. HP/WhatsApp (mis. 08123456789)": "Phone/WhatsApp number (e.g. 08123456789)",
    "Email (opsional, untuk struk)": "Email (optional, for receipt)",
    "Cari kecamatan/kota...": "Search district/city...",
    "Mencari area...": "Searching locations...",
    "Detail alamat (jalan, nomor rumah, patokan)": "Full address (street, house number, landmark)",
    PENGIRIMAN: "SHIPPING",
    "Pilih jasa pengiriman:": "Choose a shipping service:",
    "Gratis ongkir": "Free shipping",
    Ongkir: "Shipping",
    Kupon: "Coupon",
    "Kode kupon": "Coupon code",
    Gunakan: "Apply",
    Hapus: "Remove",
    "Total bayar": "Total payment",
    "Konfirmasi pesanan": "Confirm order",
    Pembayaran: "Payment",
    "Menyiapkan pembayaran...": "Preparing payment...",
    "Membuka pembayaran...": "Opening payment...",
    "Pembayaran berhasil": "Payment successful",
    "Pembayaran gagal": "Payment failed",
    "Pembayaran belum selesai": "Payment is not complete",
    "Waktu tersisa": "Time remaining",
    "Salin ID pesanan": "Copy order ID",
    "ID pesanan tersalin": "Order ID copied",
    "Pesanan dibuat": "Order created",
    "Lacak pengiriman": "Track shipment",
    "Cek pesanan": "Check order",
    "ID pesanan": "Order ID",
    "Masukkan ID pesanan (mis. MG-1719...)": "Enter an order ID (e.g. MG-1719...)",
    "Nomor WhatsApp": "WhatsApp number",
    "Riwayat status": "Status history",
    "No. resi": "Tracking number",
    "Belum ada data tracking. Coba lagi nanti.":
      "Tracking data is not available yet. Please try again later.",
    "Menunggu pembayaran": "Awaiting payment",
    "Pembayaran berhasil & diproses": "Payment received and being processed",
    "Sedang diproses": "Processing",
    Dikirim: "Shipped",
    "Sampai tujuan": "Delivered",
    Dibatalkan: "Cancelled",
    "Waktu pembayaran habis": "Payment time expired",
    "Gagal / dibatalkan": "Failed / cancelled",
    "Apa kata pelanggan": "What customers say",
    "Cerita nyata dari pelanggan kami.": "Real stories from our customers.",
    "Belum ada ulasan": "No reviews yet",
    "Jadilah pelanggan pertama yang membagikan pengalaman memakai produk ini.":
      "Be the first customer to share an experience with this product.",
    "Kirim ulasan": "Submit review",
    "Nama kamu": "Your name",
    "Ceritakan pengalamanmu pakai produk ini...":
      "Tell us about your experience with this product...",
    "Foto produk (opsional, maks. 2MB)": "Product photo (optional, max. 2 MB)",
    "Pilih foto produk": "Choose product photo",
    "Ulasan terverifikasi": "Verified review",
    "Memuat ulasan...": "Loading reviews...",
    "Semua rating": "All ratings",
    "Rating tertinggi": "Highest rating",
    "Rating terendah": "Lowest rating",
    "Tidak ada ulasan pada filter ini.": "No reviews match these filters.",
    "Reset filter ulasan": "Reset review filters",
    "Informasi yang perlu kamu tahu": "Information you may need",
    "Temukan jawaban yang kamu butuhkan": "Find the answer you need",
    "Cari pertanyaan...": "Search questions...",
    Semua: "All",
    "Belum menemukan jawaban?": "Still need help?",
    "Tanyakan langsung kepada GESA untuk bantuan yang lebih spesifik.":
      "Ask GESA directly for more specific help.",
    "Hubungi GESA": "Contact GESA",
    ARTIKEL: "ARTICLES",
    "Tips & panduan skincare": "Skincare tips and guides",
    "MORGEN JOURNAL": "MORGEN JOURNAL",
    "Memuat artikel": "Loading article",
    "Memuat daftar artikel": "Loading articles",
    "Artikel tidak ditemukan": "Article not found",
    "Belum ada artikel di kategori ini": "There are no articles in this category yet",
    "Pilih kategori lain untuk melihat artikel yang tersedia.":
      "Choose another category to see available articles.",
    "Baca selengkapnya →": "Read more →",
    "BACA JUGA": "READ NEXT",
    "Artikel lainnya": "More articles",
    Sebelumnya: "Previous",
    SEBELUMNYA: "PREVIOUS",
    Berikutnya: "Next",
    Bagikan: "Share",
    "TENTANG KAMI": "ABOUT US",
    "Skincare Original yang Lebih Mudah Dipilih.": "Authentic Skincare, Made Easier to Choose.",
    "Morgen Geschäft hadir untuk membantu kamu menemukan produk skincare original dengan informasi yang jelas, mulai dari manfaat, bahan aktif, sampai harga. Kami ingin proses memilih skincare terasa lebih mudah, aman, dan tidak membingungkan.":
      "Morgen Geschäft helps you discover authentic skincare with clear information about benefits, active ingredients, and prices. We want choosing skincare to feel easier, safer, and less confusing.",
    "Pilihan produk": "Product selection",
    "Produk resmi": "Authentic products",
    "Harga mulai dari": "Starting price",
    "Bahan aktif & manfaat": "Active ingredients & benefits",
    "Produk pilihan untuk kebutuhan harian": "Selected products for everyday needs",
    "Promo yang sedang berlangsung": "Current promotions",
    "Jangan lewatkan promo berikutnya": "Do not miss the next promotion",
    "Aktifkan notifikasi untuk mendapat kabar saat kode promo dan penawaran baru tersedia.":
      "Enable notifications to hear when new coupon codes and offers become available.",
    "Aktifkan notifikasi": "Enable notifications",
    "Notifikasi aktif": "Notifications enabled",
    "Mengaktifkan...": "Enabling...",
    "Tidak didukung": "Not supported",
    "Periksa izin": "Check permission",
    "Mau dapat info promo & produk baru?": "Want updates about promotions and new products?",
    "Aktifkan notifikasi — kami jarang kirim, hanya yang penting.":
      "Enable notifications. We only send occasional updates when something is important.",
    "Dikemas aman": "Securely packed",
    "Baru & tersegel": "New and sealed",
    Terverifikasi: "Verified",
    "Pesanan mudah": "Easy ordering",
    "Tips dan panduan skincare.": "Skincare tips and guides.",
    "JAM OPERASIONAL": "BUSINESS HOURS",
    "Senin – Jumat": "Monday – Friday",
    "Sabtu – Minggu": "Saturday – Sunday",
    BANTUAN: "HELP",
    "Kebijakan Privasi": "Privacy Policy",
    "Syarat & Ketentuan": "Terms & Conditions",
    "Instal Aplikasi": "Install App",
    "Install Aplikasi": "Install App",
    "HUBUNGI KAMI": "CONTACT US",
    "Hubungi WhatsApp": "Contact us on WhatsApp",
    Notifikasi: "Notifications",
    "Belum ada notifikasi": "No notifications yet",
    "Tutup notifikasi": "Close notifications",
    "Hapus semua": "Clear all",
    "Tandai semua dibaca": "Mark all as read",
    "Masuk Admin": "Admin Sign In",
    "Email admin": "Admin email",
    "Kata sandi": "Password",
    Masuk: "Sign in",
    Keluar: "Sign out",
    "Terjadi Kesalahan": "Something Went Wrong",
    "Coba Lagi": "Try Again",
    "Halaman Tidak Ditemukan": "Page Not Found",
    "Halaman yang kamu cari tidak ditemukan.": "The page you are looking for could not be found.",
    "Install Morgen Geschäft di layar utama HP untuk akses lebih cepat.":
      "Install Morgen Geschäft on your home screen for faster access.",
    "Buka toko dari layar utama.": "Open the store from your home screen.",
    "Belanja skincare lebih praktis": "A more convenient way to shop for skincare",
    "Akses toko lebih cepat dari layar utama HP, cek pesanan lebih mudah, dan belanja tanpa perlu membuka browser.":
      "Open the store faster from your phone's home screen, check orders more easily, and shop without opening the browser first.",
    Install: "Install",
    "Sudah terinstall": "Already installed",
    "Morgen Geschäft sudah terinstall": "Morgen Geschäft is already installed",
    Tutup: "Close",
    Batal: "Cancel",
    Simpan: "Save",
    "Kembali ke toko": "Back to store",
    "Hubungi GESA 👋": "Chat with GESA 👋",
    "Asisten Virtual · Morgen Geschaft": "Virtual Assistant · Morgen Geschäft",
    "Tulis pesan ke GESA": "Write a message to GESA",
    "GESA sedang mengetik": "GESA is typing",
    "Jawaban belum ditemukan": "No answer found yet",
    "Maaf, saya tidak dapat memproses permintaan itu sekarang.":
      "Sorry, I cannot process that request right now.",
    Original: "Authentic",
    "Produk original": "Authentic products",
    "Info jelas": "Clear information",
  })
);

const EXACT_EN_EXTRA = new Map(
  Object.entries({
    "Belanja di marketplace favoritmu": "Shop on your favorite marketplace",
    "Pilih channel yang paling nyaman untuk belanja, cek promo, atau pesan cepat dari Morgen Geschäft.":
      "Choose the channel that works best for shopping, checking promotions, or placing a quick order with Morgen Geschäft.",
    "Belanja di Shopee": "Shop on Shopee",
    "COD & promo toko": "COD & store promotions",
    "Cek voucher, COD, dan pilihan pengiriman langsung dari halaman toko.":
      "Check vouchers, COD, and delivery options directly on the store page.",
    "Tonton & Beli": "Watch & Shop",
    "Review singkat": "Quick reviews",
    "Lihat konten produk, review, dan update pilihan skincare yang sedang tersedia.":
      "Explore product content, reviews, and updates on currently available skincare.",
    "Pesan via Bot": "Order via Bot",
    "Order otomatis": "Automated ordering",
    "Pesan lebih cepat lewat bot untuk cek katalog dan mulai pembelian.":
      "Order faster through the bot, browse the catalog, and start your purchase.",
    "Akses lebih cepat, simpan pesanan, dan belanja langsung dari layar utama tanpa membuka browser.":
      "Access the store faster, keep your orders handy, and shop from your home screen without opening the browser.",
    "Cepat dibuka": "Quick access",
    Ringan: "Lightweight",
    Gratis: "Free",
    Praktis: "Convenient",
    "Install Aplikasi": "Install App",
    "Install Morgen Geschäft": "Install Morgen Geschäft",
    "Morgen Geschäft sudah terinstall": "Morgen Geschäft is already installed",
    "Aplikasi sudah ada di layar utama HP kamu. Buka dari sana untuk mulai belanja lebih cepat.":
      "The app is already on your home screen. Open it from there to start shopping faster.",
    "Akses toko lebih cepat dari layar utama HP, cek pesanan lebih mudah, dan belanja tanpa perlu membuka browser.":
      "Open the store faster from your phone's home screen, check orders more easily, and shop without opening the browser first.",
    "Belanja skincare lebih praktis": "A more convenient way to shop for skincare",
    "Akses cepat": "Quick access",
    "Buka toko dari layar utama.": "Open the store from your home screen.",
    "Info penting": "Important updates",
    "Promo dan update produk seperlunya.": "Occasional promotion and product updates.",
    "Pesanan mudah": "Easy order access",
    "Lebih cepat kembali cek katalog dan pesanan.":
      "Return to the catalog and your orders more quickly.",
    "Langsung Belanja": "Start Shopping",
    "Cara Install": "How to Install",
    "Pastikan buka halaman ini di": "Make sure this page is open in",
    "Buka halaman ini di": "Open this page in",
    "Tap tombol": "Tap the",
    "di bawah layar": "at the bottom of the screen",
    "Tap ikon menu": "Tap the menu icon",
    "di pojok kanan atas": "in the top-right corner",
    Pilih: "Choose",
    atau: "or",
    Tambahkan: "Add",
    "— selesai!": "Done!",
    '"Tambahkan ke Layar Utama"': '"Add to Home Screen"',
    '"Tambahkan ke Layar utama"': '"Add to Home Screen"',
    Mengerti: "Got It",
    "· PRODUK ORIGINAL": "· AUTHENTIC PRODUCTS",
    "Belum menemukan jawaban?": "Still need an answer?",
    "Tanyakan langsung kepada GESA untuk bantuan yang lebih spesifik.":
      "Ask GESA directly for more specific help.",
    "Hubungi GESA": "Chat with GESA",
    "Coba kata kunci lain atau tampilkan seluruh kategori.":
      "Try another keyword or view all categories.",
    "Lima pertanyaan yang paling sering ditanyakan pelanggan. Pertanyaan lainnya tersedia di halaman FAQ lengkap.":
      "Five questions customers ask most often. More answers are available on the full FAQ page.",
    "Tampilkan semua FAQ": "View All FAQs",
    "Tanpa minimum belanja": "No minimum spend",
    "⚠ Sudah kedaluwarsa": "⚠ Expired",
    "✦ Hanya 1× per pelanggan": "✦ One use per customer",
    Salin: "Copy",
    "Disalin!": "Copied!",
    "Min. belanja": "Minimum spend",
    "Gagal mengaktifkan notifikasi": "Could not enable notifications",
    "Gagal mengaktifkan notifikasi. Coba lagi nanti.":
      "Could not enable notifications. Please try again later.",
    "Gagal menyimpan subscription. Coba lagi.":
      "Could not save the subscription. Please try again.",
    "Notifikasi diblokir oleh browser": "Notifications are blocked by your browser",
    "Untuk mengaktifkan, buka pengaturan browser → izinkan notifikasi untuk situs ini.":
      "To enable them, open browser settings → allow notifications for this site.",
    "Server notifikasi belum dikonfigurasi.": "The notification server has not been configured.",
    "Server notifikasi belum tersedia. Coba lagi nanti.":
      "The notification server is unavailable. Please try again later.",
    "VAPID key tidak ditemukan di server.": "The VAPID key was not found on the server.",
    "Aktifkan notifikasi untuk mendapat kode dan penawaran terbaru.":
      "Enable notifications to receive the latest coupon codes and offers.",
    "Dapatkan promo berikutnya": "Get the next promotion",
    "Periksa izin notifikasi": "Check notification permission",
    "Tidak didukung browser": "Not supported by this browser",
    PROMO: "PROMOTIONS",
    "DITAMBAHKAN KE KERANJANG": "ADDED TO CART",
    "STOK SUDAH MAKSIMAL": "MAXIMUM STOCK REACHED",
    "Produk pada pesanan ini sedang tidak tersedia.":
      "A product from this order is currently unavailable.",
    "PRODUK PILIHAN": "FEATURED PRODUCTS",
    "Temukan produk yang kamu butuhkan": "Find the products you need",
    "Delapan pilihan yang tersedia dan mudah dipakai untuk rutinitas sehari-hari.":
      "Eight available choices designed for an easy everyday routine.",
    "Lihat semua produk": "View All Products",
    "Nama, manfaat, atau bahan aktif": "Name, benefit, or active ingredient",
    "Ketik nama produk, manfaat, kategori, atau bahan aktif.":
      "Enter a product name, benefit, category, or active ingredient.",
    "Nama A–Z": "Name A–Z",
    Harga: "Price",
    Kategori: "Category",
    "Belum ada filter aktif": "No active filters",
    "Hapus semua filter": "Clear all filters",
    "Menampilkan 6 dari": "Showing 6 of",
    "Produk tidak ditemukan": "Product not found",
    "Coba gunakan kata pencarian yang lebih singkat.": "Try a shorter search term.",
    "Tutup pencarian": "Close search",
    Isi: "Contents",
    "Isi paket": "Package contents",
    Kandungan: "Ingredients",
    "Belum dicantumkan": "Not specified",
    Murah: "Affordable",
    "Kemasan produk": "Product packaging",
    "Ikuti keterangan pada kemasan": "Follow the directions on the packaging",
    "Paket perawatan": "Care bundle",
    "Semua jenis kulit": "All skin types",
    "Semua jenis kulit, termasuk kulit sensitif": "All skin types, including sensitive skin",
    "Kulit berminyak & rentan berjerawat": "Oily and acne-prone skin",
    "Kulit kusam, berminyak, atau kurang terhidrasi": "Dull, oily, or dehydrated skin",
    "Kulit berminyak & berkomedo": "Oily and comedone-prone skin",
    "Kulit tubuh yang rentan jerawat & kemerahan": "Body skin prone to acne and redness",
    "Kulit yang membutuhkan perlindungan UVA/UVB harian":
      "Skin that needs daily UVA/UVB protection",
    "Kulit berjerawat & cenderung berminyak": "Acne-prone and oily skin",
    "Stok Habis": "Out of Stock",
    "STOK HABIS": "OUT OF STOCK",
    Sisa: "Only",
    "Simpan ke wishlist": "Save to wishlist",
    "Scan untuk langsung ke halaman produk ini": "Scan to open this product page",
    "Ringkasan produk dibuat singkat agar lebih mudah dibandingkan sebelum membeli.":
      "Product summaries are kept concise so items are easier to compare before buying.",
    "Tambahan yang cocok dipadukan dengan produk pilihanmu.":
      "Recommended additions that pair well with your selected product.",
    "ULASAN PRODUK": "PRODUCT REVIEWS",
    "Belum ada cerita dari pelanggan": "No customer stories yet",
    "Badge terverifikasi diberikan setelah admin memeriksa ulasan pelanggan dan keterkaitannya dengan pesanan.":
      "The verified badge is added after an administrator checks the review and its connection to an order.",
    "ulasan telah terverifikasi": "verified reviews",
    "ulasan terbaru.": "latest reviews.",
    Pelanggan: "Customer",
    "Pelanggan Morgen Geschäft": "Morgen Geschäft Customer",
    "🔔 Beritahu saya saat tersedia": "🔔 Notify me when available",
    "Kamu akan dinotifikasi saat produk tersedia.":
      "You will be notified when the product is available.",
    "Masukkan email yang valid.": "Enter a valid email address.",
    "Gagal download QR. Coba klik kanan gambar → Save Image.":
      "Could not download the QR code. Try right-clicking the image → Save Image.",
    "Keranjang masih kosong. Pilih produk dulu, ya.":
      "Your cart is empty. Choose a product to get started.",
    "Lihat katalog": "View Catalog",
    "Simpan produk yang menarik agar mudah ditemukan lagi.":
      "Save products you like so they are easy to find later.",
    "Tambah semua ke keranjang (": "Add all to cart (",
    "produk tersedia": "products available",
    "produk tersimpan": "saved products",
    dari: "of",
    "Mau beli lewat mana?": "Where would you like to buy?",
    "Bayar di Website": "Pay on Website",
    "Pembayaran diproses langsung di website (Midtrans) — bisa transfer bank, e-wallet, QRIS, atau kartu kredit.":
      "Payment is processed securely on the website through Midtrans. You can use bank transfer, an e-wallet, QRIS, or a credit card.",
    "Cari ulang produk di Shopee · gratis ongkir & COD":
      "Find the products again on Shopee · free shipping & COD",
    "Cari ulang produk di TikTok · live & video review":
      "Find the products again on TikTok · live and video reviews",
    "Pesan via bot Telegram kami": "Order through our Telegram bot",
    "Data pengiriman": "Shipping details",
    "Lengkapi nama, no. HP, area tujuan, dan alamat dulu.":
      "Complete your name, phone number, destination area, and address first.",
    "Nama minimal 2 karakter.": "Name must contain at least 2 characters.",
    "Format email tidak valid.": "Invalid email format.",
    "Format email tidak valid. Kosongkan jika tidak ingin menerima invoice.":
      "Invalid email format. Leave it blank if you do not want to receive an invoice.",
    "Alamat terlalu pendek — pastikan sudah lengkap.":
      "The address is too short. Please make sure it is complete.",
    "Pilih jasa pengiriman dulu.": "Select a shipping service first.",
    "Tidak ada kurir tersedia untuk area ini, atau terjadi gangguan koneksi.":
      "No courier is available for this area, or there is a connection problem.",
    "⏳ Menghitung ongkir dari Biteship...": "⏳ Calculating shipping with Biteship...",
    "Gratis ongkir!": "Free shipping!",
    "Diantar langsung (gratis ongkir)": "Direct delivery (free shipping)",
    GRATIS: "FREE",
    "KODE PROMO": "PROMO CODE",
    "Kode kupon tidak ditemukan.": "Coupon code not found.",
    "Kupon ini sudah kedaluwarsa.": "This coupon has expired.",
    "Kupon ini hanya bisa dipakai sekali per pelanggan.":
      "This coupon can only be used once per customer.",
    Pakai: "Apply",
    "Diskon (": "Discount (",
    "Ongkir (": "Shipping (",
    "Subtotal:": "Subtotal:",
    Subtotal: "Subtotal",
    "Total pembayaran": "Total payment",
    "Bayar Sekarang": "Pay Now",
    "Membuka pembayaran...": "Opening payment...",
    "Lanjutkan pembayaran": "Continue Payment",
    "STATUS PESANAN": "ORDER STATUS",
    "Pembayaran telah diterima. Pesananmu akan segera diproses dan invoice dikirim ke email yang kamu masukkan.":
      "Payment has been received. Your order will be processed shortly and the invoice will be sent to the email you provided.",
    "Pembayaran belum selesai. Popup boleh ditutup dan sesi pembayaran dapat dibuka kembali sebelum waktunya habis.":
      "Payment is not complete yet. You may close the popup and reopen the payment session before it expires.",
    "Pembayaran belum berhasil. Kamu masih dapat mencoba lagi selama waktunya tersedia.":
      "Payment has not succeeded yet. You can try again while the session is still available.",
    "Sesi pembayaran telah berakhir. Produk belum dibayar dan kamu perlu membuat pesanan baru.":
      "The payment session has ended. The products were not paid for, so you need to create a new order.",
    "Sesi pembayaran sudah kedaluwarsa. Buat pesanan baru untuk mencoba kembali.":
      "The payment session has expired. Create a new order to try again.",
    "Sesi pembayaran tidak tersedia.": "The payment session is unavailable.",
    "Waktu pembayaran sudah berakhir. Tutup halaman ini lalu buat pesanan baru.":
      "The payment time has expired. Close this page and create a new order.",
    "Transaksi tidak dapat dilanjutkan. Kamu dapat mencoba membuat pesanan baru.":
      "The transaction cannot continue. You can try creating a new order.",
    "Transaksi tidak dapat dilanjutkan. Silakan buat pesanan baru.":
      "The transaction cannot continue. Please create a new order.",
    "Selesaikan pembelian di tab toko yang baru terbuka.":
      "Complete your purchase in the newly opened store tab.",
    "Diarahkan ke toko": "Redirected to Store",
    "Lanjut belanja": "Continue Shopping",
    "Lihat status pesanan": "View Order Status",
    "Buat pesanan ulang": "Reorder",
    "Konfirmasi dan invoice dikirim ke": "Confirmation and invoice sent to",
    "ID pesanan tidak dapat disalin otomatis. Silakan blok dan salin secara manual.":
      "The order ID could not be copied automatically. Please select and copy it manually.",
    "Modul pembayaran gagal dibuka.": "The payment module could not be opened.",
    "Terjadi kesalahan, coba lagi.": "Something went wrong. Please try again.",
    "Stok berubah:": "Stock changed:",
    "Kamu akan dialihkan ke Shopee. Keranjang dari website tidak terbawa — kamu perlu cari dan tambah produk lagi di Shopee. Lanjutkan?":
      "You will be redirected to Shopee. Your website cart will not be transferred, so you will need to find and add the products again on Shopee. Continue?",
    "Kamu akan dialihkan ke TikTok Shop. Keranjang dari website tidak terbawa — kamu perlu cari produk lagi di TikTok. Lanjutkan?":
      "You will be redirected to TikTok Shop. Your website cart will not be transferred, so you will need to find the products again on TikTok. Continue?",
    "LACAK PESANAN": "TRACK ORDER",
    "Cek status pesananmu": "Check your order status",
    "Masukkan ID pesanan untuk melihat pembayaran, proses pesanan, dan informasi pengiriman.":
      "Enter your order ID to view payment, processing, and shipping information.",
    "ID PESANAN": "ORDER ID",
    "Memuat...": "Loading...",
    "Gagal mengambil data pesanan. Coba lagi sebentar.":
      "Could not retrieve the order. Please try again shortly.",
    "Gagal mengambil data tracking.": "Could not retrieve tracking information.",
    "Ringkasan produk": "Product summary",
    "Nomor resi": "Tracking number",
    "Belum ditentukan": "Not assigned yet",
    "Sesi berakhir pada": "Session ends at",
    "Sesi pembayaran masih dapat dibuka dari perangkat ini.":
      "The payment session can still be opened from this device.",
    "Sesi pembayaran telah berakhir": "Payment session ended",
    "Sesi pembayaran sudah ditutup dan tidak dapat dibuka kembali.":
      "The payment session has been closed and cannot be reopened.",
    "Sesi pembayaran tidak ditemukan pada perangkat ini.":
      "The payment session was not found on this device.",
    "Sesi pembayaran tidak ditemukan pada perangkat ini. Buka pesanan dari perangkat yang digunakan saat checkout atau buat pesanan baru.":
      "The payment session was not found on this device. Open the order on the device used at checkout or create a new order.",
    "Produk belum dibayar dan stok belum dikurangi. Buat pesanan baru untuk melanjutkan pembelian.":
      "The products have not been paid for and stock has not been deducted. Create a new order to continue your purchase.",
    "Pembayaran tidak dapat dibuka.": "Payment cannot be opened.",
    "Waktu pembayaran sudah berakhir. Silakan buat pesanan baru.":
      "The payment time has expired. Please create a new order.",
    "Pembatalan hanya dapat dilakukan dari perangkat yang digunakan saat checkout.":
      "Cancellation is only available on the device used at checkout.",
    "Batalkan pesanan": "Cancel Order",
    "Batalkan pesanan?": "Cancel this order?",
    "Setelah dibatalkan, sesi pembayaran ini tidak dapat dilanjutkan. Kamu masih dapat membuat pesanan ulang dari halaman lacak pesanan.":
      "After cancellation, this payment session cannot continue. You can still reorder from the order-tracking page.",
    "Hubungi admin": "Contact Admin",
    "ULASAN PELANGGAN": "CUSTOMER REVIEWS",
    "Kata mereka yang sudah coba": "What customers are saying",
    "Cerita nyata setelah mencoba produk kami.":
      "Real experiences from customers who tried our products.",
    "SEMUA ULASAN": "ALL REVIEWS",
    "Lihat pengalaman pelanggan lain, filter berdasarkan rating atau produk, lalu bagikan pengalamanmu sendiri.":
      "Read other customer experiences, filter by rating or product, and share your own experience.",
    "+ Tulis ulasan": "+ Write a Review",
    "Pilih produk (opsional)": "Select a product (optional)",
    "Belum ada ulasan yang sesuai dengan filter ini.": "No reviews match this filter.",
    "Lihat semua ulasan": "View All Reviews",
    "Ulasan terlalu pendek — tulis minimal 10 karakter ya.":
      "The review is too short. Please write at least 10 characters.",
    "Gagal mengirim ulasan.": "Could not submit the review.",
    "Gagal mengirim ulasan. Periksa koneksi internet.":
      "Could not submit the review. Check your internet connection.",
    "Ulasan berhasil dikirim dan akan tampil setelah diperiksa admin. Terima kasih 🌿":
      "Your review was submitted and will appear after it is checked by an administrator. Thank you 🌿",
    "Hapus testimoni ini?": "Delete this testimonial?",
    "ulasan ditemukan": "reviews found",
    "1 bintang": "1 star",
    "2 bintang": "2 stars",
    "3 bintang": "3 stars",
    "4 bintang": "4 stars",
    "5 bintang": "5 stars",
    "/ 5 dari": "/ 5 from",
    "Semua artikel": "All Articles",
    "Semua artikel →": "All Articles →",
    "Tanpa tanggal": "No date",
    "Artikel yang kamu cari sudah dihapus atau tidak ada.":
      "The article you are looking for has been removed or does not exist.",
    "Baca artikel lengkap untuk melihat pembahasannya.":
      "Read the full article for the complete discussion.",
    "Chat dengan GESA": "Chat with GESA",
    "Tutup chat": "Close chat",
    "Buka chat GESA": "Open GESA chat",
    "Tutup chat GESA": "Close GESA chat",
    "↻ Coba lagi": "↻ Try again",
    "pertanyaan saya": "my question",
    "Halo, saya dialihkan dari GESA. Saya butuh bantuan tentang:":
      "Hello, I was redirected from GESA. I need help with:",
    "Terjadi kesalahan saat memuat bagian": "An error occurred while loading this section",
    "Maaf, ada yang tidak beres. Coba muat ulang halaman.":
      "Sorry, something went wrong. Try reloading the page.",
    "Menyiapkan bagian terakhir yang kamu buka.": "Preparing the last section you viewed.",
    "Notifikasi diblokir browser. Buka Settings → Privacy → Notifications.":
      "Notifications are blocked by the browser. Open Settings → Privacy → Notifications.",
    "Tidak bisa menghubungi server.": "Could not contact the server.",
    "VAPID key belum tersedia di server.": "The VAPID key is not available on the server.",
    "akses admin": "admin access",
    "Area khusus pengelola toko Morgen Geschäft.":
      "Restricted area for Morgen Geschäft store administrators.",
    "Isi email dan password dulu.": "Enter your email and password first.",
    "Email atau password salah.": "Incorrect email or password.",
    "Akun ini tidak memiliki akses admin. Berikan custom claim admin lalu masuk ulang.":
      "This account does not have administrator access. Grant the admin custom claim, then sign in again.",
    "1. Data yang Kami Kumpulkan": "1. Information We Collect",
    "2. Cara Kami Menggunakan Data": "2. How We Use Information",
    "7. Perubahan Kebijakan": "7. Policy Changes",
    "1. Ketentuan Umum": "1. General Terms",
    "2. Produk": "2. Products",
    "3. Pemesanan dan Pembayaran": "3. Orders and Payment",
    "4. Pengiriman": "4. Shipping",
    "6. Pembatalan Pesanan": "6. Order Cancellation",
    "7. Penggunaan Produk dan Tanggung Jawab": "7. Product Use and Responsibility",
    "8. Hukum yang Berlaku": "8. Governing Law",
    "Saat kamu melakukan pembelian atau menghubungi kami, kami dapat mengumpulkan informasi berikut: • Nama lengkap • Nomor telepon/WhatsApp • Alamat email • Alamat pengiriman • Riwayat pesanan (ID transaksi, produk yang dibeli, total pembayaran) Kami tidak menyimpan informasi kartu kredit atau detail pembayaran lengkap. Semua transaksi diproses oleh Midtrans menggunakan kontrol keamanan yang berlaku.":
      "When you place an order or contact us, we may collect: • Full name • Phone or WhatsApp number • Email address • Shipping address • Order history, including transaction ID, purchased products, and payment total We do not store credit-card details or complete payment credentials. Payments are processed by Midtrans using its applicable security controls.",
    "Data yang kamu berikan digunakan untuk: • Memproses dan mengonfirmasi pesananmu • Mengirimkan produk ke alamat yang benar • Menghubungi kamu terkait status pesanan • Meningkatkan layanan kami Kami tidak menjual atau menyewakan data pribadimu untuk pemasaran komersial pihak ketiga.":
      "We use the information you provide to: • Process and confirm orders • Deliver products to the correct address • Contact you about order status • Improve our services We do not sell or rent your personal information for third-party commercial marketing.",
    "Data pesanan disimpan di Firebase Firestore. Akses dibatasi untuk personel Morgen Geschäft yang berwenang dan sistem layanan yang diperlukan untuk menjalankan toko.":
      "Order data is stored in Firebase Firestore. Access is limited to authorized Morgen Geschäft personnel and service systems required to operate the store.",
    "Website dapat menggunakan penyimpanan lokal browser untuk menyimpan: • Isi keranjang belanja • Riwayat ID pesanan untuk fitur pelacakan • Preferensi wishlist • Bahasa website yang dipilih Data browser tersebut tersimpan di perangkatmu.":
      "The website may use browser local storage to remember: • Shopping-cart contents • Order IDs used by the tracking feature • Wishlist preferences • Your selected website language This browser data is stored on your device.",
    "Kami melakukan langkah yang wajar untuk menjaga keamanan data pribadi. Lalu lintas produksi direncanakan memakai enkripsi HTTPS. Tidak ada sistem yang sepenuhnya aman, sehingga jangan membagikan ID pesanan atau informasi verifikasi kepada pihak yang tidak dipercaya.":
      "We take reasonable measures to protect personal data. Production traffic is intended to use HTTPS encryption. No system is completely secure, so do not share order IDs or verification information with untrusted parties.",
    "Kamu dapat meminta kami untuk: • Menjelaskan data pribadi yang kami simpan • Memperbaiki data yang tidak akurat • Menghapus data yang memenuhi syarat untuk dihapus • Menjawab pertanyaan atau keberatan terkait penggunaannya Hubungi morgengeschaft@gmail.com untuk mengajukan permintaan.":
      "You may ask us to: • Explain the personal data we store • Correct inaccurate data • Delete data that qualifies for removal • Answer questions or objections about its use Contact morgengeschaft@gmail.com to submit a request.",
    "Kami dapat memperbarui Kebijakan Privasi ketika layanan atau ketentuan hukum berubah. Versi terbaru akan dipublikasikan pada halaman ini.":
      "We may update this Privacy Policy when our services or legal requirements change. The latest version will be published on this page.",
    "Untuk pertanyaan terkait privasi, hubungi: Morgen Geschäft Email: morgengeschaft@gmail.com WhatsApp: 0896-0172-5019":
      "For privacy-related questions, contact: Morgen Geschäft Email: morgengeschaft@gmail.com WhatsApp: 0896-0172-5019",
    "Dengan menggunakan website Morgen Geschäft atau melakukan pemesanan, kamu menyetujui Syarat & Ketentuan ini. Kami dapat memperbaruinya ketika layanan, operasional, atau ketentuan hukum berubah.":
      "By using the Morgen Geschäft website or placing an order, you agree to these Terms & Conditions. We may update them when our services, operations, or legal requirements change.",
    "Kami berupaya menyediakan produk original dan informasi produk yang akurat. Tampilan foto dapat sedikit berbeda karena pencahayaan, pembaruan kemasan, atau pengaturan layar. Selalu baca label dan petunjuk produk sebelum digunakan.":
      "We aim to provide authentic products and accurate product information. Photos may look slightly different because of lighting, packaging updates, or display settings. Always read the label and product directions before use.",
    "• Pesanan dikonfirmasi setelah pembayaran berhasil diverifikasi • Metode pembayaran yang tersedia ditampilkan saat checkout dan diproses melalui Midtrans • Harga belum termasuk ongkir kecuali dinyatakan lain • Kami dapat menolak atau membatalkan transaksi yang secara wajar dicurigai sebagai penipuan atau penyalahgunaan":
      "• An order is confirmed after payment is successfully verified • Available payment methods are displayed during checkout and processed through Midtrans • Listed prices exclude shipping unless clearly stated otherwise • We may reject or cancel transactions reasonably suspected of fraud or misuse",
    "• Pesanan umumnya diproses dalam satu hari kerja setelah pembayaran dikonfirmasi • Waktu pengiriman merupakan estimasi dan bergantung pada kurir serta tujuan • Keterlambatan kurir dan keadaan kahar dapat berada di luar kendali kami • Pelanggan wajib memberikan alamat pengiriman yang lengkap dan akurat":
      "• Orders are normally processed within one business day after payment confirmation • Delivery times are estimates and depend on the selected courier and destination • Courier delays and force-majeure events may be outside our control • Customers must provide a complete and accurate shipping address",
    "Permintaan retur dapat ditinjau apabila: • Barang tiba dalam kondisi rusak atau cacat • Barang berbeda dari pesanan yang dikonfirmasi Segera hubungi kami dan sertakan nomor pesanan, label pengiriman, foto produk, serta video unboxing. Persetujuan mengikuti hasil pemeriksaan bukti dan kondisi produk.":
      "A return request may be reviewed when: • An item arrives damaged or defective • An item differs from the confirmed order Contact us promptly and include the order number, shipping label, product photos, and an unboxing video. Approval depends on our review of the evidence and product condition.",
    "Hasil skincare dapat berbeda pada setiap orang. Ikuti petunjuk penggunaan, periksa daftar bahan, dan lakukan patch test bila diperlukan. Hentikan penggunaan dan cari bantuan yang tepat apabila muncul reaksi yang mengkhawatirkan.":
      "Skincare results vary by person. Follow product instructions, check ingredient lists, and perform a patch test when appropriate. Stop using a product and seek qualified advice if you experience a concerning reaction.",
    "Syarat & Ketentuan ini mengikuti hukum Republik Indonesia. Sengketa akan terlebih dahulu diupayakan selesai melalui komunikasi dengan iktikad baik.":
      "These Terms & Conditions are governed by the laws of the Republic of Indonesia. Any dispute will first be addressed through good-faith communication.",
    "Morgen Geschäft Email: morgengeschaft@gmail.com WhatsApp: 0896-0172-5019 Jam operasional: Senin–Jumat 07.00–22.00 WIB, Sabtu–Minggu 07.00–24.00 WIB":
      "Morgen Geschäft Email: morgengeschaft@gmail.com WhatsApp: 0896-0172-5019 Business hours: Monday–Friday 07:00–22:00 WIB, Saturday–Sunday 07:00–24:00 WIB",
    "Lihat semua (": "View all (",
    "Lihat semua FAQ (": "View all FAQs (",
    "Lihat →": "View →",
    "Coba lagi": "Try again",
    katalog: "catalog",
    lacak: "track order",
    semua: "all",
    tentang: "about",
    promo: "promotions",
    produk: "products",
    ulasan: "reviews",
    pelanggan: "customer",
    "Pilih bahasa": "Choose language",
    "Memuat detail produk": "Loading product details",
    "Kirim pesan": "Send message",
    "Pertanyaan cepat": "Quick questions",
    "Tulis pesan…": "Type a message…",
    "Masukkan password": "Enter password",
    "Bagikan artikel": "Share article",
    "Tag artikel": "Article tags",
    "Temukan informasi tentang bahan aktif, urutan pemakaian, dan rutinitas perawatan kulit yang lebih mudah dipahami.":
      "Discover easy-to-understand information about active ingredients, application order, and skincare routines.",
    "Tutup wishlist": "Close wishlist",
    "Cari berdasarkan kategori, stok, harga, atau nama produk. Semua informasi produk ditampilkan dengan jelas agar lebih mudah dibandingkan.":
      "Search by category, stock, price, or product name. Product information is displayed clearly to make comparison easier.",
    "Cari produk atau bahan aktif...": "Search products or active ingredients...",
    "Email kamu": "Your email",
    "Foto produk diperbesar": "Enlarged product image",
    "Foto sebelumnya": "Previous image",
    "Foto selanjutnya": "Next image",
    "Hapus pencarian": "Clear search",
    KATALOG: "CATALOG",
    "Pencarian produk": "Product search",
    "Temukan produk sesuai kebutuhan kulitmu.": "Find products that match your skin's needs.",
    "Alamat lengkap (jalan, no. rumah, RT/RW, patokan)":
      "Full address (street, house number, neighborhood details, landmark)",
    "Ketik kecamatan / kota tujuan (mis. Ungaran, Semarang)":
      "Enter the destination district or city (e.g. Ungaran, Semarang)",
    "Masukkan kode kupon": "Enter coupon code",
    "Cari pertanyaan umum": "Search frequently asked questions",
    "Cari pertanyaan, misalnya ongkir atau pembayaran...":
      "Search questions, such as shipping or payment...",
    "Informasi tentang pesanan, pembayaran, pengiriman, pengembalian, dan produk tersedia dalam satu tempat.":
      "Find information about orders, payments, shipping, returns, and products in one place.",
    "PUSAT BANTUAN": "HELP CENTER",
    "Pertanyaan yang sering diajukan": "Frequently Asked Questions",
    "Temukan jawaban yang kamu butuhkan.": "Find the answer you need.",
    "Hapus testimoni": "Delete testimonial",
    "Konfirmasi melalui WhatsApp": "Confirm via WhatsApp",
    Rp26rb: "IDR 26K",
  })
);

const REGEX_EN = [
  [/^Menyiapkan\s+(.+)$/i, "Preparing $1"],
  [/^(\d+)\s+pertanyaan$/i, "$1 questions"],
  [/^Rating rata-rata\s+(.+)\s+dari 5$/i, "Average rating $1 out of 5"],
  [/^(\d+(?:[.,]\d+)?)\s+dari 5 bintang$/i, "$1 out of 5 stars"],
  [/^Foto ulasan dari\s+(.+)$/i, "Review photo from $1"],
  [/^Foto\s+(.+)$/i, "Image $1"],
  [/^Perbesar foto\s+(.+)$/i, "Enlarge image $1"],
  [/^Tampilkan foto\s+(.+)$/i, "Show image $1"],
  [/^Lihat detail\s+(.+)$/i, "View details for $1"],
  [/^Hapus\s+(.+)\s+dari wishlist$/i, "Remove $1 from wishlist"],
  [/^Baca artikel\s+(.+)$/i, "Read article $1"],

  [/^Berlaku s\/d\s+(.+)$/i, "Valid until $1"],
  [/^Menampilkan\s+(\d+)\s+dari\s+(\d+)\s+produk$/i, "Showing $1 of $2 products"],
  [/^Menampilkan\s+(\d+)\s+dari$/i, "Showing $1 of"],
  [/^Lihat semua FAQ \((\d+)\)$/i, "View all FAQs ($1)"],
  [/^Lihat semua \((\d+)\)$/i, "View all ($1)"],
  [/^Tambah semua ke keranjang \((\d+)\)$/i, "Add all to cart ($1)"],
  [/^Sisa\s+(\d+)\s+—\s+segera habis$/i, "Only $1 left. Selling out soon"],
  [/^Sisa\s+(\d+)$/i, "Only $1 left"],
  [/^Berlaku untuk\s+(.+)$/i, "Applies to $1"],
  [/^Min\. belanja\s+(.+)$/i, "Minimum spend $1"],
  [/^Diskon \((.+)\)$/i, "Discount ($1)"],
  [/^Ongkir \((.+)\)$/i, "Shipping ($1)"],
  [/^(\d+)\s+ulasan untuk\s+(.+)$/i, "$1 reviews for $2"],
  [/^Belum ada ulasan untuk\s+(.+)$/i, "No reviews yet for $1"],
  [/^(\d+)\s+ulasan telah terverifikasi$/i, "$1 verified reviews"],
  [/^(\d+)\s+ulasan terbaru\.$/i, "$1 latest reviews."],
  [/^(\d+)\s+ulasan ditemukan$/i, "$1 reviews found"],
  [/^(\d+)\s+produk tersedia$/i, "$1 products available"],
  [/^(\d+)\s+produk tersimpan$/i, "$1 saved products"],
  [/^Dari\s+(\d+)\s+ulasan$/i, "From $1 reviews"],
  [/^\/ 5 dari\s+(\d+)\s+ulasan$/i, "/ 5 from $1 reviews"],
  [/^Konfirmasi dan invoice dikirim ke\s+(.+)$/i, "Confirmation and invoice sent to $1"],
  [/^Sesi berakhir pada\s+(.+)$/i, "Session ends at $1"],
  [/^(\d+) produk ditemukan$/i, "$1 products found"],
  [/^(\d+) produk$/i, "$1 products"],
  [/^(\d+) ulasan$/i, "$1 reviews"],
  [/^(\d+) artikel$/i, "$1 articles"],
  [/^Lihat semua \((\d+)\) →$/i, "View all ($1) →"],
  [/^Semua FAQ \((\d+)\)$/i, "All FAQs ($1)"],
  [/^Hai,\s*(.+)$/i, "Hi, $1"],
  [/^Stok\s+(\d+)$/i, "Stock: $1"],
  [/^Stok tersisa\s+(\d+)$/i, "$1 left in stock"],
  [/^Stok tersedia:\s*(\d+)$/i, "Available stock: $1"],
  [/^Keranjang,\s*(\d+) item$/i, "Cart, $1 items"],
  [/^Wishlist,\s*(\d+) produk tersimpan$/i, "Wishlist, $1 saved products"],
  [/^Min\. belanja\s+(.+)\s+untuk kupon ini\.$/i, "Minimum spend is $1 for this coupon."],
  [/^Diskon\s+(\d+)%\s+—\s+(.+)$/i, "$1% off. $2"],
  [/^(\d+) menit$/i, "$1 min read"],
  [/^Pesanan\s+(.+)$/i, "Order $1"],
  [/^Produk:\s*(.+)$/i, "Product: $1"],
  [/^Kurir:\s*(.+)$/i, "Courier: $1"],
  [/^Resi:\s*(.+)$/i, "Tracking number: $1"],
];

export function translateUiText(value, locale) {
  if (normalizeLocale(locale) !== "en" || value === null || value === undefined) return value;
  const source = String(value);
  const leading = source.match(/^\s*/)?.[0] || "";
  const trailing = source.match(/\s*$/)?.[0] || "";
  const trimmed = source.trim();
  if (!trimmed) return source;
  const compact = trimmed.replace(/\s+/g, " ");

  const exact =
    EXACT_EN_EXTRA.get(trimmed) ||
    EXACT_EN.get(trimmed) ||
    EXACT_EN_EXTRA.get(compact) ||
    EXACT_EN.get(compact);
  if (exact) return `${leading}${exact}${trailing}`;

  for (const [pattern, replacement] of REGEX_EN) {
    if (pattern.test(trimmed))
      return `${leading}${trimmed.replace(pattern, replacement)}${trailing}`;
    if (compact !== trimmed && pattern.test(compact))
      return `${leading}${compact.replace(pattern, replacement)}${trailing}`;
  }
  return source;
}

const HERO_EN = [
  {
    label: "SALICYLIC ACID & ZINC",
    headline: "Healthy, Fresh Skin",
    accent: "Every Morning.",
    subtext:
      "Explore authentic facial care products that help your skin feel clean, comfortable, and refreshed every morning.",
  },
  {
    label: "SPF 40 PA++++",
    headline: "Protect Your Skin Every Day",
    accent: "from Harmful UV Rays.",
    subtext:
      "Find lightweight, comfortable sunscreens for outdoor activities with dependable UVA and UVB protection.",
  },
  {
    label: "PANTHENOL B5 · ACNE-PRONE",
    headline: "A Serum Routine for Skin That Feels",
    accent: "Calmer and Healthier.",
    subtext:
      "Complete your routine with selected serums that help soothe, restore, and support the skin barrier every day.",
  },
];

const FAQ_EN = [
  {
    category: "Orders",
    q: "How do I place an order?",
    a: "Choose the products you want, add them to your cart, and continue to checkout. Follow the payment and shipping steps shown on the checkout page.",
  },
  {
    category: "Orders",
    q: "Can I change or cancel an order?",
    a: "An order may still be changed or cancelled before packing begins. Contact GESA or WhatsApp as soon as possible and include your order number so our team can check its status.",
  },
  {
    category: "Shipping",
    q: "How much is shipping?",
    a: "Shipping is calculated automatically at checkout based on the destination district or city. You can compare available couriers and see the fee before completing your order.",
  },
  {
    category: "Shipping",
    q: "How long does delivery take?",
    a: "Orders are processed within one business day after payment is confirmed. Estimated delivery is 2–4 business days within Java and 4–7 business days outside Java, depending on the courier.",
  },
  {
    category: "Shipping",
    q: "How do I track an order?",
    a: "Open Track Order and enter the order number and WhatsApp number used at checkout. The latest status, courier, and tracking number will appear when available.",
  },
  {
    category: "Payment",
    q: "Which payment methods are available?",
    a: "Available methods are shown during checkout and may include bank transfer, virtual account, QRIS, and other options supported by the payment provider.",
  },
  {
    category: "Payment",
    q: "Is cash on delivery available?",
    a: "Cash on delivery may be available through selected marketplace channels or couriers. Ask us through GESA or WhatsApp to check availability for your area.",
  },
  {
    category: "Payment",
    q: "I have paid, but the order status has not changed. What should I do?",
    a: "Payment confirmation can take a few minutes. If the status has not changed after 30 minutes, contact GESA or WhatsApp and include your order number and proof of payment.",
  },
  {
    category: "Products",
    q: "Are the products authentic?",
    a: "Yes. We sell authentic products sourced through official or trusted distribution channels, not counterfeit products.",
  },
  {
    category: "Products",
    q: "How do I choose a product for my skin?",
    a: "Read the benefits, active ingredients, and skin-type guidance on each product page. You can also ask GESA for general help by describing your skin concerns and goals.",
  },
  {
    category: "Returns",
    q: "What if an item arrives damaged or incorrect?",
    a: "Open Track Order and submit a claim within 72 hours after the parcel is marked delivered. Select the affected item, describe the issue, and upload 1–3 evidence photos. Do not send anything back until admin approval and return instructions are provided.",
  },
  {
    category: "Returns",
    q: "Can an opened product be returned?",
    a: "Opened products generally cannot be returned unless they arrived damaged, defective, or different from the order. Approval depends on the result of our review.",
  },
];

const CATEGORY_LABELS_EN = {
  semua: "All",
  facewash: "Face Wash",
  bodywash: "Body Wash",
  sunscreen: "Sunscreen",
  serum: "Serum",
  bundle: "Bundles",
};

const BLOG_CATEGORY_LABELS_EN = {
  "panduan-skincare": "Skincare Guides",
  "bahan-aktif": "Active Ingredients",
  "perawatan-harian": "Daily Care",
  "berita-produk": "Product News",
};

const ORDER_STATUS_EN = {
  pending: "Awaiting payment",
  paid: "Payment successful",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  expired: "Payment time expired",
  failed: "Failed / cancelled",
};

export function localizeHeroSlides(slides, locale) {
  if (normalizeLocale(locale) !== "en") return slides;
  return slides.map((slide, index) => ({ ...slide, ...(HERO_EN[index] || {}) }));
}

export function localizeFaqItems(items, locale) {
  if (normalizeLocale(locale) !== "en") return items;
  return items.map((item, index) => ({ ...item, ...(FAQ_EN[index] || {}) }));
}

export function localizedCategoryLabel(categoryId, locale, fallback = "Product") {
  if (normalizeLocale(locale) === "en") return CATEGORY_LABELS_EN[categoryId] || fallback;
  return null;
}

export function localizedBlogCategoryLabel(categoryId, locale, fallback = "Articles") {
  if (normalizeLocale(locale) === "en") return BLOG_CATEGORY_LABELS_EN[categoryId] || fallback;
  return null;
}

export function localizedOrderStatus(status, locale, fallback = "") {
  if (normalizeLocale(locale) === "en") return ORDER_STATUS_EN[status] || fallback || status;
  return null;
}

export function formatLocalizedDate(value, locale, options = {}) {
  if (!value) return "";
  let date;
  if (typeof value?.toDate === "function") date = value.toDate();
  else if (value instanceof Date) date = value;
  else date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(normalizeLocale(locale) === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  });
}

export function localizeLegacyUrl(value, locale) {
  const lang = normalizeLocale(locale);
  const raw = String(value || "").trim();
  if (!raw) return routePath(lang, "home");
  if (/^https?:\/\//i.test(raw)) return raw;

  const [rawPath, rawHash = ""] = raw.split("#", 2);
  const path = rawPath || "/";
  const alreadyLocalized = getLocaleFromPath(path);
  if (alreadyLocalized) return switchLocalePath(path, lang, rawHash ? `#${rawHash}` : "");

  let destination = routePath(lang, "home");
  let match;
  if ((match = path.match(/^\/produk\/(.+)$/)))
    destination = routePath(lang, "product", { id: decodeURIComponent(match[1]) });
  else if ((match = path.match(/^\/katalog(?:\/([^/]+))?$/)))
    destination = routePath(lang, "catalog", {
      categoryId: categoryIdFromSlug("id", match[1] || ""),
    });
  else if (path === "/ulasan") destination = routePath(lang, "reviews");
  else if (path === "/faq") destination = routePath(lang, "faq");
  else if ((match = path.match(/^\/blog\/kategori\/(.+)$/)))
    destination = routePath(lang, "blogCategory", {
      categoryId: blogCategoryIdFromSlug("id", match[1]),
    });
  else if ((match = path.match(/^\/blog\/(.+)$/)))
    destination = routePath(lang, "blogDetail", { blogId: decodeURIComponent(match[1]) });
  else if (path === "/blog") destination = routePath(lang, "blog");
  else if (path === "/kebijakan-privasi") destination = routePath(lang, "privacy");
  else if (path === "/syarat-ketentuan") destination = routePath(lang, "terms");
  else if (path === "/install") destination = routePath(lang, "install");
  else if (path && path !== "/")
    destination = `/${lang}${path.startsWith("/") ? path : `/${path}`}`;

  const internalHash = internalSectionId("id", rawHash);
  const localizedHash = internalHash ? localizedSectionHash(lang, internalHash) : "";
  return `${destination}${localizedHash ? `#${localizedHash}` : ""}`;
}
