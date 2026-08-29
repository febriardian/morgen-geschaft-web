import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, Leaf, ChevronRight, Check, Search, Share2, Heart, Star, BadgeCheck, ShieldCheck, PackageCheck } from "lucide-react";
import { LabTag, OptimizedImage } from "../../components/shared/Media.jsx";
import { StandalonePageHero, StandaloneSectionHeader } from "../../components/shared/Transitions.jsx";
import { ProductGridSkeleton } from "../../components/shared/Skeletons.jsx";
import { API_BASE, CATEGORIES } from "../../config/constants.js";
import { usePageMeta } from "../../hooks/usePageMeta.js";
import { analytics } from "../../services/analytics.js";
import { formatIDR, generateQRUrl, resolveProductImage, toSlug } from "../../utils/general.js";
import { useLocale } from "../../i18n/LocaleContext.jsx";



// ========== BACK-IN-STOCK NOTIFY (inline) ==========
function BackInStockNotify({ productId, productName }) {
  const { t } = useLocale();
  const [bisEmail, setBisEmail] = useState("");
  const [bisStatus, setBisStatus] = useState("idle");
  const [bisMsg, setBisMsg] = useState("");
  const submit = async () => {
    if (!bisEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bisEmail.trim())) { setBisStatus("error"); setBisMsg(t("Masukkan email yang valid.", "Enter a valid email address.")); return; }
    setBisStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/notify-stock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: bisEmail.trim(), productId, productName }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Gagal mendaftar.", "Could not register your email."));
      setBisStatus("success"); setBisMsg(data.message || t("Kamu akan dinotifikasi saat produk tersedia.", "You will be notified when the product is available."));
    } catch (err) { setBisStatus("error"); setBisMsg(err.message); }
  };
  if (bisStatus === "success") return <div style={{ background: "#DCE6D6", padding: "12px 14px", marginTop: "12px", fontSize: "13px", color: "#1F2E22", fontFamily: "'Work Sans', sans-serif", display: "flex", alignItems: "center", gap: "8px" }}><span>🔔</span><span>{bisMsg}</span></div>;
  return (
    <div style={{ background: "#FFF8F0", border: "1px solid #F0E0D0", padding: "14px", marginTop: "12px" }}>
      <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#8B6914", fontWeight: 600, marginBottom: "8px" }}>{t("🔔 Beritahu saya saat tersedia", "🔔 Notify me when available")}</p>
      <div style={{ display: "flex", gap: "8px" }}>
        <input type="email" value={bisEmail} onChange={(e) => { setBisEmail(e.target.value); setBisStatus("idle"); setBisMsg(""); }} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={t("Email kamu", "Your email")} style={{ flex: 1, fontFamily: "'Work Sans', sans-serif", fontSize: "13px", border: "1px solid #E3DCC9", padding: "8px 12px", outline: "none", background: "#fff" }} />
        <button onClick={submit} disabled={bisStatus === "loading"} style={{ background: bisStatus === "loading" ? "#C9C2AD" : "#1F2E22", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, padding: "8px 16px", border: "none", cursor: bisStatus === "loading" ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>{bisStatus === "loading" ? "..." : t("Notifikasi", "Notify me")}</button>
      </div>
      {bisStatus === "error" && bisMsg && <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#C97B5E", marginTop: "6px" }}>{bisMsg}</p>}
    </div>
  );
}



function reviewDateValue(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value === "object" && typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function reviewDateLabel(value, locale = "id") {
  const timestamp = reviewDateValue(value);
  if (!timestamp) return "Tanggal tidak tersedia";
  return new Date(timestamp).toLocaleDateString(locale === "en" ? "en-GB" : "id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function reviewerInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function reviewPhoto(review) {
  return review?.photoUrl || review?.photo || review?.image || review?.reviewImage || "";
}

function ProductReviews({ productName }) {
  const { locale } = useLocale();
  const [prvReviews, setPrvReviews] = useState([]);
  const [prvLoading, setPrvLoading] = useState(true);

  useEffect(() => {
    if (!productName) {
      setPrvLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/testimoni`, { headers: { Accept: "application/json" } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Gagal mengambil ulasan.");
        const filtered = (Array.isArray(data.reviews) ? data.reviews : [])
          .filter((review) => review.produk === productName)
          .sort((a, b) => reviewDateValue(b.createdAt) - reviewDateValue(a.createdAt));

        if (!cancelled) {
          setPrvReviews(filtered);
          setPrvLoading(false);
        }
      } catch {
        if (!cancelled) setPrvLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [productName]);

  const totalReviews = prvReviews.length;
  const averageRating = totalReviews
    ? prvReviews.reduce((total, review) => total + Number(review.rating || 5), 0) / totalReviews
    : 0;
  const verifiedCount = prvReviews.filter((review) => review.verifiedPurchase || review.verified || review.orderId).length;
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: prvReviews.filter((review) => Number(review.rating || 5) === rating).length,
  }));

  return (
    <section className="product-detail-section product-review-section" aria-labelledby="product-review-title">
      <div className="product-detail-section-heading">
        <div>
          <p className="product-detail-eyebrow">ULASAN PRODUK</p>
          <h2 id="product-review-title">Apa kata pelanggan</h2>
          <p>{totalReviews ? `${totalReviews} ulasan untuk ${productName}` : `Belum ada ulasan untuk ${productName}`}</p>
        </div>

        {totalReviews > 0 && (
          <div className="product-review-score-head" aria-label={`Rating rata-rata ${averageRating.toFixed(1)} dari 5`}>
            <strong>{averageRating.toFixed(1)}</strong>
            <div>
              <div className="product-star-row" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={14} fill={star <= Math.round(averageRating) ? "currentColor" : "none"} />
                ))}
              </div>
              <span>{totalReviews} ulasan</span>
            </div>
          </div>
        )}
      </div>

      {prvLoading ? (
        <div className="product-review-loading">
          <div />
          <div />
          <div />
        </div>
      ) : totalReviews === 0 ? (
        <div className="product-review-empty">
          <div className="product-review-empty-icon"><Star size={24} /></div>
          <div>
            <h3>Belum ada cerita dari pelanggan</h3>
            <p>Jadilah pelanggan pertama yang membagikan pengalaman memakai produk ini.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="product-review-summary">
            <div className="product-rating-breakdown">
              {distribution.map(({ rating, count }) => (
                <div className="product-rating-row" key={rating}>
                  <span>{rating}<Star size={11} fill="currentColor" /></span>
                  <div className="product-rating-track" aria-hidden="true">
                    <div style={{ width: `${(count / totalReviews) * 100}%` }} />
                  </div>
                  <small>{count}</small>
                </div>
              ))}
            </div>

            <div className="product-verified-note">
              <div className="product-verified-note-icon"><BadgeCheck size={22} /></div>
              <div>
                <h3>Ulasan terverifikasi</h3>
                <p>Badge terverifikasi diberikan setelah admin memeriksa ulasan pelanggan dan keterkaitannya dengan pesanan.</p>
                <span>{verifiedCount} dari {totalReviews} ulasan telah terverifikasi</span>
              </div>
            </div>
          </div>

          <div className="product-review-grid">
            {prvReviews.slice(0, 6).map((review, index) => {
              const verified = Boolean(review.verifiedPurchase || review.verified || review.orderId);
              const photo = reviewPhoto(review);
              return (
                <article className="product-review-card" key={review.id} style={{ "--product-review-delay": `${index * 60}ms` }}>
                  <div className="product-review-card-top">
                    <div className="product-star-row" aria-label={`${review.rating || 5} dari 5 bintang`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} size={15} fill={star <= Number(review.rating || 5) ? "currentColor" : "none"} />
                      ))}
                    </div>
                    <time>{reviewDateLabel(review.createdAt, locale)}</time>
                  </div>

                  {photo && (
                    <div className="product-review-photo">
                      <img src={photo} alt={`Foto ulasan dari ${review.nama || "pelanggan"}`} loading="lazy" />
                    </div>
                  )}

                  <blockquote>“{review.komentar}”</blockquote>

                  <div className="product-review-author">
                    <div className="product-review-avatar">{reviewerInitials(review.nama)}</div>
                    <div>
                      <div className="product-review-author-line">
                        <strong>{review.nama || "Pelanggan"}</strong>
                        {verified && <span><BadgeCheck size={14} /> Terverifikasi</span>}
                      </div>
                      <small>{review.orderId ? `Pesanan ${review.orderId}` : "Pelanggan Morgen Geschäft"}</small>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {totalReviews > 6 && (
            <p className="product-review-more">Menampilkan 6 dari {totalReviews} ulasan terbaru.</p>
          )}
        </>
      )}
    </section>
  );
}



// QR Code modal for product
function ProductQRModal({ product, siteUrl, onClose }) {
  const { route } = useLocale();
  if (!product) return null;
  const productUrl = `${siteUrl}${route("product", { id: `${toSlug(product.name)}-${product.id}` })}`;
  const qrUrl = generateQRUrl(productUrl, 300);

  const downloadQR = async () => {
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QR-${product.name.replace(/[^a-zA-Z0-9]/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Gagal download QR. Coba klik kanan gambar → Save Image."); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", maxWidth: "380px", width: "100%", padding: "28px", textAlign: "center", fontFamily: "'Work Sans', sans-serif" }}>
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", color: "#162B45", marginBottom: "4px" }}>{product.name}</h3>
        <p style={{ fontSize: "11px", color: "#A39E8E", marginBottom: "16px", wordBreak: "break-all" }}>{productUrl}</p>
        <img src={qrUrl} alt={`QR Code ${product.name}`} loading="lazy" style={{ width: "200px", height: "200px", margin: "0 auto 16px", border: "1px solid #E3DCC9" }} />
        <p style={{ fontSize: "12px", color: "#6B6558", marginBottom: "16px" }}>Scan untuk langsung ke halaman produk ini</p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <button onClick={downloadQR} style={{ background: "#1F2E22", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: "13px", padding: "8px 20px", border: "none", cursor: "pointer" }}>
            Download PNG
          </button>
          <button onClick={() => { navigator.clipboard.writeText(productUrl); }} style={{ border: "1px solid #E3DCC9", background: "#fff", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", padding: "8px 20px", cursor: "pointer", color: "#6B6558" }}>
            Copy URL
          </button>
          <button onClick={onClose} style={{ border: "1px solid #E3DCC9", background: "#fff", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", padding: "8px 20px", cursor: "pointer", color: "#6B6558" }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}



const VERIFIED_PRODUCT_DETAILS = {
  p1: {
    source: "Kahf — halaman resmi produk",
    sourceUrl: "https://www.kahfeveryday.com/en/product/kahf-oil-and-acne-care-face-wash/",
    summary: "Pembersih wajah pria untuk kulit berminyak dan rentan berjerawat yang membantu menjaga kelembapan sambil mengangkat minyak berlebih.",
    content: "100 ml",
    category: "Face wash pria",
    packaging: "Tube flip-top",
    suitableFor: "Kulit berminyak & rentan berjerawat",
    keyIngredients: ["Zinc Gluconate", "Salicylic Acid", "Kaolin", "Sage Leaf Extract"],
  },
  p2: {
    source: "Kahf — halaman resmi produk",
    sourceUrl: "https://www.kahfeveryday.com/en/product/kahf-skin-energizing-and-brightening-face-wash/",
    summary: "Pembersih wajah pria untuk membantu kulit terasa segar, tampak cerah, tetap terhidrasi, dan bebas minyak hingga 12 jam.",
    content: "100 ml",
    category: "Face wash pria",
    packaging: "Tube flip-top",
    suitableFor: "Kulit kusam, berminyak, atau kurang terhidrasi",
    keyIngredients: ["Niacinamide", "Kaolin", "Spearmint Leaf Extract", "Grapefruit Fruit Extract"],
  },
  p3: {
    source: "Kahf — halaman resmi produk",
    sourceUrl: "https://www.kahfeveryday.com/en/product/kahf-bright-revitalizing-aminogel-face-wash/",
    summary: "Face wash lembut ber-pH rendah dengan formula non-foaming untuk membantu kulit tampak lebih cerah.",
    content: "100 ml",
    category: "Face wash pria",
    packaging: "Tube flip-top",
    suitableFor: "Semua jenis kulit, termasuk kulit sensitif",
    keyIngredients: ["Niacinamide", "3-O-Ethyl Ascorbic Acid", "Panthenol", "Licorice Root Extract", "15 Amino Acids"],
  },
  p4: {
    source: "Kahf — halaman resmi produk",
    sourceUrl: "https://www.kahfeveryday.com/en/product/kahf-triple-action-oil-and-comedo-defense-face-wash/",
    summary: "Pembersih wajah pria 3-in-1 untuk membantu mengontrol minyak berlebih, melawan komedo, dan menjaga kulit tetap bersih.",
    content: "100 ml",
    category: "Face wash pria",
    packaging: "Tube flip-top",
    suitableFor: "Kulit berminyak & berkomedo",
    keyIngredients: ["Kaolin", "Bentonite", "Charcoal Powder", "Salicylic Acid", "Tea Tree Oil"],
  },
  p5: {
    source: "Somethinc — halaman resmi produk",
    sourceUrl: "https://www.somethinc.com/en/product/detail/low-ph-gentle-jelly-cleanser",
    summary: "Pembersih wajah bertekstur jelly dengan pH rendah yang dirancang lembut dan tidak membuat kulit terasa tertarik.",
    content: "100 ml",
    category: "Face cleanser",
    packaging: "Tube flip-top",
    suitableFor: "Semua jenis kulit, termasuk kulit sensitif",
    keyIngredients: ["Japanese Mugwort", "Tea Tree", "Centella Asiatica", "Calendula", "Peppermint"],
  },
  p6: {
    source: "Wardah — halaman resmi produk",
    sourceUrl: "https://www.wardahbeauty.com/id/product/skincare/crystal-secret-foaming-cleanser-with-natural-ahapha",
    summary: "Foaming cleanser yang membantu mengangkat sel kulit mati, minyak, kotoran, dan sisa makeup secara lembut.",
    content: "100 ml",
    category: "Foaming cleanser",
    packaging: "Tube flip-top",
    suitableFor: "Semua jenis kulit",
    keyIngredients: ["Natural AHA", "PHA", "Sustainable Moistbeads", "Edelweiss Extract"],
  },
  p7: {
    source: "Kahf — halaman resmi produk",
    sourceUrl: "https://www.kahfeveryday.com/en/product/kahf-acne-fight-and-relaxing-body-wash/",
    summary: "Body wash pria yang membantu merawat jerawat tubuh dan kemerahan, membersihkan kulit, serta menjaga hidrasi.",
    content: "200 ml",
    category: "Body wash pria",
    packaging: "Botol flip-top",
    suitableFor: "Kulit tubuh yang rentan jerawat & kemerahan",
    keyIngredients: ["Zinc PCA", "Panthenol", "Menthol", "Allantoin", "Spearmint Leaf Extract"],
  },
  p8: {
    source: "Implora — halaman resmi produk",
    sourceUrl: "https://implora.co.id/implora-perfect-shield-sunscreen-en",
    summary: "Gel sunscreen ringan SPF 40 PA++++ untuk membantu melindungi kulit dari UVA dan UVB tanpa terasa lengket.",
    content: "50 ml",
    category: "Gel sunscreen SPF 40 PA++++",
    packaging: "Tube flip-top",
    suitableFor: "Kulit yang membutuhkan perlindungan UVA/UVB harian",
    keyIngredients: ["Hyaluronic Acid", "Almond Extract", "Aloe Vera Extract"],
  },
  p9: {
    source: "Watsons Indonesia — informasi produk",
    sourceUrl: "https://www.watsons.co.id/en/the-originote-acne-b5-serum-20ml/p/BP_39669",
    summary: "Serum untuk kulit berjerawat yang membantu merawat jerawat, minyak berlebih, dan kemerahan.",
    content: "20 ml",
    category: "Acne serum",
    packaging: "Botol pump",
    suitableFor: "Kulit berjerawat & cenderung berminyak",
    keyIngredients: ["Salicylic Acid", "Panthenol", "Tamanu Oil"],
  },
  kahfAcnePore: {
    source: "Watsons Indonesia — informasi produk",
    sourceUrl: "https://www.watsons.co.id/en/kahf-acne-and-pore-cleanse-scrub-face-wash-100-ml/p/BP_42102",
    summary: "Scrub face wash pria dengan Cica+ Complex dan butiran UltraSpherical untuk membantu membersihkan pori, mengangkat sel kulit mati, dan merawat kulit rentan jerawat tanpa membuat kering.",
    content: "100 ml",
    category: "Face wash pria (scrub)",
    packaging: "Tube flip-top",
    suitableFor: "Kulit berminyak, berpori besar & rentan jerawat",
    keyIngredients: ["Salicylic Acid", "Niacinamide", "Centella Asiatica", "Allantoin", "Camellia Sinensis Leaf Extract"],
  },
};

const VERIFIED_PRODUCT_DETAILS_EN = {
  p1: {
    source: "Official Kahf product page",
    sourceUrl: "https://www.kahfeveryday.com/en/product/kahf-oil-and-acne-care-face-wash/",
    summary: "A men's face wash for oily skin that is prone to acne. It helps maintain moisture while removing excess oil.",
    content: "100 ml",
    category: "Men's face wash",
    packaging: "Flip top tube",
    suitableFor: "Oily skin that is prone to acne",
    keyIngredients: ["Zinc Gluconate", "Salicylic Acid", "Kaolin", "Sage Leaf Extract"],
  },
  p2: {
    source: "Official Kahf product page",
    sourceUrl: "https://www.kahfeveryday.com/en/product/kahf-skin-energizing-and-brightening-face-wash/",
    summary: "A men's face wash that helps the skin feel fresh, look brighter, stay hydrated, and remain free from excess oil for up to 12 hours.",
    content: "100 ml",
    category: "Men's face wash",
    packaging: "Flip top tube",
    suitableFor: "Dull, oily, or dehydrated skin",
    keyIngredients: ["Niacinamide", "Kaolin", "Spearmint Leaf Extract", "Grapefruit Fruit Extract"],
  },
  p3: {
    source: "Official Kahf product page",
    sourceUrl: "https://www.kahfeveryday.com/en/product/kahf-bright-revitalizing-aminogel-face-wash/",
    summary: "A gentle face wash with a low pH and a formula that does not create much foam. It helps the skin look brighter without leaving it dry.",
    content: "100 ml",
    category: "Men's face wash",
    packaging: "Flip top tube",
    suitableFor: "All skin types, including sensitive skin",
    keyIngredients: ["Niacinamide", "3-O-Ethyl Ascorbic Acid", "Panthenol", "Licorice Root Extract", "15 Amino Acids"],
  },
  p4: {
    source: "Official Kahf product page",
    sourceUrl: "https://www.kahfeveryday.com/en/product/kahf-triple-action-oil-and-comedo-defense-face-wash/",
    summary: "A men's face wash with three main benefits. It helps control excess oil, care for comedones, and keep the skin clean.",
    content: "100 ml",
    category: "Men's face wash",
    packaging: "Flip top tube",
    suitableFor: "Oily skin with comedones",
    keyIngredients: ["Kaolin", "Bentonite", "Charcoal Powder", "Salicylic Acid", "Tea Tree Oil"],
  },
  p5: {
    source: "Official Somethinc product page",
    sourceUrl: "https://www.somethinc.com/en/product/detail/low-ph-gentle-jelly-cleanser",
    summary: "A gentle jelly cleanser with a low pH. It cleans the face without leaving the skin feeling dry or tight.",
    content: "100 ml",
    category: "Face cleanser",
    packaging: "Flip top tube",
    suitableFor: "All skin types, including sensitive skin",
    keyIngredients: ["Japanese Mugwort", "Tea Tree", "Centella Asiatica", "Calendula", "Peppermint"],
  },
  p6: {
    source: "Official Wardah product page",
    sourceUrl: "https://www.wardahbeauty.com/id/product/skincare/crystal-secret-foaming-cleanser-with-natural-ahapha",
    summary: "A foaming cleanser that gently helps remove dead skin cells, excess oil, dirt, and makeup residue.",
    content: "100 ml",
    category: "Foaming cleanser",
    packaging: "Flip top tube",
    suitableFor: "All skin types",
    keyIngredients: ["Natural AHA", "PHA", "Sustainable Moistbeads", "Edelweiss Extract"],
  },
  p7: {
    source: "Official Kahf product page",
    sourceUrl: "https://www.kahfeveryday.com/en/product/kahf-acne-fight-and-relaxing-body-wash/",
    summary: "A men's body wash that helps care for body acne and redness. It cleans the skin while helping maintain hydration.",
    content: "200 ml",
    category: "Men's body wash",
    packaging: "Flip top bottle",
    suitableFor: "Body skin that is prone to acne and redness",
    keyIngredients: ["Zinc PCA", "Panthenol", "Menthol", "Allantoin", "Spearmint Leaf Extract"],
  },
  p8: {
    source: "Official Implora product page",
    sourceUrl: "https://implora.co.id/implora-perfect-shield-sunscreen-en",
    summary: "A lightweight SPF 40 PA++++ sunscreen gel that helps protect the skin from UVA and UVB without feeling sticky.",
    content: "50 ml",
    category: "SPF 40 PA++++ sunscreen gel",
    packaging: "Flip top tube",
    suitableFor: "Skin that needs daily UVA and UVB protection",
    keyIngredients: ["Hyaluronic Acid", "Almond Extract", "Aloe Vera Extract"],
  },
  p9: {
    source: "Watsons Indonesia product information",
    sourceUrl: "https://www.watsons.co.id/en/the-originote-acne-b5-serum-20ml/p/BP_39669",
    summary: "A serum for skin that is prone to acne. It helps care for breakouts, excess oil, and redness.",
    content: "20 ml",
    category: "Acne care serum",
    packaging: "Pump bottle",
    suitableFor: "Oily skin that is prone to acne",
    keyIngredients: ["Salicylic Acid", "Panthenol", "Tamanu Oil"],
  },
  kahfAcnePore: {
    source: "Watsons Indonesia product information",
    sourceUrl: "https://www.watsons.co.id/en/kahf-acne-and-pore-cleanse-scrub-face-wash-100-ml/p/BP_42102",
    summary: "A men's scrub face wash with Cica+ Complex and UltraSpherical scrub beads that helps clean pores, lift dead skin cells, and care for acne-prone skin without over-drying.",
    content: "100 ml",
    category: "Men's scrub face wash",
    packaging: "Flip top tube",
    suitableFor: "Oily, large-pored & acne-prone skin",
    keyIngredients: ["Salicylic Acid", "Niacinamide", "Centella Asiatica", "Allantoin", "Camellia Sinensis Leaf Extract"],
  },
};

function findVerifiedProductDetails(product, locale = "id") {
  if (!product) return null;
  const details = locale === "en" ? VERIFIED_PRODUCT_DETAILS_EN : VERIFIED_PRODUCT_DETAILS;
  if (details[product.id]) return details[product.id];

  const normalizedName = String(product.name || "").toLowerCase();
  if (normalizedName.includes("skin energizing") || normalizedName.includes("energizing and brightening")) return details.p2;
  if (normalizedName.includes("oil and acne care")) return details.p1;
  if (normalizedName.includes("bright revitalizing aminogel")) return details.p3;
  if (normalizedName.includes("triple action oil and comedo")) return details.p4;
  if (normalizedName.includes("low ph gentle jelly cleanser")) return details.p5;
  if (normalizedName.includes("crystal secret") && (normalizedName.includes("cleanser") || normalizedName.includes("facewash"))) return details.p6;
  if (normalizedName.includes("acne fight") && normalizedName.includes("body wash")) return details.p7;
  if (normalizedName.includes("perfect shield") && normalizedName.includes("sunscreen")) return details.p8;
  if (normalizedName.includes("acne b5 serum")) return details.p9;
  if (normalizedName.includes("acne and pore cleanse") || normalizedName.includes("acne & pore cleanse")) return details.kahfAcnePore;
  return null;
}

function buildBundleDetails(product, products = [], locale = "id") {
  const items = (product.bundleItems || [])
    .map((itemId) => products.find((candidate) => candidate.id === itemId))
    .filter(Boolean);

  if (!items.length) return null;

  const itemNames = items.map((item) => item.name);
  const keyIngredients = [...new Set(items.flatMap((item) => findVerifiedProductDetails(item, locale)?.keyIngredients || item.ingredients || []))].slice(0, 6);
  const normalizedName = String(product.name || "").toLowerCase();
  const isEnglish = locale === "en";
  const suitableFor = normalizedName.includes("acne")
    ? (isEnglish ? "Oily skin that is prone to acne" : "Kulit berminyak & rentan berjerawat")
    : normalizedName.includes("protection")
      ? (isEnglish ? "A daily skin protection routine" : "Rutinitas perlindungan kulit harian")
      : (isEnglish ? "A care routine based on the products in the bundle" : "Rutinitas perawatan sesuai isi paket");

  return {
    source: isEnglish ? "Morgen Geschäft catalog and bundle data" : "data paket dan produk di katalog Morgen Geschäft",
    sourceUrl: null,
    isBundle: true,
    summary: isEnglish
      ? `This bundle includes ${itemNames.join(" and ")}. The bundle price is lower than buying each product separately.`
      : `Paket berisi ${itemNames.join(" dan ")} dengan harga paket yang lebih hemat daripada pembelian satuan.`,
    content: isEnglish ? `${items.length} products` : `${items.length} produk`,
    category: isEnglish ? "Care bundle" : "Paket perawatan",
    packaging: isEnglish ? "Packed together as one bundle" : "Dikemas sebagai satu paket",
    suitableFor,
    keyIngredients,
  };
}

function getVerifiedProductDetails(product, products = [], locale = "id") {
  return findVerifiedProductDetails(product, locale)
    || (product?.category === "bundle" ? buildBundleDetails(product, products, locale) : null);
}

// ---------- Halaman Detail Produk (URL unik /produk/:id) ----------

function ProductDetailPage({ product, products, onAdd, onBack, onShare, shared, onOpen }) {
  const { locale, t } = useLocale();
  const allImages = ((product.images && product.images.length > 0)
    ? product.images
    : (product.image ? [product.image] : []))
    .map((image) => resolveProductImage(image))
    .filter(Boolean);
  const [activeImg, setActiveImg] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const verifiedDetails = getVerifiedProductDetails(product, products, locale);
  const displayBlurb = verifiedDetails?.summary || product.blurb;
  const displayIngredients = verifiedDetails?.keyIngredients || product.ingredients || [];

  usePageMeta(
    product.name,
    displayBlurb,
    product.image ? `${window.location.origin}${resolveProductImage(product.image)}` : null
  );

  const related = products
    .filter((item) => item.id !== product.id && item.category === product.category && item.category !== "bundle")
    .slice(0, 4);

  const complementary = products
    .filter((item) => item.id !== product.id && item.category !== product.category && item.category !== "bundle" && item.stock > 0)
    .slice(0, 3);

  const categoryLabelRaw = CATEGORIES.find((category) => category.id === product.category)?.label || "Produk";
  const categoryLabel = locale === "en" && categoryLabelRaw === "Produk" ? "Product" : categoryLabelRaw;
  const stock = Number(product.stock || 0);
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 3;

  const fallbackPackaging = locale === "en"
    ? {
        facewash: "Flip top tube",
        bodywash: "Flip top bottle",
        sunscreen: "Flip top tube",
        serum: "Bottle",
        bundle: "Packed together as one bundle",
      }
    : {
        facewash: "Tube flip-top",
        bodywash: "Botol flip-top",
        sunscreen: "Tube flip-top",
        serum: "Botol",
        bundle: "Dikemas sebagai satu paket",
      };

  const availabilityLabel = isOutOfStock
    ? t("Stok habis", "Out of stock")
    : isLowStock
      ? t(`Sisa ${stock}`, `Only ${stock} left`)
      : t("Siap dipesan", "Ready to order");

  const detailRows = [
    {
      label: t("Isi", "Contents"),
      value: product.netContent || verifiedDetails?.content || product.content || product.volume || product.isi || (product.category === "bundle"
        ? t(`${product.bundleItems?.length || 0} produk`, `${product.bundleItems?.length || 0} products`)
        : t("Belum dicantumkan", "Not specified")),
    },
    { label: t("Kategori", "Category"), value: verifiedDetails?.category || categoryLabel },
    { label: t("Kondisi", "Condition"), value: t("Baru & tersegel", "New and sealed") },
    ...(product.bpomNumber ? [{ label: "BPOM", value: product.bpomNumber }] : []),
    ...(product.batchInfo ? [{ label: t("Batch", "Batch"), value: product.batchInfo }] : []),
    ...(product.expiryInfo ? [{ label: t("Kedaluwarsa", "Expiry"), value: product.expiryInfo }] : []),
    {
      label: t("Pengemasan", "Packaging"),
      value: verifiedDetails?.packaging || product.packaging || fallbackPackaging[product.category] || t("Kemasan produk", "Product packaging"),
    },
  ];

  const benefitRows = [
    {
      label: t("Cocok untuk", "Suitable for"),
      value: verifiedDetails?.suitableFor || product.suitableFor || product.skinType || t("Ikuti keterangan pada kemasan", "Follow the directions on the packaging"),
    },
    {
      label: t("Kandungan", "Ingredients"),
      value: displayIngredients.slice(0, 5).join(", ") || t("Belum dicantumkan", "Not specified"),
    },
    { label: t("Ketersediaan", "Availability"), value: availabilityLabel },
    { label: t("Harga", "Price"), value: t("Murah", "Affordable") },
  ];

  return (
    <section className="product-detail-page">
      <div className="product-detail-shell">
        <button onClick={onBack} className="product-detail-back">
          <ChevronRight size={15} /> {t("Kembali ke katalog", "Back to catalog")}
        </button>

        <div className="product-detail-main product-detail-grid">
          <div className="product-detail-gallery-card">
            <div
              onClick={() => allImages.length && setLightboxOpen(true)}
              className="product-detail-image-stage"
              role={allImages.length ? "button" : undefined}
              tabIndex={allImages.length ? 0 : undefined}
              onKeyDown={(event) => {
                if (allImages.length && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  setLightboxOpen(true);
                }
              }}
              aria-label={allImages.length ? t(`Perbesar foto ${product.name}`, `Enlarge photo of ${product.name}`) : undefined}
            >
              {allImages.length > 0 ? (
                <OptimizedImage
                  src={allImages[activeImg]}
                  alt={product.name}
                  priority={activeImg === 0}
                  className="product-detail-main-image"
                  sizes="(max-width: 768px) 100vw, 56vw"
                />
              ) : (
                <div className="product-detail-image-fallback">
                  <Leaf size={52} color="#4C6354" strokeWidth={1.3} />
                </div>
              )}
              <div className="product-detail-tag"><LabTag text={product.tag} /></div>
              {allImages.length > 0 && (
                <span className="product-detail-zoom"><Search size={13} /> {t("Perbesar", "Enlarge")}</span>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="product-detail-thumbnails" aria-label={t("Pilih foto produk", "Choose a product photo")}>
                {allImages.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    onClick={() => setActiveImg(index)}
                    aria-label={t(`Foto ${index + 1}`, `Photo ${index + 1}`)}
                    aria-current={activeImg === index}
                    className={activeImg === index ? "is-active" : ""}
                  >
                    <img src={image} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="product-detail-info-panel">
            <p className="product-detail-kicker">{categoryLabel}</p>
            <h1>{product.name}</h1>
            <p className="product-detail-blurb">{displayBlurb}</p>

            <div className="product-detail-trust-row">
              <span><ShieldCheck size={15} /> {t("Produk original", "Authentic product")}</span>
              <span><PackageCheck size={15} /> {t("Dikemas aman", "Securely packed")}</span>
            </div>

            {product.bundleItems && product.bundleItems.length > 0 && (
              <div className="product-detail-bundle">
                <strong>{t("Isi paket", "Package contents")}</strong>
                {product.bundleItems.map((itemId) => {
                  const item = products.find((candidate) => candidate.id === itemId);
                  return item ? <span key={itemId}>{item.name}</span> : null;
                })}
              </div>
            )}

            <div className="product-detail-price-row">
              <strong>{formatIDR(product.price)}</strong>
              {product.originalPrice && <del>{formatIDR(product.originalPrice)}</del>}
              {product.originalPrice > product.price && (
                <span>{t("Hemat", "Save")} {Math.round((1 - product.price / product.originalPrice) * 100)}%</span>
              )}
              {product.flashSale && (
                <em className="flash-sale-product-chip">
                  FLASH SALE −{product.flashSale.discountPercent}%
                </em>
              )}
            </div>

            <div className={`product-detail-stock ${isOutOfStock ? "is-empty" : isLowStock ? "is-low" : "is-ready"}`}>
              <span />
              {isOutOfStock
                ? t("Stok habis", "Out of stock")
                : isLowStock
                  ? t(`Sisa ${stock}. Segera habis`, `Only ${stock} left. Selling out soon`)
                  : t(`Stok tersedia: ${stock}`, `Available stock: ${stock}`)}
            </div>

            {isOutOfStock && <BackInStockNotify productId={product.id} productName={product.name} />}

            <div className="product-detail-actions">
              <button onClick={() => onAdd(product)} disabled={isOutOfStock} className="product-detail-add-button">
                <Plus size={17} /> {isOutOfStock ? t("Stok Habis", "Out of Stock") : t("Tambah ke Keranjang", "Add to Cart")}
              </button>
              <button onClick={onShare} title={t("Bagikan produk", "Share product")} aria-label={t("Bagikan produk", "Share product")} className={`product-detail-share-button ${shared ? "is-shared" : ""}`}>
                {shared ? <Check size={17} /> : <Share2 size={17} />}
              </button>
            </div>

            {displayIngredients.length > 0 && (
              <div className={`product-detail-ingredients ${showIngredients ? "is-open" : ""}`}>
                <button onClick={() => setShowIngredients((current) => !current)} aria-expanded={showIngredients}>
                  <span>{t("Kandungan kunci", "Key ingredients")}</span>
                  <ChevronRight size={17} />
                </button>
                <div className="product-detail-ingredients-content">
                  {displayIngredients.map((ingredient) => <span key={ingredient}>{ingredient}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>

        {(product.warnings || product.warningsEn) && (
          <section className="product-detail-section" aria-labelledby="product-warning-title">
            <div className="product-detail-section-heading">
              <div>
                <p className="product-detail-eyebrow">{t("PERINGATAN", "CAUTION")}</p>
                <h2 id="product-warning-title">{t("Pemakaian dan penyimpanan", "Use and storage")}</h2>
              </div>
              <p>{locale === "en" ? (product.warningsEn || product.warnings) : product.warnings}</p>
            </div>
          </section>
        )}

        <section className="product-detail-section product-overview-section" aria-labelledby="product-info-title">
          <div className="product-detail-section-heading product-overview-heading">
            <div>
              <p className="product-detail-eyebrow">{t("DETAIL PRODUK", "PRODUCT DETAILS")}</p>
              <h2 id="product-info-title">{t("Informasi yang perlu kamu tahu", "Information you need to know")}</h2>
            </div>
            <p>{t("Ringkasan produk dibuat singkat agar lebih mudah dibandingkan sebelum membeli.", "Product summaries are concise so you can compare items more easily before buying.")}</p>
          </div>

          <div className="product-overview-grid">
            <article className="product-fact-card">
              <div className="product-fact-card-title">
                <PackageCheck size={19} />
                <h3>{t("Informasi Produk", "Product Information")}</h3>
              </div>
              <div className="product-fact-list">
                {detailRows.map((row) => (
                  <div className="product-fact-row" key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="product-fact-card product-benefit-card">
              <div className="product-fact-card-title">
                <ShieldCheck size={19} />
                <h3>{t("Keunggulan", "Benefits")}</h3>
              </div>
              <div className="product-fact-list">
                {benefitRows.map((row) => (
                  <div className="product-fact-row" key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <ProductReviews productName={product.name} />

        {complementary.length > 0 && (
          <section className="product-recommendation-section">
            <div className="product-recommendation-heading">
              <div>
                <p className="product-detail-eyebrow">{t("LENGKAPI RUTINITAS", "COMPLETE YOUR ROUTINE")}</p>
                <h2>{t("Sering dibeli bersama", "Frequently bought together")}</h2>
              </div>
              <p>{t("Tambahan yang cocok dipadukan dengan produk pilihanmu.", "Recommended additions that pair well with your selected product.")}</p>
            </div>
            <div className="product-recommendation-grid">
              {complementary.map((item) => (
                <button key={item.id} onClick={() => onOpen(item)} className="product-recommendation-card">
                  <span className="product-recommendation-image">
                    {item.image ? <img src={resolveProductImage(item)} alt="" loading="lazy" /> : <Leaf size={24} />}
                  </span>
                  <span className="product-recommendation-copy">
                    <strong>{item.name}</strong>
                    <small>{item.category ? (CATEGORIES.find((category) => category.id === item.category)?.label || t("Produk", "Product")) : t("Produk", "Product")}</small>
                    <b>{formatIDR(item.price)}</b>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="product-recommendation-section is-related">
            <div className="product-recommendation-heading">
              <div>
                <p className="product-detail-eyebrow">{t("PRODUK SERUPA", "SIMILAR PRODUCTS")}</p>
                <h2>{t("Pilihan lain untuk dibandingkan", "Other options to compare")}</h2>
              </div>
            </div>
            <div className="product-recommendation-grid">
              {related.map((item) => (
                <button key={item.id} onClick={() => onOpen(item)} className="product-recommendation-card">
                  <span className="product-recommendation-image">
                    {item.image ? <img src={resolveProductImage(item)} alt="" loading="lazy" /> : <Leaf size={24} />}
                  </span>
                  <span className="product-recommendation-copy">
                    <strong>{item.name}</strong>
                    <small>{item.tag || categoryLabel}</small>
                    <b>{formatIDR(item.price)}</b>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {lightboxOpen && allImages.length > 0 && (
        <div
          onClick={() => setLightboxOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setLightboxOpen(false);
            if (event.key === "ArrowRight" && activeImg < allImages.length - 1) setActiveImg((current) => current + 1);
            if (event.key === "ArrowLeft" && activeImg > 0) setActiveImg((current) => current - 1);
          }}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          aria-label="Foto produk diperbesar"
          ref={(element) => element?.focus()}
          className="product-lightbox"
        >
          <button onClick={(event) => { event.stopPropagation(); setLightboxOpen(false); }} aria-label="Tutup" className="product-lightbox-close"><X size={20} /></button>
          {allImages.length > 1 && activeImg > 0 && (
            <button onClick={(event) => { event.stopPropagation(); setActiveImg((current) => current - 1); }} aria-label="Foto sebelumnya" className="product-lightbox-nav is-prev">‹</button>
          )}
          {allImages.length > 1 && activeImg < allImages.length - 1 && (
            <button onClick={(event) => { event.stopPropagation(); setActiveImg((current) => current + 1); }} aria-label="Foto selanjutnya" className="product-lightbox-nav is-next">›</button>
          )}
          <img onClick={(event) => event.stopPropagation()} src={allImages[activeImg]} alt={product.name} loading="lazy" />
          {allImages.length > 1 && (
            <div className="product-lightbox-dots">
              {allImages.map((image, index) => (
                <button key={`${image}-dot`} onClick={(event) => { event.stopPropagation(); setActiveImg(index); }} className={index === activeImg ? "is-active" : ""} aria-label={`Tampilkan foto ${index + 1}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}



function ProductCard({ product, onAdd, onOpen, isWishlisted, onToggleWishlist }) {
  const { route, t } = useLocale();
  const [shared, setShared] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  useEffect(() => {
    if (!justAdded) return undefined;
    const timer = setTimeout(() => setJustAdded(false), 1300);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const handleShare = (e) => {
    e.stopPropagation();
    const productUrl = `${window.location.origin}${route("product", { id: `${toSlug(product.name)}-${product.id}` })}`;
    const text = `${product.name} — ${formatIDR(product.price)}\n${product.blurb}\n\n${t("Lihat produk", "View product")}: ${productUrl}`;
    if (navigator.share) {
      navigator.share({ title: product.name, text, url: productUrl });
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <div
      style={{ background: "#FFFFFF", border: "1px solid #E3DCC9", height: "100%" }}
      className="premium-product-card flex flex-col"
    >
      <div
        onClick={() => onOpen(product)}
        role="button"
        tabIndex={0}
        aria-label={`Lihat detail ${product.name}`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(product); } }}
        style={{ height: "0", paddingBottom: "75%", position: "relative", cursor: "pointer" }}
        className="w-full overflow-hidden"
      >
        {product.image ? (
          <OptimizedImage src={resolveProductImage(product)} alt={product.name} className="premium-product-image" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} sizes="(max-width: 768px) 50vw, 25vw" />
        ) : (
          <div
            style={{ background: "linear-gradient(135deg, #DCE6D6 0%, #F6F1E7 60%)", position: "absolute", inset: 0 }}
            className="w-full h-full flex items-center justify-center"
          >
            <Leaf size={34} color="#4C6354" strokeWidth={1.4} />
          </div>
        )}
        <div className="product-card-tag" style={{ position: "absolute", top: 10, left: 10, width: "150px" }}>
          <LabTag text={product.tag} />
        </div>
        <button
          className="premium-icon-btn"
          onClick={(e) => { e.stopPropagation(); onToggleWishlist(product); }}
          title={isWishlisted ? "Hapus dari wishlist" : "Simpan ke wishlist"}
          style={{
            position: "absolute", top: 8, right: 8,
            background: isWishlisted ? "#C97B5E" : "rgba(246,241,231,0.88)",
            border: isWishlisted ? "none" : "1px solid #E3DCC9",
            borderRadius: "50%",
            width: "30px", height: "30px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            backdropFilter: "blur(4px)",
          }}
        >
          <Heart size={14} fill={isWishlisted ? "#fff" : "none"} color={isWishlisted ? "#fff" : "#6B6558"} />
        </button>
        {product.stock <= 3 && product.stock > 0 && (
          <div style={{
            position: "absolute", bottom: 8, right: 8,
            background: "#C97B5E", color: "#fff",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "9px",
            padding: "3px 6px",
          }}>
            Sisa {product.stock}
          </div>
        )}
        {product.stock === 0 && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(246,241,231,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#6B6558", background: "#F6F1E7", padding: "6px 12px", border: "1px solid #E3DCC9" }}>
              STOK HABIS
            </span>
          </div>
        )}
      </div>
      <div className="product-card-body p-4 flex flex-col gap-2 flex-1">
        <h3
          className="product-card-title"
          title={product.name}
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "17px",
            lineHeight: 1.3,
            color: "#162B45",
            minHeight: "44px",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {product.name}
        </h3>
        <p
          title={product.blurb}
          style={{
            fontFamily: "'Work Sans', sans-serif",
            fontSize: "13px",
            color: "#6B6558",
            lineHeight: 1.45,
            minHeight: "57px",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
            overflow: "hidden",
          }}
          className="product-card-description flex-1"
        >
          {product.blurb}
        </p>
        <div className="product-card-footer mt-1" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className={product.flashSale ? "product-card-flash-price" : ""}>
            <span style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: "15px", color: "#1F2E22" }}>
              {formatIDR(product.price)}
            </span>
            {product.flashSale && (
              <>
                <del>{formatIDR(product.flashSale.regularPrice)}</del>
                <em>−{product.flashSale.discountPercent}%</em>
              </>
            )}
          </div>
          <div className="product-card-actions" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              className="premium-icon-btn product-card-share"
              onClick={handleShare}
              title="Bagikan produk"
              style={{
                background: shared ? "#DCE6D6" : "transparent",
                border: `1px solid ${shared ? "#A8C5A0" : "#E3DCC9"}`,
                color: shared ? "#1F2E22" : "#6B6558",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px",
                transition: "all 0.2s",
                flexShrink: 0,
              }}
            >
              {shared ? <Check size={14} /> : <Share2 size={14} />}
            </button>
            <button
              onClick={() => { onAdd(product); setJustAdded(true); }}
              disabled={product.stock === 0}
              style={{
                background: product.stock === 0 ? "#C9C2AD" : justAdded ? "#4C6354" : "#1F2E22",
                color: "#F6F1E7",
                fontFamily: "'Work Sans', sans-serif",
                fontSize: "13px",
                cursor: product.stock === 0 ? "not-allowed" : "pointer",
                flex: 1,
                minWidth: 0,
              }}
              className={`premium-primary-btn product-card-cart px-3 py-1.5 flex items-center justify-center gap-1 hover:opacity-85 transition ${justAdded ? "mg-added" : ""}`}
            >
              {justAdded ? <><Check size={14} /> Ditambahkan</> : <><Plus size={14} /> Keranjang</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}




function CatalogSection({
  products,
  productsLoading,
  mode = "home",
  activeCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  onAdd,
  onOpen,
  wishlist,
  onToggleWishlist,
  onViewAll,
  onBack,
}) {
  const navigate = useNavigate();
  const isPage = mode === "page";
  const [catalogSearch, setCatalogSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  const filteredProducts = useMemo(() => {
    let next = activeCategory === "semua"
      ? [...products]
      : products.filter((product) => product.category === activeCategory);

    if (catalogSearch.trim()) {
      const keyword = catalogSearch.trim().toLowerCase();
      next = next.filter((product) => {
        const ingredientText = Array.isArray(product.ingredients)
          ? product.ingredients.join(" ")
          : "";
        return `${product.name || ""} ${product.tag || ""} ${product.blurb || ""} ${product.category || ""} ${ingredientText}`
          .toLowerCase()
          .includes(keyword);
      });
    }

    if (isPage && stockFilter === "available") {
      next = next.filter((product) => Number(product.stock || 0) > 0);
    } else if (isPage && stockFilter === "empty") {
      next = next.filter((product) => Number(product.stock || 0) <= 0);
    }

    if (isPage && priceFilter === "under-30") {
      next = next.filter((product) => Number(product.price || 0) < 30000);
    } else if (isPage && priceFilter === "30-50") {
      next = next.filter((product) => Number(product.price || 0) >= 30000 && Number(product.price || 0) <= 50000);
    } else if (isPage && priceFilter === "over-50") {
      next = next.filter((product) => Number(product.price || 0) > 50000);
    }

    next.sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      if (sortBy === "name-asc") return a.name.localeCompare(b.name, "id");
      if (sortBy === "stock-desc") return b.stock - a.stock;

      if (!isPage) {
        const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (featuredDiff !== 0) return featuredDiff;
        const stockDiff = Number(b.stock || 0) - Number(a.stock || 0);
        if (stockDiff !== 0) return stockDiff;
      }

      return 0;
    });

    return next;
  }, [products, activeCategory, catalogSearch, stockFilter, priceFilter, sortBy, isPage]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, catalogSearch, stockFilter, priceFilter, sortBy]);

  const isSearching = !isPage && catalogSearch.trim().length > 0;
  const homeProducts = isSearching
    ? filteredProducts.slice(0, 20) // Tampilkan lebih banyak saat user search
    : filteredProducts
        .filter((product) => Number(product.stock || 0) > 0)
        .slice(0, 8);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PER_PAGE));
  const pageProducts = filteredProducts.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const displayedProducts = isPage ? pageProducts : homeProducts;
  const currentCategory = CATEGORIES.find((category) => category.id === activeCategory);
  const hasActiveFilters = isPage && Boolean(
    catalogSearch.trim()
    || stockFilter !== "all"
    || priceFilter !== "all"
    || sortBy !== "default"
    || activeCategory !== "semua"
  );

  const activeFilterLabels = isPage ? [
    catalogSearch.trim() ? `Pencarian: “${catalogSearch.trim()}”` : null,
    activeCategory !== "semua" ? currentCategory?.label : null,
    stockFilter === "available" ? "Stok tersedia" : stockFilter === "empty" ? "Stok habis" : null,
    priceFilter === "under-30" ? "Di bawah Rp30rb" : priceFilter === "30-50" ? "Rp30rb–Rp50rb" : priceFilter === "over-50" ? "Di atas Rp50rb" : null,
    sortBy === "price-asc" ? "Harga termurah" : sortBy === "price-desc" ? "Harga termahal" : sortBy === "name-asc" ? "Nama A–Z" : sortBy === "stock-desc" ? "Stok terbanyak" : null,
  ].filter(Boolean) : [];

  const resetFilters = () => {
    setCatalogSearch("");
    setStockFilter("all");
    setPriceFilter("all");
    setPage(1);
    if (sortBy !== "default") onSortChange("default");
    if (activeCategory !== "semua") onCategoryChange("semua");
  };

  return (
    <section id="katalog" style={{ borderBottom: "1px solid #E3DCC9", background: "#F6F1E7" }}>
      {isPage && (
        <StandalonePageHero
          eyebrow="KATALOG"
          title="Temukan produk sesuai kebutuhan kulitmu."
          description="Cari berdasarkan kategori, stok, harga, atau nama produk. Semua informasi produk ditampilkan dengan jelas agar lebih mudah dibandingkan."
        />
      )}

      <div className={isPage ? "katalog-section-inner standalone-content-shell" : "katalog-section-inner"} style={{ maxWidth: "1280px", margin: "0 auto", padding: isPage ? undefined : "36px 32px" }}>
        {isPage ? (
          <StandaloneSectionHeader
            title={activeCategory === "semua" ? "Semua produk" : currentCategory?.label}
            meta={`${filteredProducts.length} produk ditemukan`}
          />
        ) : (
          <div className="katalog-header" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px", gap: "20px", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#F59A1A", letterSpacing: "0.08em", marginBottom: "4px" }}>
                PRODUK PILIHAN
              </p>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "28px", color: "#162B45" }}>
                Produk pilihan untuk kebutuhan harian
              </h2>
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", marginTop: "6px" }}>
                Delapan pilihan yang tersedia dan mudah dipakai untuk rutinitas sehari-hari.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", minWidth: "180px" }}>
                <Search size={14} color="#A39E8E" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                  placeholder="Cari produk..."
                  style={{ width: "100%", height: "36px", border: "1px solid #E3DCC9", background: "#fff", padding: "0 10px 0 32px", color: "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", outline: "none", borderRadius: "8px" }}
                />
              </div>
              <button
                type="button"
                onClick={onViewAll}
                style={{ border: "1px solid #E3DCC9", background: "#fff", color: "#162B45", borderRadius: "9px", padding: "10px 15px", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                Lihat semua produk
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {isPage && (
          <div className="catalog-filter-panel">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.4fr) repeat(3, minmax(150px, .7fr))", gap: "10px", marginBottom: "12px" }} className="catalog-toolbar">
              <div style={{ position: "relative" }}>
                <Search size={16} color="#A39E8E" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                  placeholder="Cari nama atau bahan aktif..."
                  style={{ width: "100%", height: "42px", border: catalogSearch.trim() ? "1.5px solid #4C6354" : "1px solid #E3DCC9", background: catalogSearch.trim() ? "#FBFDF9" : "#fff", padding: "0 12px 0 38px", color: "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", outline: "none" }}
                />
              </div>

              <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} style={{ height: "42px", border: stockFilter !== "all" ? "1.5px solid #4C6354" : "1px solid #E3DCC9", background: stockFilter !== "all" ? "#FBFDF9" : "#fff", padding: "0 12px", color: "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", cursor: "pointer" }}>
                <option value="all">Semua stok</option>
                <option value="available">Stok tersedia</option>
                <option value="empty">Stok habis</option>
              </select>

              <select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)} style={{ height: "42px", border: priceFilter !== "all" ? "1.5px solid #4C6354" : "1px solid #E3DCC9", background: priceFilter !== "all" ? "#FBFDF9" : "#fff", padding: "0 12px", color: "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", cursor: "pointer" }}>
                <option value="all">Semua harga</option>
                <option value="under-30">Di bawah Rp30rb</option>
                <option value="30-50">Rp30rb–Rp50rb</option>
                <option value="over-50">Di atas Rp50rb</option>
              </select>

              <select value={sortBy} onChange={(event) => onSortChange(event.target.value)} style={{ height: "42px", border: sortBy !== "default" ? "1.5px solid #4C6354" : "1px solid #E3DCC9", background: sortBy !== "default" ? "#FBFDF9" : "#fff", padding: "0 12px", color: "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", cursor: "pointer" }}>
                <option value="default">Urutan default</option>
                <option value="price-asc">Harga termurah</option>
                <option value="price-desc">Harga termahal</option>
                <option value="name-asc">Nama A–Z</option>
                <option value="stock-desc">Stok terbanyak</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "14px", minHeight: "28px" }}>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                {hasActiveFilters ? activeFilterLabels.map((label) => (
                  <span key={label} style={{ display: "inline-flex", alignItems: "center", padding: "5px 8px", borderRadius: "8px", background: "#E8EFE3", color: "#294433", fontFamily: "'Work Sans', sans-serif", fontSize: "11px", fontWeight: 500 }}>
                    {label}
                  </span>
                )) : (
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#A39E8E" }}>Belum ada filter aktif</span>
                )}
              </div>

              {hasActiveFilters && (
                <button type="button" onClick={resetFilters} style={{ border: "none", background: "transparent", color: "#C26F52", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer", padding: "5px 0", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <X size={13} /> Reset filter
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
              {CATEGORIES.map((category) => {
                const count = category.id === "semua"
                  ? products.length
                  : products.filter((product) => product.category === category.id).length;
                const active = activeCategory === category.id;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => onCategoryChange(category.id)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", border: active ? "1.5px solid #1F2E22" : "1px solid #E3DCC9", background: active ? "#1F2E22" : "#fff", color: active ? "#F6F1E7" : "#4C4840", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: active ? 600 : 400, cursor: "pointer", borderRadius: "10px" }}
                  >
                    {category.id === "semua" ? "Semua" : category.label}
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: active ? "#A8C5A0" : "#A39E8E" }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {productsLoading ? (
          <ProductGridSkeleton count={isPage ? 8 : 8} />
        ) : displayedProducts.length > 0 ? (
          <div className="catalog-product-grid">
            {displayedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={onAdd}
                onOpen={onOpen}
                isWishlisted={wishlist.some((item) => item.id === product.id)}
                onToggleWishlist={onToggleWishlist}
              />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Leaf size={32} color="#C9C2AD" strokeWidth={1.2} style={{ marginBottom: "12px" }} />
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", color: "#7B766A", marginBottom: "6px" }}>Produk tidak ditemukan</p>
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#A39E8E", marginBottom: isPage && hasActiveFilters ? "16px" : 0 }}>Coba gunakan kata kunci lain atau hapus filter yang sedang aktif.</p>
            {isPage && hasActiveFilters && (
              <button type="button" onClick={resetFilters} style={{ border: "1px solid #1F2E22", background: "#1F2E22", color: "#F6F1E7", borderRadius: "9px", padding: "9px 16px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <X size={13} /> Hapus semua filter
              </button>
            )}
          </div>
        )}

        {isPage && totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "30px" }}>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => {
                  setPage(pageNumber);
                  document.getElementById("katalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                style={{ width: 38, height: 38, border: "1px solid #E3DCC9", borderRadius: "9px", background: pageNumber === page ? "#1F2E22" : "#fff", color: pageNumber === page ? "#F6F1E7" : "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                {pageNumber}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}



function SearchDropdown({ showSearch, setShowSearch, searchQuery, setSearchQuery, products, openProduct }) {
  const ref = useRef(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return products.filter((product) => {
      const ingredients = Array.isArray(product.ingredients) ? product.ingredients.join(" ") : "";
      const haystack = `${product.name || ""} ${product.blurb || ""} ${product.tag || ""} ${ingredients}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, products]);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery("");
  }, [setShowSearch, setSearchQuery]);

  useEffect(() => {
    if (!showSearch) return undefined;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    const handleClickOutside = (event) => {
      if (!isMobile && ref.current && !ref.current.contains(event.target)) {
        setShowSearch(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") closeSearch();
    };

    if (isMobile) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [showSearch, setShowSearch, closeSearch]);

  const handleInputChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    clearTimeout(window.__mgSearchTimer);
    if (value.trim().length >= 2) {
      window.__mgSearchTimer = setTimeout(() => analytics.search(value.trim()), 800);
    }
  };

  return (
    <div ref={ref} className="header-search-wrap" style={{ position: "relative", flexShrink: 0 }}>
      <button
        className="premium-icon-btn"
        onClick={() => setShowSearch((current) => !current)}
        aria-label={showSearch ? "Tutup pencarian" : "Cari produk"}
        aria-expanded={showSearch}
        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
      >
        <Search size={19} color="#162B45" />
      </button>

      {showSearch && (
        <div className="search-panel" role="dialog" aria-modal="true" aria-label="Pencarian produk">
          <div className="search-mobile-head">
            <button type="button" onClick={closeSearch} aria-label="Kembali" className="search-mobile-back">
              <ChevronRight size={19} style={{ transform: "rotate(180deg)" }} />
            </button>
            <div>
              <strong>Cari produk</strong>
              <span>Nama, manfaat, atau bahan aktif</span>
            </div>
          </div>

          <div className="search-panel-inner">
            <div className="search-field-wrap">
              <Search size={17} aria-hidden="true" />
              <input
                autoFocus
                value={searchQuery}
                onChange={handleInputChange}
                placeholder="Cari produk atau bahan aktif..."
                aria-label="Cari produk atau bahan aktif"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label="Hapus pencarian" className="search-clear-btn">
                  <X size={16} />
                </button>
              )}
            </div>

            {!normalizedQuery ? (
              <div className="search-empty-state">
                <Search size={26} strokeWidth={1.5} />
                <strong>Temukan produk yang kamu butuhkan</strong>
                <p>Ketik nama produk, manfaat, kategori, atau bahan aktif.</p>
              </div>
            ) : (
              <div className="search-results-wrap">
                <div className="search-results-meta">
                  <span>HASIL PENCARIAN</span>
                  <small>{searchResults.length} produk</small>
                </div>

                <div className="search-results-list">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="search-result-item"
                      onClick={() => {
                        openProduct(product);
                        closeSearch();
                      }}
                    >
                      <div className="search-result-image">
                        {product.image ? (
                          <img src={resolveProductImage(product)} alt="" loading="lazy" />
                        ) : (
                          <Leaf size={20} color="#4C6354" />
                        )}
                      </div>
                      <div className="search-result-copy">
                        <strong>{product.name}</strong>
                        <span>{formatIDR(product.price)}</span>
                        <small className={Number(product.stock || 0) > 0 ? "is-available" : "is-empty"}>
                          {Number(product.stock || 0) > 0 ? `Stok ${product.stock}` : "Stok habis"}
                        </small>
                      </div>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ))}

                  {searchResults.length === 0 && (
                    <div className="search-empty-state compact">
                      <Search size={24} strokeWidth={1.5} />
                      <strong>Produk tidak ditemukan</strong>
                      <p>Coba gunakan kata pencarian yang lebih singkat.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { BackInStockNotify, ProductReviews, ProductQRModal, ProductDetailPage, ProductCard, CatalogSection, SearchDropdown };
