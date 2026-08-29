import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShoppingBag, Leaf, ChevronRight, ExternalLink, Bell, Package } from "lucide-react";
import { SimpleBackHeader } from "../components/shared/Transitions.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { returnToCapturedContext } from "../utils/navigation.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import { LanguageSwitcher } from "../components/shared/LanguageSwitcher.jsx";

// ---------- Main app ----------

// ---------- Halaman Kebijakan Privasi ----------

export function PrivacyPage() {
  const navigate = useNavigate();
  const { locale, route } = useLocale();
  const isEnglish = locale === "en";
  usePageMeta(
    isEnglish ? "Privacy Policy" : "Kebijakan Privasi",
    isEnglish
      ? "Privacy and customer-data protection policy for Morgen Geschäft."
      : "Kebijakan privasi dan perlindungan data pelanggan Morgen Geschäft."
  );

  const sections = isEnglish
    ? [
        {
          title: "1. Information We Collect",
          content: `When you place an order or contact us, we may collect:
• Full name
• Phone or WhatsApp number
• Email address
• Shipping address
• Order history, including transaction ID, purchased products, and payment total
• Claim and return details, including selected items, explanations, evidence photos, and resolution history

We do not store credit-card details or complete payment credentials. Payments are processed by Midtrans using its applicable security controls.`,
        },
        {
          title: "2. How We Use Information",
          content: `We use the information you provide to:
• Process and confirm orders
• Deliver products to the correct address
• Contact you about order status
• Improve our services

We do not sell or rent your personal information for third-party commercial marketing.`,
        },
        {
          title: "3. Data Storage",
          content:
            "Order and claim data is stored in Firebase Firestore. Uploaded product, review, and claim images may be stored through Cloudinary or the store's fallback storage. Access to claim records is limited to authorized Morgen Geschäft personnel and the customer verification flow.",
        },
        {
          title: "4. Cookies and Local Storage",
          content: `The website may use browser local storage to remember:
• Shopping-cart contents
• Order IDs used by the tracking feature
• Wishlist preferences
• Your selected website language
• Skin-quiz answers and result, only when you explicitly choose to save them

Skin-quiz answers are processed in your browser and are not sent to our server. This browser data is stored on your device.`,
        },
        {
          title: "5. Security",
          content:
            "We take reasonable measures to protect personal information. Production traffic is intended to use HTTPS encryption. No system is completely secure, so do not share your order ID or verification information with untrusted parties.",
        },
        {
          title: "6. Your Rights",
          content: `You may ask us to:
• Explain which personal information we hold about you
• Correct inaccurate information
• Delete eligible personal information
• Answer questions or concerns about its use

Contact morgengeschaft@gmail.com to submit a request.`,
        },
        {
          title: "7. Policy Updates",
          content:
            "We may update this Privacy Policy when our services or legal requirements change. The latest version will be published on this page.",
        },
        {
          title: "8. Contact",
          content: `For privacy questions, contact:
Morgen Geschäft
Email: morgengeschaft@gmail.com
WhatsApp: 0896-0172-5019`,
        },
      ]
    : [
        {
          title: "1. Data yang Kami Kumpulkan",
          content: `Saat kamu melakukan pembelian atau menghubungi kami, kami dapat mengumpulkan informasi berikut:
• Nama lengkap
• Nomor telepon/WhatsApp
• Alamat email
• Alamat pengiriman
• Riwayat pesanan (ID transaksi, produk yang dibeli, total pembayaran)
• Data komplain/retur (produk yang diajukan, penjelasan, foto bukti, dan riwayat penyelesaian)

Kami tidak menyimpan informasi kartu kredit atau detail pembayaran lengkap. Semua transaksi diproses oleh Midtrans menggunakan kontrol keamanan yang berlaku.`,
        },
        {
          title: "2. Cara Kami Menggunakan Data",
          content: `Data yang kamu berikan digunakan untuk:
• Memproses dan mengonfirmasi pesananmu
• Mengirimkan produk ke alamat yang benar
• Menghubungi kamu terkait status pesanan
• Meningkatkan layanan kami

Kami tidak menjual atau menyewakan data pribadimu untuk pemasaran komersial pihak ketiga.`,
        },
        {
          title: "3. Penyimpanan Data",
          content:
            "Data pesanan dan komplain disimpan di Firebase Firestore. Foto produk, ulasan, dan bukti komplain dapat disimpan melalui Cloudinary atau penyimpanan fallback toko. Akses catatan komplain dibatasi untuk personel Morgen Geschäft yang berwenang dan alur verifikasi pelanggan.",
        },
        {
          title: "4. Cookie dan Penyimpanan Lokal",
          content: `Website dapat menggunakan penyimpanan lokal browser untuk menyimpan:
• Isi keranjang belanja
• Riwayat ID pesanan untuk fitur pelacakan
• Preferensi wishlist
• Bahasa website yang dipilih
• Jawaban dan hasil kuis tipe kulit, hanya jika kamu memilih untuk menyimpannya

Jawaban kuis diproses di browser dan tidak dikirim ke server kami. Data browser tersebut tersimpan di perangkatmu.`,
        },
        {
          title: "5. Keamanan",
          content:
            "Kami melakukan langkah yang wajar untuk menjaga keamanan data pribadi. Lalu lintas produksi direncanakan memakai enkripsi HTTPS. Tidak ada sistem yang sepenuhnya aman, sehingga jangan membagikan ID pesanan atau informasi verifikasi kepada pihak yang tidak dipercaya.",
        },
        {
          title: "6. Hak Pengguna",
          content: `Kamu dapat meminta kami untuk:
• Menjelaskan data pribadi yang kami simpan
• Memperbaiki data yang tidak akurat
• Menghapus data yang memenuhi syarat untuk dihapus
• Menjawab pertanyaan atau keberatan terkait penggunaannya

Hubungi morgengeschaft@gmail.com untuk mengajukan permintaan.`,
        },
        {
          title: "7. Perubahan Kebijakan",
          content:
            "Kami dapat memperbarui Kebijakan Privasi ketika layanan atau ketentuan hukum berubah. Versi terbaru akan dipublikasikan pada halaman ini.",
        },
        {
          title: "8. Kontak",
          content: `Untuk pertanyaan terkait privasi, hubungi:
Morgen Geschäft
Email: morgengeschaft@gmail.com
WhatsApp: 0896-0172-5019`,
        },
      ];

  return (
    <div
      style={{ fontFamily: "'Work Sans', sans-serif", background: "#F6F1E7", minHeight: "100vh" }}
    >
      <header
        style={{
          borderBottom: "1px solid #E3DCC9",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <button
          onClick={() => navigate(route("home"))}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <ChevronRight size={16} color="#1F2E22" style={{ transform: "rotate(180deg)" }} />
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", color: "#173B5E" }}>
            Morgen Geschäft
          </span>
        </button>
        <LanguageSwitcher />
      </header>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "42px 32px" }}>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "32px",
            color: "#162B45",
            marginBottom: "8px",
          }}
        >
          {isEnglish ? "Privacy Policy" : "Kebijakan Privasi"}
        </h1>
        <p style={{ fontSize: "13px", color: "#A39E8E", marginBottom: "32px" }}>
          {isEnglish ? "Last updated: July 30, 2026" : "Terakhir diperbarui: 30 Juli 2026"}
        </p>
        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: "28px" }}>
            <h2
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "18px",
                color: "#162B45",
                marginBottom: "10px",
              }}
            >
              {section.title}
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#4A4540",
                lineHeight: 1.8,
                whiteSpace: "pre-line",
              }}
            >
              {section.content}
            </p>
          </div>
        ))}
      </div>
      <footer
        style={{
          borderTop: "1px solid #E3DCC9",
          padding: "20px 32px",
          textAlign: "center",
          fontSize: "13px",
          color: "#A39E8E",
        }}
      >
        © {new Date().getFullYear()} Morgen Geschäft. All rights reserved.
        <span style={{ margin: "0 8px" }}>·</span>
        <button
          onClick={() => navigate(route("terms"))}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#4C6354",
            fontSize: "13px",
          }}
        >
          {isEnglish ? "Terms & Conditions" : "Syarat & Ketentuan"}
        </button>
      </footer>
    </div>
  );
}

// ---------- Halaman Syarat & Ketentuan ----------

export function TermsPage() {
  const navigate = useNavigate();
  const { locale, route } = useLocale();
  const isEnglish = locale === "en";
  usePageMeta(
    isEnglish ? "Terms & Conditions" : "Syarat & Ketentuan",
    isEnglish
      ? "Terms for using Morgen Geschäft services."
      : "Syarat dan ketentuan penggunaan layanan Morgen Geschäft."
  );

  const sections = isEnglish
    ? [
        {
          title: "1. General Terms",
          content:
            "By using the Morgen Geschäft website or placing an order, you agree to these Terms & Conditions. We may update the terms when our services, operations, or legal requirements change.",
        },
        {
          title: "2. Products",
          content:
            "We aim to provide authentic products and accurate product information. Product photos may look slightly different because of lighting, packaging updates, or screen settings. Always read the label and product instructions before use.",
        },
        {
          title: "3. Orders and Payment",
          content: `• An order is confirmed after payment is successfully verified
• Available payment methods are displayed during checkout and processed through Midtrans
• Listed prices exclude shipping unless clearly stated otherwise
• We may reject or cancel transactions reasonably suspected of fraud or misuse`,
        },
        {
          title: "4. Shipping",
          content: `• Orders are normally processed within one business day after payment confirmation
• Delivery times are estimates and depend on the selected courier and destination
• Courier delays and force-majeure events may be outside our control
• Customers must provide a complete and accurate shipping address`,
        },
        {
          title: "5. Returns",
          content: `A return request may be reviewed when:
• An item arrives damaged, leaking, expired, or unfit for use
• The item or quantity differs from the confirmed order
• Another verified seller error occurred

Submit the claim through Track Order within 72 hours after delivery, select the affected items, explain the issue, and upload 1–3 evidence photos. Change-of-mind or choosing the wrong product is not eligible. Do not send an item back until admin approval and return instructions appear in the claim. Refunds are reviewed first and are not issued automatically.`,
        },
        {
          title: "6. Order Cancellation",
          content:
            "An order can generally be cancelled only before packing or fulfilment begins. Eligible refunds are returned through the applicable payment process and may require several business days.",
        },
        {
          title: "7. Product Use and Responsibility",
          content:
            "Skincare results vary by person. Follow product instructions, check ingredient lists, and perform a patch test when appropriate. Stop using a product and seek qualified advice if you experience a concerning reaction.",
        },
        {
          title: "8. Governing Law",
          content:
            "These Terms & Conditions are governed by the laws of the Republic of Indonesia. We will first try to resolve disputes through good-faith communication.",
        },
        {
          title: "9. Contact",
          content: `Morgen Geschäft
Email: morgengeschaft@gmail.com
WhatsApp: 0896-0172-5019
Business hours: Monday–Friday 07:00–22:00 WIB, Saturday–Sunday 07:00–24:00 WIB`,
        },
      ]
    : [
        {
          title: "1. Ketentuan Umum",
          content:
            "Dengan menggunakan website Morgen Geschäft atau melakukan pemesanan, kamu menyetujui Syarat & Ketentuan ini. Kami dapat memperbaruinya ketika layanan, operasional, atau ketentuan hukum berubah.",
        },
        {
          title: "2. Produk",
          content:
            "Kami berupaya menyediakan produk original dan informasi produk yang akurat. Tampilan foto dapat sedikit berbeda karena pencahayaan, pembaruan kemasan, atau pengaturan layar. Selalu baca label dan petunjuk produk sebelum digunakan.",
        },
        {
          title: "3. Pemesanan dan Pembayaran",
          content: `• Pesanan dikonfirmasi setelah pembayaran berhasil diverifikasi
• Metode pembayaran yang tersedia ditampilkan saat checkout dan diproses melalui Midtrans
• Harga belum termasuk ongkir kecuali dinyatakan lain
• Kami dapat menolak atau membatalkan transaksi yang secara wajar dicurigai sebagai penipuan atau penyalahgunaan`,
        },
        {
          title: "4. Pengiriman",
          content: `• Pesanan umumnya diproses dalam satu hari kerja setelah pembayaran dikonfirmasi
• Waktu pengiriman merupakan estimasi dan bergantung pada kurir serta tujuan
• Keterlambatan kurir dan keadaan kahar dapat berada di luar kendali kami
• Pelanggan wajib memberikan alamat pengiriman yang lengkap dan akurat`,
        },
        {
          title: "5. Pengembalian Barang",
          content: `Permintaan retur dapat ditinjau apabila:
• Barang tiba dalam kondisi rusak, bocor, kedaluwarsa, atau tidak layak
• Produk atau jumlah barang berbeda dari pesanan yang dikonfirmasi
• Terjadi kesalahan penjual lain yang dapat diverifikasi

Ajukan komplain melalui Lacak Pesanan maksimal 3×24 jam setelah pesanan diterima, pilih produk bermasalah, jelaskan kondisinya, dan unggah 1–3 foto bukti. Retur karena berubah pikiran atau salah memilih produk tidak berlaku. Barang tidak boleh dikirim kembali sebelum admin menyetujui dan instruksi retur tampil pada pengajuan. Refund diperiksa terlebih dahulu dan tidak berjalan otomatis.`,
        },
        {
          title: "6. Pembatalan Pesanan",
          content:
            "Pesanan umumnya hanya dapat dibatalkan sebelum proses pengemasan atau pemenuhan dimulai. Refund yang memenuhi syarat dikembalikan melalui proses pembayaran terkait dan dapat memerlukan beberapa hari kerja.",
        },
        {
          title: "7. Penggunaan Produk dan Tanggung Jawab",
          content:
            "Hasil skincare dapat berbeda pada setiap orang. Ikuti petunjuk penggunaan, periksa daftar bahan, dan lakukan patch test bila diperlukan. Hentikan penggunaan dan cari bantuan yang tepat apabila muncul reaksi yang mengkhawatirkan.",
        },
        {
          title: "8. Hukum yang Berlaku",
          content:
            "Syarat & Ketentuan ini mengikuti hukum Republik Indonesia. Sengketa akan terlebih dahulu diupayakan selesai melalui komunikasi dengan iktikad baik.",
        },
        {
          title: "9. Kontak",
          content: `Morgen Geschäft
Email: morgengeschaft@gmail.com
WhatsApp: 0896-0172-5019
Jam operasional: Senin–Jumat 07.00–22.00 WIB, Sabtu–Minggu 07.00–24.00 WIB`,
        },
      ];

  return (
    <div
      style={{ fontFamily: "'Work Sans', sans-serif", background: "#F6F1E7", minHeight: "100vh" }}
    >
      <header
        style={{
          borderBottom: "1px solid #E3DCC9",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <button
          onClick={() => navigate(route("home"))}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <ChevronRight size={16} color="#1F2E22" style={{ transform: "rotate(180deg)" }} />
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", color: "#173B5E" }}>
            Morgen Geschäft
          </span>
        </button>
        <LanguageSwitcher />
      </header>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "42px 32px" }}>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "32px",
            color: "#162B45",
            marginBottom: "8px",
          }}
        >
          {isEnglish ? "Terms & Conditions" : "Syarat & Ketentuan"}
        </h1>
        <p style={{ fontSize: "13px", color: "#A39E8E", marginBottom: "32px" }}>
          {isEnglish ? "Last updated: July 30, 2026" : "Terakhir diperbarui: 30 Juli 2026"}
        </p>
        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: "28px" }}>
            <h2
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "18px",
                color: "#162B45",
                marginBottom: "10px",
              }}
            >
              {section.title}
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#4A4540",
                lineHeight: 1.8,
                whiteSpace: "pre-line",
              }}
            >
              {section.content}
            </p>
          </div>
        ))}
      </div>
      <footer
        style={{
          borderTop: "1px solid #E3DCC9",
          padding: "20px 32px",
          textAlign: "center",
          fontSize: "13px",
          color: "#A39E8E",
        }}
      >
        © {new Date().getFullYear()} Morgen Geschäft. All rights reserved.
        <span style={{ margin: "0 8px" }}>·</span>
        <button
          onClick={() => navigate(route("privacy"))}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#4C6354",
            fontSize: "13px",
          }}
        >
          {isEnglish ? "Privacy Policy" : "Kebijakan Privasi"}
        </button>
      </footer>
    </div>
  );
}

// ---------- Halaman 404 ----------

// ---------- Install / Download Page ----------

const ANDROID_APK_URL = "/download/morgen-geschaft-v1.0.0.apk";

export function InstallPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, route } = useLocale();
  usePageMeta(
    locale === "en" ? "Download Android App" : "Download Aplikasi Android",
    locale === "en"
      ? "Download the official Morgen Geschäft Android APK."
      : "Download APK Android resmi Morgen Geschäft."
  );

  const handleDownloadApk = () => {
    window.location.assign(ANDROID_APK_URL);
  };

  const handleBackFromInstall = () => {
    returnToCapturedContext(navigate, location.state, "install-app");
  };

  return (
    <div
      style={{ fontFamily: "'Work Sans', sans-serif", background: "#F6F1E7", minHeight: "100vh" }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .install-page-card{border-radius:18px;overflow:hidden}
        .install-page-preview{border-radius:16px;overflow:hidden}
        .install-page-badge{border-radius:8px}
        .install-page-action-btn{border-radius:10px}
        .install-page-feature{border-radius:12px}
        .install-page-brand-logo{border-radius:14px}
        @media(max-width:900px){
          .install-page-card{display:block!important;max-width:520px!important;margin:0 auto!important;padding:26px!important;text-align:center!important}
          .install-page-copy{width:100%!important;margin-bottom:22px!important;text-align:center!important}
          .install-page-card h1{max-width:100%!important;margin-left:auto!important;margin-right:auto!important}
          .install-page-card p{max-width:100%!important;margin-left:auto!important;margin-right:auto!important}
          .install-page-badges{justify-content:center!important}
          .install-page-actions{display:flex!important;flex-direction:column!important;gap:10px!important;width:100%!important}
          .install-page-actions button{width:100%!important;justify-content:center!important}
          .install-page-preview{width:100%!important;text-align:left!important;box-shadow:0 14px 34px rgba(22,43,69,.055)!important}
        }
        @media(max-width:480px){
          .install-page-card{padding:22px!important;border-radius:16px!important}
          .install-page-card h1{font-size:32px!important;line-height:1.08!important}
          .install-page-preview{border-radius:14px!important;padding:14px!important}
          .install-page-feature{border-radius:11px!important}
        }
      `}</style>

      {/* Header */}
      <SimpleBackHeader onBack={handleBackFromInstall} />

      {/* Content */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "42px 24px 56px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #FFF8ED 0%, #F6F1E7 52%, #EEF2E8 100%)",
            border: "1px solid rgba(245,154,26,.22)",
            boxShadow: "0 22px 70px rgba(22,43,69,.07)",
            padding: "clamp(24px, 4vw, 42px)",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.05fr) minmax(220px, .75fr)",
            gap: "28px",
            alignItems: "center",
          }}
          className="install-premium-card install-page-card"
        >
          <div className="install-page-copy" style={{ textAlign: "left" }}>
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10px",
                color: "#F59A1A",
                letterSpacing: ".12em",
                marginBottom: "10px",
              }}
            >
              APP EXPERIENCE
            </p>
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(30px, 4vw, 44px)",
                color: "#162B45",
                lineHeight: 1.08,
                marginBottom: "14px",
              }}
            >
              Download Morgen Geschäft
            </h1>
            <p
              style={{
                fontSize: "15px",
                color: "#6B6558",
                lineHeight: 1.75,
                maxWidth: "540px",
                marginBottom: "24px",
              }}
            >
              Download aplikasi Android Morgen Geschäft, lalu buka file APK yang selesai diunduh
              untuk melanjutkan pemasangan di HP.
            </p>

            <div
              className="install-page-badges"
              style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "26px" }}
            >
              {["Cepat dibuka", "Ringan", "Gratis", "Praktis"].map((item) => (
                <span
                  key={item}
                  className="install-page-badge"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    color: "#173B5E",
                    border: "1px solid rgba(23,59,94,.14)",
                    background: "rgba(255,255,255,.58)",
                    padding: "6px 9px",
                    borderRadius: "8px",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>

            <div
              className="install-page-actions"
              style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
            >
              <button
                className="premium-primary-btn install-page-action-btn"
                onClick={handleDownloadApk}
                style={{
                  background: "#1F2E22",
                  color: "#F6F1E7",
                  fontFamily: "'Work Sans', sans-serif",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "13px 24px",
                  border: "none",
                  borderRadius: "10px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <ShoppingBag size={16} /> Download APK Android
              </button>

              <button
                className="install-page-action-btn"
                onClick={() =>
                  navigate(route("home"), {
                    state: { restoreSection: "katalog", returnTransition: "home" },
                  })
                }
                style={{
                  background: "rgba(255,255,255,.48)",
                  color: "#162B45",
                  fontFamily: "'Work Sans', sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  padding: "12px 20px",
                  border: "1px solid #D7D0BF",
                  borderRadius: "10px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                Langsung Belanja <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div
            className="install-page-preview"
            style={{
              background: "rgba(255,255,255,.55)",
              border: "1px solid rgba(227,220,201,.9)",
              padding: "18px",
              borderRadius: "16px",
              boxShadow: "0 18px 48px rgba(22,43,69,.07)",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}
            >
              <img
                className="install-page-brand-logo"
                src="/photos/logo-512.webp"
                alt="Logo"
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  boxShadow: "0 10px 24px rgba(22,43,69,.08)",
                }}
              />
              <div>
                <p
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: "18px",
                    color: "#162B45",
                    marginBottom: "2px",
                  }}
                >
                  Morgen Geschäft
                </p>
                <p style={{ fontSize: "12px", color: "#6B6558" }}>Belanja skincare lebih praktis</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
              {[
                {
                  icon: <ExternalLink size={17} />,
                  title: "Akses cepat",
                  desc: "Buka toko dari layar utama.",
                },
                {
                  icon: <Bell size={17} />,
                  title: "Info penting",
                  desc: "Promo dan update produk seperlunya.",
                },
                {
                  icon: <Package size={17} />,
                  title: "Pesanan mudah",
                  desc: "Lebih cepat kembali cek katalog dan pesanan.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="premium-install-feature install-page-feature"
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    background: "rgba(246,241,231,.78)",
                    border: "1px solid #E3DCC9",
                    borderRadius: "12px",
                    padding: "13px",
                  }}
                >
                  <span
                    className="premium-install-icon"
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "12px",
                      background:
                        "linear-gradient(135deg, rgba(245,154,26,.16), rgba(23,59,94,.08))",
                      border: "1px solid rgba(245,154,26,.22)",
                      color: "#F59A1A",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 8px 20px rgba(22,43,69,.055)",
                    }}
                  >
                    {f.icon}
                  </span>
                  <div>
                    <p
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#162B45",
                        marginBottom: "2px",
                      }}
                    >
                      {f.title}
                    </p>
                    <p style={{ fontSize: "12px", color: "#6B6558", lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  const { locale, route } = useLocale();
  usePageMeta(
    locale === "en" ? "Page Not Found" : "Halaman Tidak Ditemukan",
    locale === "en"
      ? "The page you are looking for could not be found."
      : "Halaman yang kamu cari tidak ditemukan."
  );
  return (
    <div
      style={{
        fontFamily: "'Work Sans', sans-serif",
        background: "#F6F1E7",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "18px 24px" }}>
        <LanguageSwitcher />
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          textAlign: "center",
        }}
      >
        <Leaf size={48} color="#C9C2AD" strokeWidth={1.2} style={{ marginBottom: "20px" }} />
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "48px",
            color: "#162B45",
            marginBottom: "8px",
          }}
        >
          404
        </h1>
        <p style={{ fontSize: "16px", color: "#6B6558", marginBottom: "24px" }}>
          Halaman yang kamu cari tidak ditemukan.
        </p>
        <button
          onClick={() => navigate(route("home"))}
          style={{
            background: "#1F2E22",
            color: "#F6F1E7",
            fontFamily: "'Work Sans', sans-serif",
            fontWeight: 600,
            fontSize: "14px",
            padding: "12px 28px",
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} /> Kembali ke Beranda
        </button>
      </div>
    </div>
  );
}
