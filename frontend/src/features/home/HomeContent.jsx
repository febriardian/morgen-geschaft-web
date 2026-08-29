// HomeContent.jsx
// Extracted from App.jsx — all home page sections (hero, about, catalog,
// reviews, promo, track order, FAQ, blog, footer).

import { Bell } from "lucide-react";
import { SectionErrorBoundary } from "../../components/shared/ErrorBoundaries.jsx";
import { AboutStatCard } from "../../components/shared/Media.jsx";
import { BlogEditorialCard } from "../blog/BlogEditorialCard.jsx";
import { CatalogSection } from "../catalog/Catalog.jsx";
import {
  FaqSection,
  HeroSection,
  InstallAppBanner,
  MarketplaceBanner,
  PromoCard,
  PushSubscriptionBanner,
} from "./HomeSections.jsx";
import { TrackOrderSection } from "../orders/TrackOrderSection.jsx";
import { TestimoniSection } from "../reviews/Reviews.jsx";
import { SkinQuizBanner } from "../skinQuiz/SkinQuizBanner.jsx";
import { FlashSaleBanner } from "../flashSale/FlashSaleBanner.jsx";
import { StoreFooter } from "../../components/layout/StoreFooter.jsx";

export function HomeContent({
  locale,
  route,
  navigate,
  location,
  products,
  productsLoading,
  flashSale,
  flashSaleRemainingMs,
  coupons,
  blogPosts,
  user,
  wishlist,
  cart,
  setCart,
  setShowCart,
  pushState,
  handlePushSubscribe,
  addToCart,
  toggleWishlist,
  openProduct,
  openAllProducts,
  closeCatalogPage,
  openCatalogCategory,
  openReviewsPage,
  openFaqPage,
  openSkinQuizPage,
  openBlogCategory,
  openBlogPost,
  scrollToSection,
  setSortBy,
  featureFlags,
}) {
  return (
    <>
      {/* Hero with slideshow */}
      <SectionErrorBoundary name="Hero">
        <HeroSection onCatalogClick={() => scrollToSection("katalog")} experimentEnabled={featureFlags?.heroExperiment !== false} />
      </SectionErrorBoundary>

      {/* Marketplace Banner */}
      <SectionErrorBoundary name="Marketplace">
        <MarketplaceBanner />
      </SectionErrorBoundary>

      {/* Install App Banner */}
      <InstallAppBanner />

      {/* Tentang Kami */}
      <AboutSection />

      {/* Flash sale hanya tampil ketika jadwal aktif menurut waktu server. */}
      {featureFlags?.flashSale !== false && (
        <FlashSaleBanner
          sale={flashSale}
          remainingMs={flashSaleRemainingMs}
          products={products}
          onBrowse={() => scrollToSection("katalog")}
        />
      )}

      {/* Kuis tipe kulit */}
      <SectionErrorBoundary name="Kuis Tipe Kulit">
        <SkinQuizBanner onStart={openSkinQuizPage} />
      </SectionErrorBoundary>

      {/* Produk pilihan di beranda */}
      <CatalogSection
        products={products}
        productsLoading={productsLoading}
        mode="home"
        activeCategory="semua"
        onCategoryChange={openCatalogCategory}
        sortBy="default"
        onSortChange={setSortBy}
        onAdd={addToCart}
        onOpen={openProduct}
        wishlist={wishlist}
        onToggleWishlist={toggleWishlist}
        onViewAll={openAllProducts}
        onBack={closeCatalogPage}
      />

      {/* Tiga ulasan terbaru di beranda */}
      <SectionErrorBoundary name="Testimoni">
        <TestimoniSection
          products={products}
          isAdmin={!!user}
          onViewAll={() => openReviewsPage()}
        />
      </SectionErrorBoundary>

      {/* Promo Section */}
      <PromoSection
        coupons={coupons}
        pushState={pushState}
        handlePushSubscribe={handlePushSubscribe}
      />

      {/* Lacak Pesanan */}
      <TrackOrderSection
        products={products}
        onReorder={(items = []) => {
          const reorderedCart = items
            .map((item) => {
              const latest = products.find((product) => product.id === item.id);
              if (!latest || Number(latest.stock || 0) <= 0) return null;
              return {
                ...latest,
                qty: Math.max(1, Math.min(Number(item.qty || 1), Number(latest.stock || 0))),
              };
            })
            .filter(Boolean);

          if (reorderedCart.length === 0) {
            alert("Produk pada pesanan ini sedang tidak tersedia.");
            return;
          }

          setCart(reorderedCart);
          setShowCart(true);
        }}
        onBrowseCatalog={() => navigate(route("catalog"))}
      />

      {/* FAQ */}
      <FaqSection onViewAll={openFaqPage} />

      {/* Blog / Artikel */}
      <BlogPreviewSection
        blogPosts={blogPosts}
        openBlogCategory={openBlogCategory}
        openBlogPost={openBlogPost}
      />

      {/* Push notification opt-in */}
      <PushSubscriptionBanner />

      {/* Footer */}
      <StoreFooter locale={locale} route={route} navigate={navigate} location={location} />
    </>
  );
}

// ============================================================================
// Sub-sections extracted from the monolithic home JSX
// ============================================================================

function AboutSection() {
  return (
    <section id="tentang" style={{ borderBottom: "1px solid #E3DCC9" }}>
      <div
        className="tentang-grid"
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "42px 32px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "48px",
          alignItems: "center",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              color: "#F59A1A",
              letterSpacing: "0.08em",
            }}
            className="mb-3"
          >
            TENTANG KAMI
          </p>
          <h2
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(24px, 3vw, 36px)",
              color: "#162B45",
              lineHeight: 1.15,
            }}
            className="mb-4"
          >
            Skincare Original yang Lebih Mudah Dipilih.
          </h2>
          <p
            className="tentang-body-text"
            style={{ fontSize: "15px", color: "#6B6558", lineHeight: 1.75 }}
          >
            Morgen Geschäft hadir untuk membantu kamu menemukan produk skincare original dengan
            informasi yang jelas, mulai dari manfaat, bahan aktif, sampai harga. Kami ingin proses
            memilih skincare terasa lebih mudah, aman, dan tidak membingungkan.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {[
            { num: "9+", label: "Pilihan produk" },
            { num: "Original", label: "Produk resmi" },
            { num: "Rp26rb", label: "Harga mulai dari" },
            { num: "Info jelas", label: "Bahan aktif & manfaat" },
          ].map((item, index) => (
            <AboutStatCard key={item.label} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PushNotifButton({ pushState, handlePushSubscribe, size = "normal" }) {
  const isSmall = size === "small";
  const labels = {
    subscribed: isSmall ? "Notifikasi aktif" : "Notifikasi aktif",
    loading: isSmall ? "Mengaktifkan..." : "Mengaktifkan...",
    unsupported: isSmall ? "Tidak didukung" : "Tidak didukung browser",
    denied: isSmall ? "Periksa izin" : "Periksa izin notifikasi",
    default: isSmall ? "Aktifkan notifikasi" : "Aktifkan notifikasi",
  };
  const label = labels[pushState] || labels.default;
  const disabled = ["subscribed", "unsupported", "loading"].includes(pushState);

  return (
    <button
      type="button"
      onClick={handlePushSubscribe}
      disabled={disabled}
      style={{
        background: pushState === "subscribed" ? "#F59A1A" : "#162B45",
        color: pushState === "subscribed" ? "#162B45" : "#F6F1E7",
        border: "none",
        borderRadius: "9px",
        padding: isSmall ? "8px 14px" : "10px 18px",
        fontFamily: "'Work Sans', sans-serif",
        fontSize: isSmall ? "11px" : "12px",
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: pushState === "unsupported" ? 0.55 : 1,
      }}
    >
      {label}
    </button>
  );
}

function PromoSection({ coupons, pushState, handlePushSubscribe }) {
  return (
    <section id="promo" style={{ borderBottom: "1px solid #E3DCC9", background: "#F6F1E7" }}>
      <div
        className="promo-section-inner"
        style={{ maxWidth: "1280px", margin: "0 auto", padding: "36px 32px" }}
      >
        <div style={{ marginBottom: "24px" }}>
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              color: "#F59A1A",
              letterSpacing: "0.08em",
              marginBottom: "4px",
            }}
          >
            PROMO
          </p>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "28px", color: "#162B45" }}>
            Promo yang sedang berlangsung
          </h2>
        </div>
        <div
          className="promo-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}
        >
          {coupons.map((coupon, index) => (
            <PromoCard key={coupon.code} coupon={coupon} index={index} />
          ))}
          {coupons.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "40px 24px",
                background: "linear-gradient(135deg, #FFFDF8 0%, #F7F1E7 100%)",
                border: "1px solid #E3DCC9",
                borderRadius: "12px",
              }}
            >
              <Bell size={32} color="#F59A1A" strokeWidth={1.5} style={{ margin: "0 auto 12px" }} />
              <p
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: "18px",
                  color: "#162B45",
                  marginBottom: "6px",
                }}
              >
                Jangan lewatkan promo berikutnya
              </p>
              <p
                style={{
                  fontFamily: "'Work Sans', sans-serif",
                  fontSize: "13px",
                  color: "#6B6558",
                  maxWidth: "390px",
                  margin: "0 auto 16px",
                  lineHeight: 1.6,
                }}
              >
                Aktifkan notifikasi untuk mendapat kabar saat kode promo dan penawaran baru
                tersedia.
              </p>
              <PushNotifButton pushState={pushState} handlePushSubscribe={handlePushSubscribe} />
            </div>
          ) : (
            coupons.length % 3 !== 0 && (
              <div
                style={{
                  border: "1px solid #E3DCC9",
                  borderRadius: "12px",
                  background: "linear-gradient(145deg, #FFFDF8 0%, #F7F1E7 100%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "28px 20px",
                  textAlign: "center",
                  minHeight: "200px",
                }}
              >
                <Bell size={28} color="#F59A1A" strokeWidth={1.5} />
                <p
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: "15px",
                    color: "#162B45",
                    marginTop: "10px",
                    marginBottom: "5px",
                  }}
                >
                  Dapatkan promo berikutnya
                </p>
                <p
                  style={{
                    fontFamily: "'Work Sans', sans-serif",
                    fontSize: "12px",
                    color: "#6B6558",
                    lineHeight: 1.5,
                    maxWidth: "230px",
                    marginBottom: "14px",
                  }}
                >
                  Aktifkan notifikasi untuk mendapat kode dan penawaran terbaru.
                </p>
                <PushNotifButton
                  pushState={pushState}
                  handlePushSubscribe={handlePushSubscribe}
                  size="small"
                />
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function BlogPreviewSection({ blogPosts, openBlogCategory, openBlogPost }) {
  return (
    <section id="blog" style={{ borderBottom: "1px solid #E3DCC9", background: "#F6F1E7" }}>
      <div
        className="katalog-section-inner"
        style={{ maxWidth: "1280px", margin: "0 auto", padding: "36px 32px" }}
      >
        <div
          style={{
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                color: "#F59A1A",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              ARTIKEL
            </p>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "28px", color: "#162B45" }}>
              Tips & panduan skincare
            </h2>
          </div>
          {blogPosts.length > 3 && (
            <button
              onClick={() => openBlogCategory("semua")}
              style={{
                fontFamily: "'Work Sans', sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                color: "#162B45",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Lihat semua ({blogPosts.length}) →
            </button>
          )}
        </div>
        <div
          className="blog-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "20px",
          }}
        >
          {blogPosts.slice(0, 3).map((post, index) => (
            <BlogEditorialCard
              key={post.id}
              post={post}
              index={index}
              onClick={() => openBlogPost(post)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
