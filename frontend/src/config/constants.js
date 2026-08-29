// ========== LOCAL STORAGE VERSIONING ==========
const STORAGE_VERSION = 2;



// ---------- Design tokens ----------
// Color: #1F2E22 (deep botanical), #4C6354 (sage), #F6F1E7 (clinical cream), #C97B5E (clay accent), #162B45 (ink)
// Type: display "Fraunces" (serif, characterful) / body "Work Sans" / utility "JetBrains Mono" for labels

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap";



// ---------- Marketplace links ----------
const STORE_WHATSAPP = "6289601725019";


const MARKETPLACE_LINKS = {
  shopee: "https://s.shopee.co.id/3qKoPG98iY",
  telegram: "https://t.me/MorgenGeschaftBot",
  tiktok: "https://www.tiktok.com/@morgengeschaft?_r=1&_t=ZS-97HERmuR66K",
};



// FIX #12: Seed data dipindah ke seedData.js
// Import dari sana jika butuh PRODUCTS_SEED atau BLOG_POSTS.



const CATEGORIES = [
  { id: "semua",    label: "Semua" },
  { id: "facewash", label: "Face Wash" },
  { id: "bodywash", label: "Body Wash" },
  { id: "sunscreen",label: "Sunscreen" },
  { id: "serum",    label: "Serum" },
  { id: "bundle",   label: "Bundle" },
];



const CATEGORY_PATHS = {
  semua: "",
  facewash: "face-wash",
  bodywash: "body-wash",
  sunscreen: "sunscreen",
  serum: "serum",
  bundle: "bundle",
};



const CATEGORY_IDS_BY_PATH = Object.fromEntries(
  Object.entries(CATEGORY_PATHS).map(([id, path]) => [path, id])
);



const BLOG_CATEGORY_OPTIONS = [
  {
    value: "panduan-skincare",
    label: "Panduan Skincare",
    cardLabel: "PANDUAN SKINCARE",
    bg: "linear-gradient(135deg, #F7EFE2 0%, #DCE6D6 100%)",
    ring: "rgba(245,154,26,.20)",
  },
  {
    value: "bahan-aktif",
    label: "Bahan Aktif",
    cardLabel: "BAHAN AKTIF",
    bg: "linear-gradient(135deg, #F8F1E7 0%, rgba(245,154,26,.18) 100%)",
    ring: "rgba(245,154,26,.22)",
  },
  {
    value: "perawatan-harian",
    label: "Perawatan Harian",
    cardLabel: "PERAWATAN HARIAN",
    bg: "linear-gradient(135deg, #F6F1E7 0%, rgba(23,59,94,.16) 100%)",
    ring: "rgba(23,59,94,.15)",
  },
  {
    value: "berita-produk",
    label: "Berita Produk",
    cardLabel: "BERITA PRODUK",
    bg: "linear-gradient(135deg, #F7EFE2 0%, rgba(201,123,94,.18) 100%)",
    ring: "rgba(201,123,94,.20)",
  },
];



// ---------- API base URL ----------
const CONFIGURED_API_BASE = String(import.meta.env.VITE_API_BASE || "").trim().replace(/\/+$/, "");
const LOCAL_API_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const API_BASE = typeof window !== "undefined" && LOCAL_API_HOSTS.has(window.location.hostname)
  ? ""
  : CONFIGURED_API_BASE;



// ---------- FAQ Section ----------

const FAQ_ITEMS = [
  {
    category: "Pesanan",
    q: "Bagaimana cara pesan?",
    a: "Pilih produk yang kamu mau, klik \"Keranjang\", lalu lanjut checkout. Pesananmu nanti dikirim otomatis ke WhatsApp toko untuk konfirmasi pembayaran dan pengiriman.",
  },
  {
    category: "Pesanan",
    q: "Apakah pesanan bisa diubah atau dibatalkan?",
    a: "Pesanan masih bisa diubah atau dibatalkan selama belum masuk proses pengemasan. Segera hubungi GESA atau WhatsApp dengan menyertakan nomor pesanan agar tim kami dapat membantu mengecek statusnya.",
  },
  {
    category: "Pengiriman",
    q: "Ongkos kirim berapa?",
    a: "Ongkir otomatis dihitung saat checkout berdasarkan kecamatan/kota tujuan. Kamu bisa memilih kurir yang tersedia dan melihat biayanya langsung sebelum menyelesaikan pesanan.",
  },
  {
    category: "Pengiriman",
    q: "Berapa lama pengiriman?",
    a: "Pesanan diproses dalam 1 hari kerja setelah pembayaran dikonfirmasi. Estimasi sampai 2–4 hari kerja untuk wilayah Jawa dan 4–7 hari kerja untuk luar Jawa, tergantung kurir yang dipilih.",
  },
  {
    category: "Pengiriman",
    q: "Bagaimana cara melacak pesanan?",
    a: "Buka bagian Lacak Pesanan, masukkan nomor pesanan dan nomor WhatsApp yang digunakan saat checkout. Status, kurir, dan nomor resi akan tampil jika pesanan sudah dikirim.",
  },
  {
    category: "Pembayaran",
    q: "Metode pembayaran apa saja yang tersedia?",
    a: "Metode yang tersedia mengikuti pilihan pada halaman checkout, seperti transfer bank, virtual account, QRIS, dan metode lain yang didukung penyedia pembayaran.",
  },
  {
    category: "Pembayaran",
    q: "Bisa COD (bayar di tempat)?",
    a: "Bisa, terutama untuk pemesanan lewat Shopee. Untuk pemesanan via WhatsApp, COD tergantung ketersediaan kurir di area kamu dan dapat ditanyakan langsung saat chat.",
  },
  {
    category: "Pembayaran",
    q: "Pembayaran sudah dilakukan tetapi status belum berubah, bagaimana?",
    a: "Tunggu beberapa menit karena konfirmasi dapat mengalami jeda. Jika status belum berubah setelah 30 menit, hubungi GESA atau WhatsApp dan kirim nomor pesanan beserta bukti pembayaran.",
  },
  {
    category: "Produk",
    q: "Apakah produknya original?",
    a: "Ya, semua produk yang kami jual adalah produk original dari brand resmi, bukan produk tiruan atau KW.",
  },
  {
    category: "Produk",
    q: "Bagaimana memilih produk yang cocok untuk kulit saya?",
    a: "Baca manfaat, bahan aktif, dan rekomendasi tipe kulit pada detail produk. Untuk bantuan awal, kamu juga dapat bertanya kepada GESA dengan menyebutkan kondisi dan kebutuhan kulitmu.",
  },
  {
    category: "Pengembalian",
    q: "Bagaimana jika produk rusak atau salah kirim?",
    a: "Buka Lacak Pesanan dan ajukan komplain maksimal 3×24 jam setelah paket berstatus diterima. Pilih produk yang bermasalah, jelaskan kondisinya, dan unggah 1–3 foto bukti. Jangan mengirim barang kembali sebelum admin menyetujui dan memberikan instruksi retur.",
  },
  {
    category: "Pengembalian",
    q: "Apakah produk yang sudah dibuka bisa dikembalikan?",
    a: "Produk yang sudah dibuka tidak dapat dikembalikan, kecuali terbukti rusak, cacat, atau tidak sesuai pesanan saat diterima. Keputusan pengembalian mengikuti hasil pemeriksaan tim kami.",
  },
];



// ---------- Lacak Pesanan ----------

const ORDER_STATUS_LABEL = {
  pending: { label: "Menunggu pembayaran", color: "#C97B5E" },
  paid: { label: "Pembayaran berhasil", color: "#4C6354" },
  processing: { label: "Sedang diproses", color: "#6B8A7A" },
  shipped: { label: "Dikirim", color: "#229ED9" },
  delivered: { label: "Sampai tujuan", color: "#1F2E22" },
  cancelled: { label: "Dibatalkan", color: "#999" },
  expired: { label: "Waktu pembayaran habis", color: "#9A6B3F" },
  failed: { label: "Gagal / dibatalkan", color: "#A39E8E" },
};



// ---------- Hero slideshow ----------

const HERO_SLIDES = [
  {
    image: "/photos/Product 6.webp",
    image640: "/hero/product-6-640.webp",
    image960: "/hero/product-6-960.webp",
    width: 960,
    height: 960,
    label: "SALICYLIC ACID & ZINC",
    headline: "Solusi Kulit Sehat & Segar",
    accent: "Setiap Pagi.",
    subtext: "Pilihan produk perawatan wajah 100% original untuk mengawali harimu dengan kulit bersih, nyaman, dan bebas kusam.",
  },
  {
    image: "/photos/Product 80.webp",
    image640: "/hero/product-80-640.webp",
    image960: "/hero/product-80-960.webp",
    width: 960,
    height: 1280,
    label: "SPF 40 PA++++",
    headline: "Lindungi Kulitmu Setiap Hari",
    accent: "dari Efek Buruk UV.",
    subtext: "Temukan berbagai pilihan sunscreen ringan dan nyaman untuk menemani aktivitas luar ruanganmu tanpa khawatir efek buruk sinar UV.",
  },
  {
    image: "/photos/Product 55.webp",
    image640: "/hero/product-55-640.webp",
    image960: "/hero/product-55-960.webp",
    width: 960,
    height: 1280,
    label: "PANTHENOL B5 · ACNE-PRONE",
    headline: "Rutinitas serum untuk kulit",
    accent: "lebih tenang & sehat.",
    subtext: "Lengkapi rutinitas kulitmu dengan serum pilihan yang efektif menenangkan, memperbaiki, dan melindungi skin barrier setiap hari.",
  },
];




const PAGE_ROUTE_TRANSITION_DURATION = 560;


const PAGE_ROUTE_NAVIGATE_DELAY = 145;

export { STORAGE_VERSION, FONT_LINK, STORE_WHATSAPP, MARKETPLACE_LINKS, CATEGORIES, CATEGORY_PATHS, CATEGORY_IDS_BY_PATH, BLOG_CATEGORY_OPTIONS, API_BASE, FAQ_ITEMS, ORDER_STATUS_LABEL, HERO_SLIDES, PAGE_ROUTE_TRANSITION_DURATION, PAGE_ROUTE_NAVIGATE_DELAY };
