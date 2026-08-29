import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShoppingBag, Plus, ChevronRight, Check, ExternalLink, Search, MessageCircle, RotateCcw } from "lucide-react";
import { ShopeeIcon, TelegramIcon, TikTokIcon } from "../../components/shared/Media.jsx";
import { StandalonePageHero, StandaloneSectionHeader } from "../../components/shared/Transitions.jsx";
import { FAQ_ITEMS, HERO_SLIDES, MARKETPLACE_LINKS } from "../../config/constants.js";
import { formatIDR } from "../../utils/general.js";
import { captureReturnContext } from "../../utils/navigation.js";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import { localizeFaqItems, localizeHeroSlides } from "../../i18n/locale.js";
import { getExistingPushSubscription, subscribeToBrowserPush } from "../../services/pushNotifications.js";
import { getHeroVariant, trackHeroImpression } from "../../services/heroExperiment.js";



function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div
      className={`premium-faq-item ${isOpen ? "is-open" : ""}`}
      style={{ borderBottom: "1px solid #E3DCC9" }}
    >
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "18px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span
          className="premium-faq-question"
          style={{ fontFamily: "'Fraunces', serif", fontSize: "16px", color: "#162B45" }}
        >
          {item.q}
        </span>
        <span
          className="premium-faq-icon"
          style={{ flexShrink: 0, color: isOpen ? "#F59A1A" : "#6B6558" }}
        >
          <Plus size={16} />
        </span>
      </button>

      <div
        className="premium-faq-answer-wrap"
        aria-hidden={!isOpen}
        style={{
          maxHeight: isOpen ? "180px" : "0px",
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "translateY(0)" : "translateY(-6px)",
          overflow: "hidden",
        }}
      >
        <p
          role="region"
          style={{
            fontFamily: "'Work Sans', sans-serif",
            fontSize: "14px",
            color: "#6B6558",
            lineHeight: 1.7,
            paddingBottom: "18px",
            paddingRight: "24px",
          }}
        >
          {item.a}
        </p>
      </div>
    </div>
  );
}



function FaqSection({ pageMode = false, onViewAll }) {
  const { locale } = useLocale();
  const faqItems = localizeFaqItems(FAQ_ITEMS, locale);
  const [openQuestion, setOpenQuestion] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Semua");
  const allCategoryLabel = locale === "en" ? "All" : "Semua";
  const categories = [allCategoryLabel, ...Array.from(new Set(faqItems.map((item) => item.category).filter(Boolean)))];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredFaq = faqItems.filter((item) => {
    const categoryMatches = activeCategory === allCategoryLabel || item.category === activeCategory;
    const queryMatches = !normalizedQuery || `${item.q} ${item.a} ${item.category || ""}`.toLowerCase().includes(normalizedQuery);
    return categoryMatches && queryMatches;
  });
  const visibleFaq = pageMode ? filteredFaq : faqItems.slice(0, 5);

  const resetFaq = () => {
    setSearchQuery("");
    setActiveCategory(allCategoryLabel);
    setOpenQuestion("");
  };

  useEffect(() => {
    setActiveCategory(allCategoryLabel);
    setOpenQuestion("");
  }, [allCategoryLabel]);

  const openGesa = () => {
    window.dispatchEvent(new CustomEvent("mg:open-gesa-chat"));
  };

  return (
    <section
      id="faq"
      className={pageMode ? "faq-page-section" : "faq-home-section"}
      style={{ borderBottom: "1px solid #E3DCC9", background: "#F6F1E7" }}
    >
      {pageMode && (
        <StandalonePageHero
          eyebrow="PUSAT BANTUAN"
          title="Temukan jawaban yang kamu butuhkan."
          description="Informasi tentang pesanan, pembayaran, pengiriman, pengembalian, dan produk tersedia dalam satu tempat."
        />
      )}

      <div
        className={pageMode ? "standalone-content-shell faq-section-inner" : "faq-section-inner"}
        style={{
          maxWidth: pageMode ? "1120px" : "960px",
          margin: "0 auto",
          padding: pageMode ? undefined : "42px 32px 48px",
        }}
      >
        {pageMode ? (
          <StandaloneSectionHeader
            title="Pertanyaan yang sering diajukan"
            meta={`${filteredFaq.length} pertanyaan`}
          />
        ) : (
          <div style={{ maxWidth: "680px", marginBottom: "22px" }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#F59A1A", letterSpacing: "0.08em", marginBottom: "8px" }}>
              FAQ
            </p>
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(24px, 3vw, 32px)",
                lineHeight: 1.08,
                color: "#162B45",
                marginBottom: "10px",
              }}
            >
              Temukan jawaban yang kamu butuhkan
            </h1>
            <p style={{ fontSize: "14px", color: "#6B6558", lineHeight: 1.7 }}>
              Lima pertanyaan yang paling sering ditanyakan pelanggan. Pertanyaan lainnya tersedia di halaman FAQ lengkap.
            </p>
          </div>
        )}

        {pageMode && (
          <>
            <div className="faq-search-wrap" style={{ position: "relative", marginBottom: "14px" }}>
              <Search size={17} color="#8F897B" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari pertanyaan, misalnya ongkir atau pembayaran..."
                aria-label="Cari pertanyaan umum"
                style={{ width: "100%", height: "48px", border: normalizedQuery ? "1.5px solid #162B45" : "1px solid #DCD4C4", borderRadius: "10px", background: "#FFFDF8", padding: "0 42px", color: "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", outline: "none", boxShadow: normalizedQuery ? "0 0 0 3px rgba(22,43,69,.08)" : "none" }}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label="Hapus pencarian" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, border: "none", background: "transparent", color: "#6B6558", cursor: "pointer", display: "grid", placeItems: "center" }}>
                  ×
                </button>
              )}
            </div>

            <div className="faq-category-row" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "22px" }}>
              {categories.map((category) => {
                const active = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setActiveCategory(category);
                      setOpenQuestion("");
                    }}
                    style={{ border: active ? "1.5px solid #162B45" : "1px solid #E3DCC9", background: active ? "#162B45" : "#FFFDF8", color: active ? "#FFF8ED" : "#5E594F", borderRadius: "9px", padding: "8px 12px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: active ? 600 : 500, cursor: "pointer" }}
                  >
                    {category}
                  </button>
                );
              })}
            </div>

            {(normalizedQuery || activeCategory !== "Semua") && (
              <div className="faq-results-meta" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
                <button type="button" onClick={resetFaq} style={{ border: "none", background: "transparent", color: "#C26F52", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 0" }}>
                  <RotateCcw size={13} /> Reset filter
                </button>
              </div>
            )}
          </>
        )}

        <div className="faq-list">
          {visibleFaq.length > 0 ? visibleFaq.map((item) => (
            <FaqItem
              key={item.q}
              item={item}
              isOpen={openQuestion === item.q}
              onToggle={() => setOpenQuestion(openQuestion === item.q ? "" : item.q)}
            />
          )) : (
            <div style={{ textAlign: "center", padding: "42px 20px", borderTop: "1px solid #E3DCC9" }}>
              <Search size={28} color="#C9C2AD" style={{ margin: "0 auto 10px" }} />
              <p style={{ fontFamily: "'Fraunces', serif", fontSize: "17px", color: "#7B766A", marginBottom: "5px" }}>Jawaban belum ditemukan</p>
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#A39E8E", marginBottom: "14px" }}>Coba kata kunci lain atau tampilkan seluruh kategori.</p>
              <button type="button" onClick={resetFaq} style={{ border: "1px solid #162B45", background: "#162B45", color: "#FFF8ED", borderRadius: "9px", padding: "9px 15px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                Tampilkan semua FAQ
              </button>
            </div>
          )}
        </div>

        {!pageMode && faqItems.length > 5 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "22px" }}>
            <button
              type="button"
              onClick={onViewAll}
              className="faq-view-all-btn"
              style={{ border: "1px solid #162B45", background: "transparent", color: "#162B45", borderRadius: "10px", minHeight: "42px", padding: "10px 17px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 650, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "7px" }}
            >
              Lihat semua FAQ ({faqItems.length}) <ChevronRight size={15} />
            </button>
          </div>
        )}

        <div
          className="faq-contact-card faq-contact-card-premium"
          style={{
            marginTop: pageMode ? "34px" : "28px",
            border: "1px solid rgba(245,154,26,.52)",
            background: "linear-gradient(118deg, #FFF8ED 0%, #F6F1E7 72%, rgba(245,154,26,.16) 100%)",
            borderRadius: "16px",
            padding: "22px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "18px",
            flexWrap: "wrap",
            boxShadow: "0 16px 38px rgba(22,43,69,.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: "220px", flex: 1 }}>
            <div className="faq-contact-icon" style={{ width: 46, height: 46, borderRadius: "50%", background: "#162B45", color: "#F59A1A", border: "2px solid #F59A1A", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 7px 18px rgba(22,43,69,.18)" }}>
              <MessageCircle size={20} />
            </div>
            <div>
              <p style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", color: "#162B45", marginBottom: "3px" }}>Belum menemukan jawaban?</p>
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", lineHeight: 1.55 }}>Tanyakan langsung kepada GESA untuk bantuan yang lebih spesifik.</p>
            </div>
          </div>
          <button type="button" onClick={openGesa} className="premium-primary-btn faq-contact-button" style={{ border: "1px solid #F59A1A", background: "#162B45", color: "#FFF8ED", borderRadius: "10px", padding: "11px 18px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 650, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "7px", flexShrink: 0, boxShadow: "0 8px 18px rgba(22,43,69,.16)" }}>
            <MessageCircle size={14} color="#F59A1A" /> Hubungi GESA
          </button>
        </div>
      </div>
    </section>
  );
}


function MarketplaceBanner() {
  const platforms = [
    {
      name: "Shopee",
      icon: <ShopeeIcon size={24} />,
      href: MARKETPLACE_LINKS.shopee,
      label: "Belanja di Shopee",
      eyebrow: "COD & promo toko",
      desc: "Cek voucher, COD, dan pilihan pengiriman langsung dari halaman toko.",
      accent: "#F59A1A",
      tint: "rgba(245,154,26,.10)",
    },
    {
      name: "TikTok Shop",
      icon: <TikTokIcon size={24} />,
      href: MARKETPLACE_LINKS.tiktok,
      label: "Tonton & Beli",
      eyebrow: "Review singkat",
      desc: "Lihat konten produk, review, dan update pilihan skincare yang sedang tersedia.",
      accent: "#162B45",
      tint: "rgba(22,43,69,.08)",
    },
    {
      name: "Bot Telegram",
      icon: <TelegramIcon size={24} />,
      href: MARKETPLACE_LINKS.telegram,
      label: "Pesan via Bot",
      eyebrow: "Order otomatis",
      desc: "Pesan lebih cepat lewat bot untuk cek katalog dan mulai pembelian.",
      accent: "#4C6354",
      tint: "rgba(76,99,84,.11)",
    },
  ];

  return (
    <section style={{ borderBottom: "1px solid #E3DCC9", background: "#F6F1E7" }}>
      <style>{`
        .marketplace-card-premium:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(22,43,69,.09);border-color:rgba(245,154,26,.42)!important}
        @media(max-width:900px){.marketplace-premium-layout{grid-template-columns:1fr!important}.marketplace-grid{grid-template-columns:1fr!important}}
      `}</style>
      <div className="marketplace-section-inner" style={{ maxWidth: "1120px", margin: "0 auto", padding: "52px 32px" }}>
        <div className="marketplace-premium-layout" style={{ display: "grid", gridTemplateColumns: "minmax(240px, .75fr) 1.25fr", gap: "28px", alignItems: "start" }}>
          <div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#F59A1A", letterSpacing: "0.12em", marginBottom: "10px" }}>
              OFFICIAL CHANNELS
            </p>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(24px, 3vw, 34px)", color: "#162B45", lineHeight: 1.08, marginBottom: "12px" }}>
              Belanja di marketplace favoritmu
            </h2>
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "14px", color: "#6B6558", lineHeight: 1.7, maxWidth: "340px" }}>
              Pilih channel yang paling nyaman untuk belanja, cek promo, atau pesan cepat dari Morgen Geschäft.
            </p>
          </div>

          <div className="marketplace-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
            {platforms.map((p) => (
              <a
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noreferrer"
                className="marketplace-card-premium"
                style={{
                  minHeight: "210px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "18px",
                  padding: "22px",
                  background: "rgba(255,253,248,.78)",
                  border: "1px solid #E3DCC9",
                  textDecoration: "none",
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform .22s ease, box-shadow .22s ease, border-color .22s ease",
                  cursor: "pointer",
                }}
              >
                <span style={{ position: "absolute", inset: "auto -36px -48px auto", width: "128px", height: "128px", borderRadius: "50%", background: p.tint }} />
                <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: p.accent, opacity: .75 }} />

                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", background: p.tint, border: "1px solid rgba(227,220,201,.9)", marginBottom: "18px" }}>
                    {p.icon}
                  </div>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: p.accent, letterSpacing: ".08em", marginBottom: "8px" }}>
                    {p.eyebrow}
                  </p>
                  <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "19px", color: "#162B45", marginBottom: "8px", lineHeight: 1.25 }}>
                    {p.name}
                  </h3>
                  <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", lineHeight: 1.6 }}>
                    {p.desc}
                  </p>
                </div>

                <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", paddingTop: "14px", borderTop: "1px solid rgba(227,220,201,.78)" }}>
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, color: "#1F2E22" }}>
                    {p.label}
                  </span>
                  <ExternalLink size={14} color={p.accent} style={{ flexShrink: 0 }} />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}



function HeroSection({ onCatalogClick, experimentEnabled = true }) {
  const { locale } = useLocale();
  const heroSlides = localizeHeroSlides(HERO_SLIDES, locale);
  const [current, setCurrent] = useState(0);
  const [heroVariant, setHeroVariant] = useState(() => experimentEnabled ? getHeroVariant() : "A");

  useEffect(() => {
    if (!experimentEnabled) {
      setHeroVariant("A");
      return;
    }
    void trackHeroImpression(heroVariant);
  }, [heroVariant, experimentEnabled]);

  const goTo = useCallback((idx) => {
    setCurrent(idx);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % heroSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  return (
    <section className="hero-section" style={{ position: "relative", height: "85vh", minHeight: "480px", overflow: "hidden", borderBottom: "1px solid #E3DCC9", background: "#F6F1E7" }}>
      {/* Keep each optimized image mounted so slide changes use the original,
          uninterrupted crossfade from Morgen 8(2). */}
      {heroSlides.map((slide, i) => (
        <picture key={slide.image}>
          <source
            type="image/webp"
            srcSet={`${slide.image640 || slide.image} 640w, ${slide.image960 || slide.image} 960w`}
            sizes="(max-width: 768px) 100vw, 55vw"
          />
          <img
            src={slide.image960 || slide.image}
            alt=""
            className={`hero-img${i === current ? " hero-img-active" : ""}`}
            width={slide.width}
            height={slide.height}
            loading="eager"
            decoding="async"
            fetchpriority={i === 0 ? "high" : "low"}
            style={{
              position: "absolute",
              top: 0, right: 0,
              width: "55%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              opacity: i === current ? 1 : 0,
              transition: "opacity 1.1s cubic-bezier(0.4, 0, 0.2, 1)",
              willChange: "opacity",
            }}
          />
        </picture>
      ))}
      <div className="hero-overlay" style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg, #F6F1E7 42%, rgba(246,241,231,0.85) 58%, rgba(246,241,231,0) 100%)",
        zIndex: 1,
      }} />
      <div
        className="hero-content"
        style={{
          position: "relative", zIndex: 2,
          height: "100%",
          width: "100%",
          display: "flex", flexDirection: "column", justifyContent: "center",
          gap: "24px",
          padding: "0 48px",
          maxWidth: "640px",
        }}
      >
        {/* Text follows the same stacked crossfade as the reference hero. */}
        <div className="hero-copy-stage" style={{ position: "relative", width: "100%" }}>
          {heroSlides.map((slide, i) => (
            <div
              key={slide.image}
              style={{
                position: i === current ? "relative" : "absolute",
                top: 0, left: 0, right: 0,
                opacity: i === current ? 1 : 0,
                pointerEvents: i === current ? "auto" : "none",
                transition: "opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#173B5E", letterSpacing: "0.1em", margin: "0 0 14px" }}>
                {slide.label} · PRODUK ORIGINAL
              </p>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.08, color: "#162B45", margin: "0 0 4px", maxWidth: locale === "en" && i === 0 ? "340px" : undefined }}>
                {slide.headline}
              </h1>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.08, color: "#173B5E", margin: "0 0 16px" }}>
                {slide.accent}
              </h1>
              <p className="hero-subtext" style={{ fontSize: "15px", color: "#6B6558", lineHeight: 1.75, maxWidth: "460px", margin: 0 }}>
                {slide.subtext}
              </p>
            </div>
          ))}
        </div>
        <div className="hero-actions" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px" }}>
          <button
            className="premium-primary-btn"
            onClick={onCatalogClick}
            style={{
              background: "#1F2E22", color: "#F6F1E7",
              fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: "14px",
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "14px 28px", border: "none", cursor: "pointer",
            }}
          >
            {heroVariant === "B"
              ? (locale === "en" ? "Find Your Routine" : "Temukan Rutinitasmu")
              : (locale === "en" ? "View Catalog" : "Lihat Katalog")}
            <ChevronRight size={16} />
          </button>
          {/* Slide dots — sejajar dengan tombol */}
          <div className="hero-dots" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {heroSlides.map((_, i) => (
              <button
                key={i}
                className="premium-hero-dot"
                onClick={() => goTo(i)}
                style={{
                  width: i === current ? "28px" : "8px",
                  height: "8px",
                  borderRadius: "4px",
                  background: i === current ? "#1F2E22" : "#C9C2AD",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}



// ---------- Promo card ----------

function PromoCard({ coupon, index = 0 }) {
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(coupon.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="promo-card-soft promo-card-animated" style={{ "--promo-delay": `${Math.min(index, 8) * 90}ms`, border: "1.5px dashed #C9C2AD", background: "#fff", overflow: "hidden", position: "relative" }}>
      {/* Top accent bar */}
      <div style={{ height: "4px", background: "linear-gradient(90deg, #1F2E22, #4C6354)" }} />

      <div style={{ padding: "20px 20px 16px" }}>
        {/* Badge */}
        <div style={{ display: "inline-block", background: "#1F2E22", color: "#F6F1E7", fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", fontWeight: 700, padding: "4px 12px", marginBottom: "14px", letterSpacing: "0.02em" }}>
          {coupon.label}
        </div>

        <p style={{ fontFamily: "'Fraunces', serif", fontSize: "15px", color: "#162B45", marginBottom: "6px", lineHeight: 1.4 }}>
          {coupon.desc}
        </p>
        {coupon.minOrder > 0 && (
          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#A39E8E", marginBottom: "14px" }}>
            Min. belanja {formatIDR(coupon.minOrder)}
          </p>
        )}
        {coupon.minOrder === 0 && (
          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#4C6354", marginBottom: coupon.expiresAt || coupon.singleUse ? "6px" : "14px" }}>
            Tanpa minimum belanja
          </p>
        )}
        {coupon.expiresAt && (
          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: new Date(coupon.expiresAt) < new Date() ? "#C97B5E" : "#6B6558", marginBottom: coupon.singleUse ? "6px" : "14px" }}>
            {new Date(coupon.expiresAt) < new Date() ? "⚠ Sudah kedaluwarsa" : `Berlaku s/d ${new Date(coupon.expiresAt).toLocaleDateString(locale === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric" })}`}
          </p>
        )}
        {coupon.singleUse && (
          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#4C6354", marginBottom: "14px" }}>
            ✦ Hanya 1× per pelanggan
          </p>
        )}

        {/* Kode kupon */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ flex: 1, minWidth: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", fontWeight: 600, color: "#1F2E22", padding: "10px 14px", background: "#F6F1E7", letterSpacing: "0.08em", border: "1px solid #E3DCC9", borderRadius: "10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {coupon.code}
          </div>
          <button
            onClick={copy}
            style={{
              background: copied ? "#4C6354" : "#1F2E22",
              color: "#F6F1E7",
              border: "1px solid transparent",
              fontFamily: "'Work Sans', sans-serif",
              fontSize: "12px",
              fontWeight: 600,
              padding: "10px 14px",
              cursor: "pointer",
              transition: "background 0.2s, transform 0.18s ease, box-shadow 0.18s ease",
              borderRadius: "10px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              minWidth: "86px",
              boxShadow: "0 8px 18px rgba(31,46,34,.10)",
            }}
          >
            {copied ? (
              <><Check size={12} /> Disalin!</>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Salin
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}



// ---------- Android APK Download Banner ----------

function InstallAppBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { route } = useLocale();

  return (
    <section id="install-app" style={{ borderBottom: "1px solid #E3DCC9", background: "#F6F1E7", padding: "28px 32px" }}>
      <div
        className="install-premium-card install-strip-card"
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          padding: "22px 24px",
          background: "linear-gradient(135deg, rgba(255,255,255,.78) 0%, rgba(241,234,220,.92) 100%)",
          border: "1px solid rgba(245,154,26,.22)",
          boxShadow: "0 18px 44px rgba(22,43,69,.055)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "22px",
          flexWrap: "wrap",
        }}
      >
        <div className="install-strip-copy-wrap" style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: "260px" }}>
          <div
            className="install-strip-logo"
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "16px",
              background: "#F6F1E7",
              border: "1px solid rgba(245,154,26,.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 10px 24px rgba(22,43,69,.07)",
            }}
          >
            <img src="/photos/logo-512.webp" alt="" style={{ width: "31px", height: "31px", objectFit: "contain" }} />
          </div>

          <div className="install-strip-text">
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#F59A1A", letterSpacing: ".1em", marginBottom: "5px" }}>
              APP EXPERIENCE
            </p>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(18px, 2vw, 23px)", color: "#162B45", marginBottom: "5px" }}>
              Download Morgen Geschäft
            </h3>
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", lineHeight: 1.6, maxWidth: "520px" }}>
              Unduh aplikasi Android untuk mengakses katalog, pesanan, dan akun Morgen Geschäft dengan lebih praktis.
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
              {["Cepat dibuka", "Ringan", "Gratis"].map((item) => (
                <span
                  key={item}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    color: "#173B5E",
                    border: "1px solid rgba(23,59,94,.16)",
                    background: "rgba(255,255,255,.55)",
                    padding: "5px 8px",
                    borderRadius: "8px",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          className="premium-primary-btn install-strip-button"
          onClick={() => navigate(route("install"), { state: captureReturnContext(location) })}
          style={{
            background: "#1F2E22",
            color: "#F6F1E7",
            fontFamily: "'Work Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            padding: "12px 22px",
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            flexShrink: 0,
          }}
        >
          <ShoppingBag size={14} /> Download APK <ChevronRight size={15} />
        </button>
      </div>
    </section>
  );
}



// ---------- Push Notification Subscription Banner ----------

function PushSubscriptionBanner() {
  const { locale, t } = useLocale();
  const [state, setState] = useState("idle"); // idle | subscribed | denied | unsupported | loading | error
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const inspectSubscription = async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      if (Notification.permission === "granted") {
        try {
          const subscription = await getExistingPushSubscription();
          if (!cancelled && subscription) setState("subscribed");
        } catch {
          if (!cancelled) setState("idle");
        }
      }
    };

    inspectSubscription();
    try {
      if (localStorage.getItem("mg_push_dismissed")) setDismissed(true);
    } catch {}

    return () => { cancelled = true; };
  }, []);

  const subscribe = async () => {
    setState("loading");
    setMessage("");

    try {
      await subscribeToBrowserPush(locale);
      setState("subscribed");
      setMessage(t("Notifikasi browser berhasil diaktifkan.", "Browser notifications are now active."));
    } catch (error) {
      if (error.code === "denied") setState("denied");
      else if (error.code === "unsupported" || error.code === "insecure") setState("unsupported");
      else if (error.code === "dismissed") setState("idle");
      else setState("error");

      setMessage(error.message || t(
        "Notifikasi belum dapat diaktifkan. Pastikan backend sedang berjalan.",
        "Notifications could not be enabled. Make sure the backend is running."
      ));
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem("mg_push_dismissed", "1"); } catch {}
  };

  if (state === "subscribed" || state === "unsupported" || dismissed) return null;

  return (
    <section
      style={{
        borderTop: "1px solid rgba(245,154,26,.28)",
        borderBottom: "1px solid #E3DCC9",
        background: state === "error" || state === "denied" ? "#FFF2E8" : "#FFF8ED",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "220px" }}>
          <span
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "rgba(245,154,26,.14)",
              color: "#F59A1A",
              border: "1px solid rgba(245,154,26,.28)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "17px",
              flexShrink: 0,
            }}
          >
            {state === "error" || state === "denied" ? "!" : "🔔"}
          </span>
          <div>
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 700, color: "#162B45", margin: 0 }}>
              {state === "denied"
                ? t("Notifikasi diblokir oleh browser", "Notifications are blocked by the browser")
                : state === "error"
                  ? t("Notifikasi belum berhasil diaktifkan", "Notifications could not be enabled")
                  : t("Mau dapat info promo & produk baru?", "Want promotion and new-product updates?")}
            </p>
            <p role="status" style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: state === "error" || state === "denied" ? "#8A4D1C" : "#6B6558", margin: "3px 0 0", lineHeight: 1.5 }}>
              {message || (state === "denied"
                ? t("Izinkan notifikasi melalui pengaturan situs di browser.", "Allow notifications from the browser site settings.")
                : t("Kami jarang mengirim, hanya informasi yang penting.", "We send rarely and only when it matters."))}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={subscribe}
            disabled={state === "loading" || state === "denied"}
            style={{
              background: state === "error" ? "#F59A1A" : "#162B45",
              color: state === "error" ? "#162B45" : "#F6F1E7",
              fontFamily: "'Work Sans', sans-serif",
              fontSize: "12px",
              fontWeight: 700,
              padding: "9px 16px",
              border: "none",
              cursor: state === "loading" || state === "denied" ? "not-allowed" : "pointer",
              borderRadius: "9px",
              opacity: state === "loading" || state === "denied" ? 0.62 : 1,
            }}
          >
            {state === "loading"
              ? t("Mengaktifkan...", "Enabling...")
              : state === "denied"
                ? t("Izin diblokir", "Permission blocked")
                : state === "error"
                  ? t("Coba lagi", "Try again")
                  : t("Aktifkan", "Enable")}
          </button>
          <button
            type="button"
            onClick={dismiss}
            style={{ background: "#FFFDF8", border: "1px solid #E9D1AA", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#173B5E", padding: "9px 13px", cursor: "pointer", borderRadius: "9px" }}
          >
            {t("Nanti", "Later")}
          </button>
        </div>
      </div>
    </section>
  );
}

export { FaqItem, FaqSection, MarketplaceBanner, HeroSection, PromoCard, InstallAppBanner, PushSubscriptionBanner };
