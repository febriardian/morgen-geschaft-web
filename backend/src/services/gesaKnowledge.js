// services/gesaKnowledge.js
// Basis pengetahuan STATIS untuk GESA — menjawab pertanyaan umum yang sebelumnya
// tidak tercakup (cara pesan, pembayaran, ongkir, retur, lacak, cara pakai,
// glosarium bahan, kebijakan). Pengetahuan DINAMIS (bisa diedit admin) diambil
// dari koleksi Firestore `gesa_knowledge` di gesaPrompt.js.

const KNOWLEDGE_ID = `== CARA PESAN (LANGKAH) ==
1. Pilih produk lalu tambahkan ke keranjang.
2. Buka keranjang, cek jumlah, klik checkout.
3. Isi nama, WhatsApp, email (opsional), dan alamat lengkap.
4. Pilih kurir/ongkir yang muncul, masukkan kode kupon bila ada.
5. Klik bayar, selesaikan pembayaran di halaman Midtrans.
6. Status pesanan bisa dipantau di menu "Lacak Pesanan".

== PEMBAYARAN ==
Pembayaran diproses aman lewat Midtrans. Metode yang didukung: Virtual Account bank (BCA, BNI, BRI, Mandiri, Permata, dll), e-wallet (GoPay, ShopeePay, dll), QRIS (bisa scan dari semua aplikasi e-wallet/mobile banking), dan kartu kredit/debit.
Batas waktu pembayaran biasanya sekitar 60 menit; jika lewat, pesanan otomatis kedaluwarsa dan stok dilepas—silakan pesan ulang.
QRIS: pilih QRIS di halaman pembayaran, scan kode dengan aplikasi apa pun yang mendukung QRIS, lalu konfirmasi.
Setelah pembayaran berhasil, status pesanan otomatis berubah dan invoice dikirim ke email (jika email diisi).

== ONGKIR & PENGIRIMAN ==
Ongkir dihitung otomatis saat checkout berdasarkan alamat tujuan dan berat, memakai kurir yang tersedia (mis. JNE, J&T, SiCepat, dan lainnya lewat Biteship).
Estimasi waktu tiba tergantung kurir dan kota tujuan; pilihan tercepat/termurah muncul saat memilih ongkir.
Gratis ongkir hanya berlaku jika ada promo/kupon gratis ongkir yang aktif dan syaratnya terpenuhi.
Pesanan diproses setelah pembayaran terkonfirmasi. Nomor resi diberikan setelah barang dikirim dan bisa dilihat di "Lacak Pesanan".

== LACAK PESANAN ==
Buka menu "Lacak Pesanan" di website, masukkan nomor WhatsApp/ID pesanan untuk melihat status terbaru dan nomor resi.
Status pesanan: menunggu pembayaran, diproses, dikirim, selesai, atau dibatalkan/kedaluwarsa.

== RETUR, REFUND & KOMPLAIN ==
Untuk barang rusak, cacat, atau salah kirim: hubungi CS lewat WhatsApp maksimal 3 hari setelah barang diterima, sertakan foto/video sebagai bukti.
Refund atau penggantian diproses oleh tim CS setelah verifikasi.
Untuk keluhan pengiriman spesifik, masalah pembayaran, atau refund—arahkan ke CS.

== KEASLIAN PRODUK ==
Semua produk 100% original dari jalur distribusi resmi atau tepercaya. Produk skincare yang beredar resmi umumnya sudah terdaftar BPOM—cek nomor BPOM pada kemasan.

== CARA PAKAI SKINCARE (UMUM) ==
Urutan dasar pagi: pembersih (face wash) → serum (jika ada) → sunscreen.
Urutan dasar malam: pembersih → serum/perawatan.
Face wash: basahi wajah, usap lembut 20–30 detik, bilas. 1–2x sehari.
Sunscreen: pakai pagi sebagai langkah terakhir, ulang tiap 2–3 jam jika aktivitas luar ruangan.
Serum: beberapa tetes setelah cuci muka, tepuk lembut hingga meresap.
Bahan aktif (mis. salicylic acid, AHA/BHA): mulai bertahap, tidak perlu berlebihan, dan selalu pakai sunscreen di siang hari.

== GLOSARIUM BAHAN (SINGKAT) ==
Salicylic Acid (BHA): membantu membersihkan pori dan menyamarkan komedo/jerawat.
Niacinamide: membantu menjaga kelembapan, meratakan warna kulit, dan mengontrol minyak.
Centella Asiatica (Cica): menenangkan kulit dan membantu meredakan kemerahan.
Hyaluronic Acid: membantu menahan kelembapan agar kulit terasa lembap.
Tea Tree: membantu merawat kulit rentan jerawat.
Zinc / Zinc PCA: membantu mengontrol minyak berlebih.
Panthenol (B5): membantu menenangkan dan menjaga skin barrier.
AHA/PHA: membantu mengangkat sel kulit mati agar kulit tampak lebih cerah.
SPF & PA: SPF melindungi dari UVB (kulit terbakar), PA dari UVA (penuaan). Makin tinggi makin kuat.
Catatan: gunakan kata "membantu"; jangan menjanjikan hasil pasti atau klaim medis.

== HARGA & KURASI ==
Harga terjangkau karena katalog dikurasi dan fokus pada produk esensial dengan informasi yang jelas. Bukan produk KW—tetap original.

== RESELLER / GROSIR ==
Untuk pembelian grosir atau kerja sama reseller, arahkan ke CS via WhatsApp.

== PENYIMPANAN ==
Simpan di tempat sejuk dan kering, hindari sinar matahari langsung. Perhatikan tanda PAO (mis. 12M = baik dipakai 12 bulan setelah dibuka) pada kemasan.`;

const KNOWLEDGE_EN = `== HOW TO ORDER (STEPS) ==
1. Choose a product and add it to the cart.
2. Open the cart, check the quantity, and click checkout.
3. Fill in name, WhatsApp, email (optional), and full address.
4. Choose the courier/shipping option shown, and enter a coupon code if any.
5. Click pay and complete payment on the Midtrans page.
6. Track order status under the "Track Order" menu.

== PAYMENT ==
Payments are processed securely via Midtrans. Supported methods: bank Virtual Accounts (BCA, BNI, BRI, Mandiri, Permata, etc.), e-wallets (GoPay, ShopeePay, etc.), QRIS (scan with any e-wallet/mobile-banking app), and credit/debit cards.
The payment window is usually about 60 minutes; if it passes, the order expires automatically and stock is released—please reorder.
QRIS: choose QRIS on the payment page, scan the code with any QRIS-capable app, then confirm.
After a successful payment, the order status updates automatically and an invoice is emailed (if an email was provided).

== SHIPPING & DELIVERY ==
Shipping is calculated automatically at checkout based on the destination and weight, using available couriers (e.g., JNE, J&T, SiCepat, and others via Biteship).
Delivery time depends on the courier and destination city; the fastest/cheapest options appear when selecting shipping.
Free shipping only applies when an active free-shipping promo/coupon is used and its conditions are met.
Orders are processed after payment is confirmed. A tracking number is provided once the parcel ships and can be seen under "Track Order".

== TRACK ORDER ==
Open the "Track Order" menu on the website and enter your WhatsApp number/order ID to see the latest status and tracking number.
Order statuses: awaiting payment, processing, shipped, completed, or cancelled/expired.

== RETURNS, REFUNDS & COMPLAINTS ==
For damaged, defective, or wrong items: contact CS on WhatsApp within 3 days of receipt, with photo/video evidence.
Refunds or replacements are handled by the CS team after verification.
For specific shipping disputes, payment issues, or refunds—escalate to CS.

== PRODUCT AUTHENTICITY ==
All products are 100% authentic from official or trusted distribution channels. Skincare sold officially in Indonesia is generally BPOM-registered—check the BPOM number on the packaging.

== HOW TO USE SKINCARE (GENERAL) ==
Basic morning order: cleanser (face wash) → serum (if any) → sunscreen.
Basic evening order: cleanser → serum/treatment.
Face wash: wet the face, massage gently for 20–30 seconds, rinse. Once or twice daily.
Sunscreen: apply in the morning as the last step; reapply every 2–3 hours when outdoors.
Serum: a few drops after cleansing, pat gently until absorbed.
Actives (e.g., salicylic acid, AHA/BHA): start gradually, avoid overuse, and always wear sunscreen during the day.

== INGREDIENT GLOSSARY (SHORT) ==
Salicylic Acid (BHA): helps clear pores and reduce the look of blackheads/breakouts.
Niacinamide: helps maintain moisture, even out skin tone, and control oil.
Centella Asiatica (Cica): helps soothe skin and calm redness.
Hyaluronic Acid: helps hold moisture so skin feels hydrated.
Tea Tree: helps care for acne-prone skin.
Zinc / Zinc PCA: helps control excess oil.
Panthenol (B5): helps soothe and support the skin barrier.
AHA/PHA: helps lift dead skin cells so skin looks brighter.
SPF & PA: SPF protects from UVB (burning), PA from UVA (ageing). Higher = stronger.
Note: use the word "helps"; never promise guaranteed results or make medical claims.

== PRICING & CURATION ==
Prices are affordable because the catalog is curated and focused on essentials with clear information. These are genuine products, not counterfeits.

== RESELLER / WHOLESALE ==
For wholesale purchases or reseller partnerships, direct the customer to CS on WhatsApp.

== STORAGE ==
Store in a cool, dry place away from direct sunlight. Note the PAO symbol (e.g., 12M = best used within 12 months after opening) on the packaging.`;

export function buildStaticKnowledge(locale) {
  return locale === "en" ? KNOWLEDGE_EN : KNOWLEDGE_ID;
}
