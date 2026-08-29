// seedData.js
// ==========================================================================
// DATA SEED — hanya untuk inisialisasi Firestore saat pertama kali.
// JANGAN gunakan data di sini sebagai source of truth untuk tampilan.
// Harga, stok, dan detail produk yang ditampilkan harus selalu dari Firestore.
// ==========================================================================

// ---------- Produk (seed awal) ----------
export const PRODUCTS_SEED = [
  { id: "p1", name: "Kahf Oil and Acne Care Face Wash", image: "/photos/Product 6.webp", images: ["/photos/Product 6.webp"], tag: "SALICYLIC ACID & ZINC · OILY/ACNE", price: 26000, stock: 12, category: "facewash", blurb: "Pembersih wajah pria untuk kulit berminyak dan rentan jerawat, membantu angkat minyak berlebih dan bersihkan pori.", ingredients: ["Salicylic Acid", "Zinc PCA", "Tea Tree Oil", "Aloe Vera Extract", "Glycerin", "Purified Water", "Cocamidopropyl Betaine"] },
  { id: "p2", name: "Kahf Energizing and Brightening Face Wash", image: "/photos/Product 3.webp", images: ["/photos/Product 3.webp"], tag: "NIACINAMIDE & MENTHOL · DULL SKIN", price: 26000, stock: 4, category: "facewash", blurb: "Menyegarkan wajah lelah dan kusam, dengan sensasi dingin yang membuat kulit terasa lebih hidup.", ingredients: ["Niacinamide", "Menthol", "Vitamin E", "Glycerin", "Sodium Laureth Sulfate", "Purified Water"] },
  { id: "p3", name: "Kahf Bright Revitalizing AminoGel", image: "/photos/Product 1.webp", images: ["/photos/Product 1.webp"], tag: "AMINO ACID & VITAMIN C · BRIGHTENING", price: 26000, stock: 5, category: "facewash", blurb: "Gel pembersih dengan asam amino dan vitamin C, lembut di kulit sambil membantu mencerahkan.", ingredients: ["Amino Acid Complex", "Vitamin C (Ascorbyl Glucoside)", "Hyaluronic Acid", "Aloe Vera", "Glycerin", "Purified Water"] },
  { id: "p4", name: "Kahf Triple Action Oil and Comedo Defense", image: "/photos/Product 17.webp", images: ["/photos/Product 17.webp"], tag: "CHARCOAL & SALICYLIC ACID · COMEDONES", price: 26000, stock: 10, category: "facewash", blurb: "Formula triple action dengan charcoal untuk membantu angkat komedo dan mengontrol minyak di pori.", ingredients: ["Activated Charcoal", "Salicylic Acid", "Witch Hazel Extract", "Niacinamide", "Glycerin", "Purified Water"] },
  { id: "p5", name: "Somethinc Low pH Gentle Jelly Cleanser", image: "/photos/Product 85.webp", images: ["/photos/Product 85.webp"], tag: "CENTELLA & TEA TREE · SENSITIVE/ACNE", price: 30000, stock: 5, category: "facewash", blurb: "Pembersih bertekstur jelly dengan pH rendah, menyeimbangkan kulit tanpa membuatnya kering atau ketarik.", ingredients: ["Centella Asiatica Extract", "Tea Tree Oil", "Aloe Vera", "Panthenol", "Hyaluronic Acid", "Glycerin"] },
  { id: "p6", name: "Wardah Crystal Secret Facewash", image: "/photos/Product 71.webp", images: ["/photos/Product 71.webp"], tag: "NIACINAMIDE · BRIGHTENING", price: 28000, stock: 5, category: "facewash", blurb: "Pembersih harian yang membantu menyamarkan kusam dan menjaga kulit tampak cerah merata.", ingredients: ["Niacinamide", "AHA (Glycolic Acid)", "Vitamin E", "Allantoin", "Purified Water"] },
  { id: "p7", name: "Kahf Body Wash Relaxing and Acne Fight", image: "/photos/Product 42.webp", images: ["/photos/Product 42.webp"], tag: "TEA TREE & ZINC · BODY ACNE", price: 30000, stock: 4, category: "bodywash", blurb: "Sabun mandi pria yang membantu meredakan jerawat badan sambil memberi sensasi relaksasi saat mandi.", ingredients: ["Tea Tree Oil", "Zinc PCA", "Salicylic Acid", "Lavender Oil", "Glycerin", "Purified Water"] },
  { id: "p8", name: "Implora Perfect Shield Sunscreen SPF 40 PA++++", image: "/photos/Product 79.webp", images: ["/photos/Product 79.webp"], tag: "SPF 40 PA++++ · ALL TYPES", price: 26000, stock: 3, category: "sunscreen", blurb: "Sunscreen ringan dengan harga terjangkau, melindungi dari UVA/UVB tanpa terasa lengket.", ingredients: ["Ethylhexyl Methoxycinnamate", "Titanium Dioxide", "Niacinamide", "Hyaluronic Acid", "Vitamin E", "Aloe Vera Extract"] },
  { id: "p9", name: "The Originote Acne B5 Serum", image: "/photos/Product 60.webp", images: ["/photos/Product 60.webp"], tag: "PANTHENOL B5 · ACNE-PRONE", price: 30000, stock: 8, category: "serum", blurb: "Serum harian dengan panthenol untuk membantu meredakan kemerahan dan menjaga skin barrier kulit berjerawat.", ingredients: ["Panthenol (Vitamin B5)", "Centella Asiatica", "Hyaluronic Acid", "Niacinamide", "Allantoin", "Purified Water"] },
  // Bundle products
  { id: "b1", name: "Acne Care Starter Kit", image: "/photos/Product 6.webp", images: ["/photos/Product 6.webp", "/photos/Product 60.webp"], tag: "BUNDLE · HEMAT 15%", price: 48000, originalPrice: 56000, stock: 5, category: "bundle", blurb: "Paket lengkap untuk kulit berjerawat: face wash + serum acne B5. Hemat 15% dari beli satuan.", ingredients: [], bundleItems: ["p1", "p9"] },
  { id: "b2", name: "Daily Protection Set", image: "/photos/Product 85.webp", images: ["/photos/Product 85.webp", "/photos/Product 79.webp"], tag: "BUNDLE · HEMAT 10%", price: 50000, originalPrice: 56000, stock: 3, category: "bundle", blurb: "Gentle cleanser + sunscreen SPF 40 — duo esensial untuk perlindungan harian. Hemat Rp6.000.", ingredients: [], bundleItems: ["p5", "p8"] },
];

// Kode kupon tidak disimpan di bundle frontend. Kelola kupon melalui panel admin.

// ---------- Blog / Artikel (seed awal) ----------
export const BLOG_POSTS = [
  {
    id: "blog-1",
    title: "Urutan Skincare yang Benar untuk Pemula",
    excerpt: "Bingung harus mulai dari mana? Ini panduan urutan skincare paling simpel yang bisa kamu ikuti sekarang juga.",
    content: `Banyak yang baru mulai skincare langsung beli banyak produk tanpa tahu urutannya. Padahal urutan pemakaian penting supaya bahan aktif bekerja optimal.\n\n**1. Cleanser (Pembersih)**\nSelalu mulai dari wajah bersih. Gunakan face wash yang sesuai jenis kulitmu — gel untuk berminyak, jelly/cream untuk kering/sensitif.\n\n**2. Serum / Treatment**\nSerum punya konsentrasi bahan aktif tertinggi. Untuk jerawat, cari yang mengandung Salicylic Acid atau Niacinamide. Untuk hidrasi, Hyaluronic Acid.\n\n**3. Moisturizer**\nMengunci kelembapan dan memperkuat skin barrier. Jangan skip walaupun kulitmu berminyak.\n\n**4. Sunscreen (Pagi)**\nProteksi UV adalah anti-aging paling efektif. SPF 30 minimum, reapply tiap 2-3 jam kalau di luar ruangan.\n\nTips: mulai dengan 2 produk saja (cleanser + sunscreen), lalu tambahkan serum setelah 2-3 minggu.`,
    date: "2026-06-20",
    readTime: "3 menit",
    readTimeEn: "3 min read",
    titleEn: "The Right Skincare Order for Beginners",
    excerptEn: "Not sure where to start? Here's the simplest skincare order you can follow right now.",
    contentEn: `Many people new to skincare buy lots of products without knowing the order. Yet the order of application matters so active ingredients work optimally.\n\n**1. Cleanser**\nAlways start with a clean face. Use a face wash suited to your skin type — gel for oily, jelly/cream for dry or sensitive skin.\n\n**2. Serum / Treatment**\nSerums have the highest concentration of actives. For acne, look for Salicylic Acid or Niacinamide. For hydration, Hyaluronic Acid.\n\n**3. Moisturizer**\nLocks in moisture and strengthens the skin barrier. Don't skip it even if your skin is oily.\n\n**4. Sunscreen (Morning)**\nUV protection is the most effective anti-aging step. SPF 30 minimum, reapply every 2-3 hours when outdoors.\n\nTip: start with just 2 products (cleanser + sunscreen), then add a serum after 2-3 weeks.`,
    category: "panduan-skincare",
    tags: ["skincare dasar", "pemula"],
  },
  {
    id: "blog-2",
    title: "Salicylic Acid vs Niacinamide: Mana yang Kamu Butuhkan?",
    excerpt: "Dua bahan aktif populer untuk jerawat, tapi cara kerjanya beda. Ini panduan memilihnya.",
    content: `Keduanya sering disebut sebagai "bahan anti-jerawat", tapi sebenarnya mereka bekerja dengan cara yang sangat berbeda.\n\n**Salicylic Acid (BHA)**\n- Exfoliant yang larut minyak — bisa masuk ke dalam pori\n- Cocok untuk komedo (blackhead/whitehead) dan kulit berminyak\n- Konsentrasi umum: 0.5-2%\n- Bisa bikin kering kalau berlebihan\n\n**Niacinamide (Vitamin B3)**\n- Anti-inflamasi — mengurangi kemerahan dan iritasi\n- Mengontrol produksi sebum tanpa mengeringkan\n- Memperkuat skin barrier\n- Konsentrasi umum: 2-10%\n- Hampir tidak ada efek samping\n\n**Jadi, pilih mana?**\n- Komedo banyak, pori besar → Salicylic Acid\n- Jerawat meradang, kulit sensitif → Niacinamide\n- Keduanya bisa dipakai bersamaan — niacinamide pagi, salicylic acid malam\n\nDi Morgen Geschäft, beberapa produk kami sudah mengandung kedua bahan ini dalam formulasi yang seimbang.`,
    date: "2026-06-10",
    readTime: "4 menit",
    readTimeEn: "4 min read",
    titleEn: "Salicylic Acid vs Niacinamide: Which One Do You Need?",
    excerptEn: "Two popular acne actives, but they work differently. Here's how to choose.",
    contentEn: `Both are often called "anti-acne ingredients," but they actually work in very different ways.\n\n**Salicylic Acid (BHA)**\n- An oil-soluble exfoliant — it can get inside pores\n- Great for blackheads and whiteheads and oily skin\n- Common concentration: 0.5-2%\n- Can be drying if overused\n\n**Niacinamide (Vitamin B3)**\n- Anti-inflammatory — reduces redness and irritation\n- Controls sebum without drying the skin\n- Strengthens the skin barrier\n- Common concentration: 2-10%\n- Almost no side effects\n\n**So which one?**\n- Lots of blackheads, large pores → Salicylic Acid\n- Inflamed acne, sensitive skin → Niacinamide\n- You can use both — niacinamide in the morning, salicylic acid at night\n\nAt Morgen Geschäft, several of our products already contain both in a balanced formulation.`,
    category: "bahan-aktif",
    tags: ["bahan aktif", "jerawat"],
  },
  {
    id: "blog-3",
    title: "Kenapa Sunscreen Itu Wajib (Bahkan di Dalam Ruangan)",
    excerpt: "UVA tembus kaca jendela. Ini kenapa dermatologis selalu bilang sunscreen itu non-negotiable.",
    content: `Banyak yang skip sunscreen karena merasa "kan cuma di dalam ruangan". Sayangnya, UVA — sinar UV yang menyebabkan penuaan dini dan hiperpigmentasi — bisa menembus kaca jendela.\n\n**Fakta yang sering diabaikan:**\n- UVB (yang bikin kulit terbakar) memang diblokir kaca, tapi UVA tidak\n- Blue light dari layar HP/laptop juga berkontribusi pada kerusakan kulit, walau dampaknya jauh lebih kecil dari UV\n- Efek UV bersifat kumulatif — kerusakan hari ini baru terlihat 5-10 tahun lagi\n\n**Tips memilih sunscreen:**\n- SPF 30 sudah cukup untuk harian, SPF 50 untuk outdoor\n- PA++++ artinya proteksi UVA tertinggi\n- Chemical sunscreen lebih ringan, physical sunscreen lebih aman untuk kulit sensitif\n- Reapply tiap 2-3 jam kalau terpapar sinar matahari langsung\n\nSunscreen adalah satu produk skincare yang paling cost-effective — hasilnya baru terasa 10 tahun dari sekarang, tapi saat itu kamu akan sangat bersyukur.`,
    date: "2026-05-28",
    readTime: "3 menit",
    readTimeEn: "3 min read",
    titleEn: "Why Sunscreen Is a Must (Even Indoors)",
    excerptEn: "UVA passes through window glass. Here's why dermatologists say sunscreen is non-negotiable.",
    contentEn: `Many people skip sunscreen because they feel they are "only indoors." Unfortunately, UVA — the UV rays that cause premature aging and hyperpigmentation — can pass through window glass.\n\n**Often-ignored facts:**\n- UVB (which burns the skin) is blocked by glass, but UVA is not\n- Blue light from phone and laptop screens also contributes to skin damage, though far less than UV\n- UV effects are cumulative — today's damage only shows 5-10 years later\n\n**Tips for choosing a sunscreen:**\n- SPF 30 is enough for daily use, SPF 50 for outdoors\n- PA++++ means the highest UVA protection\n- Chemical sunscreen feels lighter, physical sunscreen is safer for sensitive skin\n- Reapply every 2-3 hours under direct sun\n\nSunscreen is one of the most cost-effective skincare products — the results only show 10 years from now, but you will be very grateful then.`,
    category: "perawatan-harian",
    tags: ["sunscreen", "UV protection"],
  },
];
