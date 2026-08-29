import React, { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation, useNavigationType } from "react-router-dom";
import { APP_GLOBAL_STYLES, APP_REVEAL_STYLES } from "./styles/appStyles.js";
import { APP_ANIMATION_STYLES } from "./styles/animations.js";
import { StandaloneStoreFooter } from "./components/layout/StandaloneStoreFooter.jsx";
import { StoreHeader } from "./components/layout/StoreHeader.jsx";
import { MobileDrawer } from "./components/layout/MobileDrawer.jsx";
import { ErrorBoundary } from "./components/shared/ErrorBoundaries.jsx";
import { PrivacyNotice } from "./components/shared/PrivacyNotice.jsx";
import {
  HomeReturnTransition,
  PageRouteTransition,
  SimpleBackHeader,
} from "./components/shared/Transitions.jsx";
import { CatalogSection, ProductDetailPage } from "./features/catalog/Catalog.jsx";
import { FaqSection } from "./features/home/HomeSections.jsx";
import { HomeContent } from "./features/home/HomeContent.jsx";
import { TestimoniSection } from "./features/reviews/Reviews.jsx";
import { usePageRouteTransition } from "./hooks/usePageRouteTransition.js";
import { useProducts, useCoupons, useBlogPosts } from "./hooks/useFirestoreData.js";
import { useAuth } from "./hooks/useAuth.js";
import { useNotifications } from "./hooks/useNotifications.js";
import { useCart } from "./hooks/useCart.js";
import { useFlashSale } from "./hooks/useFlashSale.js";
import { useFeatureFlags } from "./hooks/useFeatureFlags.js";
import {
  useGesaCompact,
  useHashSectionScroll,
  useHomeReturnTransition,
  useProductPageScrollReset,
  useScrollRestoration,
  useSectionReveal,
} from "./hooks/useStorefrontEffects.js";
import {
  useStorefrontNavigation,
  CATALOG_SCROLL_MEMORY_KEY,
} from "./hooks/useStorefrontNavigation.js";
import { analytics, initAnalytics } from "./services/analytics.js";
import { isBlogPublic } from "./utils/blog.jsx";
import { formatIDR, resolveProductImage, toSlug } from "./utils/general.js";
import {
  clearPendingReferralCode,
  getReferralCodeFromSearch,
  readPendingReferralCode,
  savePendingReferralCode,
} from "./utils/referral.js";
import { useLocale } from "./i18n/LocaleContext.jsx";
import { internalSectionId, localizeRecord, parseLocalizedPath } from "./i18n/locale.js";

const AdminPanel = React.lazy(() =>
  import("./features/admin/AdminPanel.jsx").then((module) => ({ default: module.AdminPanel }))
);
const SkinQuizPage = React.lazy(() => import("./features/skinQuiz/SkinQuizPage.jsx"));
const GesaChat = React.lazy(() => import("./GesaChat.jsx"));
const LoginModal = React.lazy(() =>
  import("./features/auth/LoginModal.jsx").then((module) => ({ default: module.LoginModal }))
);
const CustomerAccountModal = React.lazy(() => import("./features/auth/CustomerAccountModal.jsx"));
const CartDrawer = React.lazy(() =>
  import("./features/cart/Cart.jsx").then((module) => ({ default: module.CartDrawer }))
);
const WishlistDrawer = React.lazy(() =>
  import("./features/cart/Cart.jsx").then((module) => ({ default: module.WishlistDrawer }))
);
const CheckoutModal = React.lazy(() =>
  import("./features/checkout/CheckoutModal.jsx").then((module) => ({
    default: module.CheckoutModal,
  }))
);

export default function App() {
  const { locale, route, t } = useLocale();

  // --- Extracted hooks ---
  const { products: rawProducts, productsLoading } = useProducts();
  const rawCoupons = useCoupons();
  const { user, customer } = useAuth();
  const featureFlags = useFeatureFlags();
  const rawBlogPosts = useBlogPosts(user);
  const {
    products: saleProducts,
    flashSale,
    remainingMs: flashSaleRemainingMs,
  } = useFlashSale(rawProducts);
  const products = useMemo(
    () => saleProducts.map((product) => localizeRecord(product, locale, "product")),
    [saleProducts, locale]
  );
  const coupons = useMemo(
    () => rawCoupons.map((coupon) => localizeRecord(coupon, locale, "coupon")),
    [rawCoupons, locale]
  );
  const blogPosts = useMemo(
    () => rawBlogPosts.map((post) => localizeRecord(post, locale, "blog")),
    [rawBlogPosts, locale]
  );
  const {
    cart,
    setCart,
    wishlist,
    setWishlist,
    showCart,
    setShowCart,
    showWishlist,
    setShowWishlist,
    showCheckout,
    setShowCheckout,
    toasts,
    setToasts,
    addToCart,
    toggleWishlist,
    addWishlistItemsToCart,
    changeQty,
    cartCount,
    handleCheckoutConfirm,
  } = useCart(products);
  const notifState = useNotifications(user, customer);
  const {
    showNotifPanel,
    setShowNotifPanel,
    notifications,
    notifsLoading,
    readNotifIds,
    setReadNotifIds,
    pushState,
    pushToast,
    handlePushSubscribe,
    unreadCount,
    openNotifPanel,
    hideNotificationLocally,
    clearAllNotifications,
  } = notifState;

  // --- Remaining local state ---
  const [view, setView] = useState("store");
  const [showLogin, setShowLogin] = useState(false);
  const [showCustomerAccount, setShowCustomerAccount] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailShared, setDetailShared] = useState(false);
  const [adminTapCount, setAdminTapCount] = useState(0);
  const adminTapTimer = useState(null);
  const [showAllBlogs, setShowAllBlogs] = useState(false);
  const routeParams = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingReferralCode, setPendingReferralCode] = useState(
    () => getReferralCodeFromSearch(window.location.search) || readPendingReferralCode()
  );
  const routeInfo = parseLocalizedPath(location.pathname);
  const { routeTransition, navigateWithRouteTransition } = usePageRouteTransition(
    location,
    navigate
  );
  const showHomeReturnTransition = useHomeReturnTransition(routeInfo.key, location);

  useEffect(() => {
    if (!featureFlags.customerAccounts || !featureFlags.referral) return;
    const referralCode = getReferralCodeFromSearch(location.search);
    if (!referralCode) return;

    setPendingReferralCode(savePendingReferralCode(referralCode));
    setShowCustomerAccount(true);

    const nextSearch = new URLSearchParams(location.search);
    nextSearch.delete("ref");
    navigate({
      pathname: location.pathname,
      search: nextSearch.toString() ? `?${nextSearch.toString()}` : "",
      hash: location.hash,
    }, { replace: true, state: location.state });
  }, [featureFlags.customerAccounts, featureFlags.referral, location.hash, location.pathname, location.search, location.state, navigate]);

  const isProductPage = routeInfo.key === "product";
  const isCatalogPage = routeInfo.key === "catalog";
  const isReviewsPage = routeInfo.key === "reviews";
  const isFaqPage = routeInfo.key === "faq";
  const isSkinQuizPage = routeInfo.key === "skinQuiz";
  const routeCategoryId = routeInfo.params?.categoryId || "semua";

  // Detail produk selalu dimulai dari bagian paling atas. Posisi katalog
  // disimpan terpisah dan hanya dipulihkan ketika pengguna kembali ke katalog.
  useProductPageScrollReset(isProductPage, location.key, routeParams.id, selected?.id);

  // Pulihkan section atau posisi scroll ketika kembali dari halaman lain.
  useScrollRestoration(location, productsLoading, blogPosts.length);

  // GesaChat masuk mode compact setelah scroll melewati 320px.
  const gesaCompact = useGesaCompact(location.pathname, location.search, view);
  const [gesaReady, setGesaReady] = useState(false);

  useEffect(() => {
    const revealAssistant = () => setGesaReady(true);
    const timer = window.setTimeout(revealAssistant, 8000);
    window.addEventListener("pointerdown", revealAssistant, { once: true, passive: true });
    window.addEventListener("keydown", revealAssistant, { once: true });
    window.addEventListener("scroll", revealAssistant, { once: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", revealAssistant);
      window.removeEventListener("keydown", revealAssistant);
      window.removeEventListener("scroll", revealAssistant);
    };
  }, []);

  // Animasi reveal untuk setiap section utama.
  useSectionReveal(view, location.pathname, location.search, selected);

  // Sinkronkan produk aktif dengan URL. useLayoutEffect dipakai agar produk lama,
  // beranda, atau halaman lain tidak sempat terlihat ketika route berubah.
  useLayoutEffect(() => {
    if (!routeParams.id) {
      setSelected(null);
      return;
    }

    if (products.length === 0) return;

    // ID ada di akhir slug setelah dash terakhir (mis: "kahf-bright-aminogel-p3" → "p3").
    // Coba match full param dulu untuk kompatibilitas URL lama /produk/p3.
    let match = products.find((product) => product.id === routeParams.id);

    if (!match) {
      match = products.find(
        (product) => `${toSlug(product.name)}-${product.id}` === routeParams.id
      );
    }

    if (!match) {
      const parts = routeParams.id.split("-");
      const possibleId = parts[parts.length - 1];
      match = products.find((product) => product.id === possibleId);

      if (!match && parts.length >= 2) {
        const possibleId2 = parts.slice(-2).join("-");
        match = products.find((product) => product.id === possibleId2);
      }
    }

    setSelected(match || null);
  }, [routeParams.id, products]);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [openNavMenu, setOpenNavMenu] = useState(null);
  const [openMobileNav, setOpenMobileNav] = useState(null);

  // Semua handler navigasi storefront (buka/tutup produk, katalog, ulasan, FAQ,
  // blog, section) diekstrak ke hook. Objek dependency memberi state & setter.
  const {
    openProduct,
    closeProduct,
    openAllProducts,
    closeCatalogPage,
    closeReviewsPage,
    closeFaqPage,
    closeSkinQuizPage,
    scrollToSection,
    openCatalogCategory,
    openReviewsPage,
    openReviewFormFromNav,
    openFaqPage,
    openSkinQuizPage,
    openBlogCategory,
    openBlogPost,
  } = useStorefrontNavigation({
    navigate,
    location,
    route,
    locale,
    routeInfo,
    isProductPage,
    isCatalogPage,
    isReviewsPage,
    isFaqPage,
    navigateWithRouteTransition,
    setSelected,
    setView,
    setOpenNavMenu,
    setOpenMobileNav,
    setShowMobileMenu,
  });

  const [activeCategory, setActiveCategory] = useState("semua");
  const [sortBy, setSortBy] = useState("default");

  useEffect(() => {
    if (isCatalogPage) {
      setActiveCategory(routeCategoryId);
      setSortBy("default");
    }
  }, [isCatalogPage, routeCategoryId]);

  const mobileActiveGroup = (() => {
    if (isCatalogPage || isProductPage) return "catalog";
    if (isReviewsPage) return "reviews";
    if (isFaqPage || isSkinQuizPage) return "more";
    if (["blog", "blogCategory", "blogDetail"].includes(routeInfo.key)) return "articles";

    const activeHash = internalSectionId(locale, location.hash);
    if (activeHash === "promo") return "promo";
    if (activeHash === "tentang") return "about";
    if (["lacak", "faq", "kontak"].includes(activeHash)) return "more";
    return null;
  })();

  useEffect(() => {
    if (!showMobileMenu) {
      setOpenNavMenu(null);
      setOpenMobileNav(null);
      return undefined;
    }

    const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;
    if (!isMobileViewport) return undefined;

    setOpenMobileNav(mobileActiveGroup);

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [showMobileMenu, mobileActiveGroup]);

  useEffect(() => {
    initAnalytics();
  }, []);

  // Navigasi section beranda memakai hash bersih (mis. /#promo) + koreksi posisi
  // setelah produk selesai dimuat.
  useHashSectionScroll(locale, location, productsLoading);

  const latestNavPost = blogPosts.find(isBlogPublic) || blogPosts[0] || null;

  return (
    <ErrorBoundary>
      <div
        style={{ fontFamily: "'Work Sans', sans-serif", background: "#F6F1E7", minHeight: "100vh" }}
      >
        <HomeReturnTransition visible={showHomeReturnTransition} />
        <PageRouteTransition visible={routeTransition.visible} label={routeTransition.label} />
        <style>{APP_GLOBAL_STYLES}</style>

        {/* Skip navigation */}
        <a
          href="#katalog"
          style={{
            position: "absolute",
            left: "-9999px",
            top: "auto",
            width: "1px",
            height: "1px",
            overflow: "hidden",
          }}
          onFocus={(e) => {
            e.target.style.position = "fixed";
            e.target.style.left = "16px";
            e.target.style.top = "8px";
            e.target.style.width = "auto";
            e.target.style.height = "auto";
            e.target.style.zIndex = 9999;
            e.target.style.background = "#1F2E22";
            e.target.style.color = "#F6F1E7";
            e.target.style.padding = "8px 16px";
            e.target.style.fontSize = "13px";
            e.target.style.fontFamily = "'Work Sans', sans-serif";
            e.target.style.textDecoration = "none";
          }}
          onBlur={(e) => {
            e.target.style.position = "absolute";
            e.target.style.left = "-9999px";
            e.target.style.width = "1px";
            e.target.style.height = "1px";
          }}
        >
          {t("Langsung ke katalog", "Skip to catalog")}
        </a>
        {/* Header */}
        {(isCatalogPage || isReviewsPage || isFaqPage || isSkinQuizPage) && (
          <SimpleBackHeader
            onBack={
              isCatalogPage
                ? closeCatalogPage
                : isReviewsPage
                  ? closeReviewsPage
                  : isFaqPage
                    ? closeFaqPage
                    : closeSkinQuizPage
            }
          />
        )}

        {!isCatalogPage && !isReviewsPage && !isFaqPage && !isSkinQuizPage && (
          <StoreHeader
            user={user}
            customer={customer}
            onOpenCustomerAccount={() => setShowCustomerAccount(true)}
            customerAccountsEnabled={featureFlags.customerAccounts}
            view={view}
            setView={setView}
            showMobileMenu={showMobileMenu}
            setShowMobileMenu={setShowMobileMenu}
            showSearch={showSearch}
            setShowSearch={setShowSearch}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            products={products}
            openProduct={openProduct}
            openNavMenu={openNavMenu}
            setOpenNavMenu={setOpenNavMenu}
            openCatalogCategory={openCatalogCategory}
            scrollToSection={scrollToSection}
            openReviewsPage={openReviewsPage}
            openReviewFormFromNav={openReviewFormFromNav}
            openBlogCategory={openBlogCategory}
            openBlogPost={openBlogPost}
            openFaqPage={openFaqPage}
            openSkinQuizPage={openSkinQuizPage}
            handlePushSubscribe={handlePushSubscribe}
            pushState={pushState}
            pushMessage={pushToast}
            latestNavPost={latestNavPost}
            wishlist={wishlist}
            cartCount={cartCount}
            onOpenWishlist={() => {
              setShowNotifPanel(false);
              setShowWishlist(true);
            }}
            onOpenCart={() => {
              setShowNotifPanel(false);
              setShowCart(true);
            }}
            showNotifPanel={showNotifPanel}
            setShowNotifPanel={setShowNotifPanel}
            notifications={notifications}
            notifsLoading={notifsLoading}
            readNotifIds={readNotifIds}
            setReadNotifIds={setReadNotifIds}
            unreadCount={unreadCount}
            openNotifPanel={() => {
              setShowWishlist(false);
              setShowCart(false);
              openNotifPanel();
            }}
            onHideNotification={hideNotificationLocally}
            onClearAll={clearAllNotifications}
            adminTapCount={adminTapCount}
            setAdminTapCount={setAdminTapCount}
            adminTapTimer={adminTapTimer}
            setShowLogin={setShowLogin}
          />
        )}

        <MobileDrawer
          showMobileMenu={showMobileMenu}
          setShowMobileMenu={setShowMobileMenu}
          openMobileNav={openMobileNav}
          setOpenMobileNav={setOpenMobileNav}
          mobileActiveGroup={mobileActiveGroup}
          openCatalogCategory={openCatalogCategory}
          scrollToSection={scrollToSection}
          openReviewsPage={openReviewsPage}
          openReviewFormFromNav={openReviewFormFromNav}
          openBlogCategory={openBlogCategory}
          openFaqPage={openFaqPage}
          openSkinQuizPage={openSkinQuizPage}
          handlePushSubscribe={handlePushSubscribe}
          pushState={pushState}
        />

        {view === "admin" && user ? (
          <React.Suspense
            fallback={
              <div
                style={{
                  minHeight: "60vh",
                  display: "grid",
                  placeItems: "center",
                  background: "#F6F1E7",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Work Sans', sans-serif",
                    color: "#6B6558",
                    fontSize: "13px",
                  }}
                >
                  {t("Memuat dashboard admin...", "Loading admin dashboard...")}
                </p>
              </div>
            }
          >
            <AdminPanel products={rawProducts} coupons={rawCoupons} />
          </React.Suspense>
        ) : isProductPage ? (
          selected ? (
            <ProductDetailPage
              product={selected}
              products={products}
              onAdd={addToCart}
              onBack={closeProduct}
              onOpen={openProduct}
              shared={detailShared}
              onShare={() => {
                const productUrl = `${window.location.origin}${route("product", { id: `${toSlug(selected.name)}-${selected.id}` })}`;
                const text = `${selected.name} — ${formatIDR(selected.price)}\n${selected.blurb}\n\n${t("Lihat produk", "View product")}: ${productUrl}`;
                if (navigator.share) {
                  navigator.share({ title: selected.name, text, url: productUrl });
                } else {
                  navigator.clipboard.writeText(text).catch(() => {});
                  setDetailShared(true);
                  setTimeout(() => setDetailShared(false), 2000);
                }
              }}
            />
          ) : (
            <main className="product-route-state" aria-live="polite" aria-busy={productsLoading}>
              {productsLoading ? (
                <div className="product-route-skeleton" aria-label="Memuat detail produk">
                  <div className="product-route-skeleton-media" />
                  <div className="product-route-skeleton-copy">
                    <span />
                    <strong />
                    <strong className="is-short" />
                    <p />
                    <p className="is-short" />
                    <b />
                    <button type="button" disabled />
                  </div>
                </div>
              ) : (
                <div className="product-route-not-found">
                  <p>PRODUK TIDAK DITEMUKAN</p>
                  <h1>Produk yang kamu cari tidak tersedia.</h1>
                  <span>Link mungkin sudah berubah atau produknya telah dihapus dari katalog.</span>
                  <button type="button" onClick={() => navigate(route("catalog"))}>
                    Kembali ke katalog
                  </button>
                </div>
              )}
            </main>
          )
        ) : isCatalogPage ? (
          <>
            <CatalogSection
              products={products}
              productsLoading={productsLoading}
              mode="page"
              activeCategory={activeCategory}
              onCategoryChange={openCatalogCategory}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onAdd={addToCart}
              onOpen={openProduct}
              wishlist={wishlist}
              onToggleWishlist={toggleWishlist}
              onViewAll={openAllProducts}
              onBack={closeCatalogPage}
            />
            <StandaloneStoreFooter />
          </>
        ) : isReviewsPage ? (
          <>
            <TestimoniSection
              products={products}
              isAdmin={!!user}
              pageMode
              openFormOnMount={Boolean(location.state?.openReviewForm)}
            />
            <StandaloneStoreFooter />
          </>
        ) : isFaqPage ? (
          <>
            <FaqSection pageMode />
            <StandaloneStoreFooter />
          </>
        ) : isSkinQuizPage ? (
          <>
            <React.Suspense
              fallback={
                <div
                  style={{
                    minHeight: "60vh",
                    display: "grid",
                    placeItems: "center",
                    color: "#6B6558",
                  }}
                >
                  {t("Menyiapkan kuis tipe kulit...", "Preparing skin type quiz...")}
                </div>
              }
            >
              <SkinQuizPage
                products={products}
                productsLoading={productsLoading}
                onAdd={addToCart}
                onOpen={(product, quizSession) =>
                  openProduct(product, {
                    skinQuizSession: quizSession,
                    skinQuizReturnState: location.state,
                  })
                }
                onBrowseCatalog={() => openCatalogCategory("semua")}
                session={location.state?.quizSession}
              />
            </React.Suspense>
            <StandaloneStoreFooter />
          </>
        ) : (
          <HomeContent
            locale={locale}
            route={route}
            navigate={navigate}
            location={location}
            products={products}
            productsLoading={productsLoading}
            flashSale={flashSale}
            flashSaleRemainingMs={flashSaleRemainingMs}
            coupons={coupons}
            blogPosts={blogPosts}
            user={user}
            wishlist={wishlist}
            cart={cart}
            setCart={setCart}
            setShowCart={setShowCart}
            pushState={pushState}
            handlePushSubscribe={handlePushSubscribe}
            addToCart={addToCart}
            toggleWishlist={toggleWishlist}
            openProduct={openProduct}
            openAllProducts={openAllProducts}
            closeCatalogPage={closeCatalogPage}
            openCatalogCategory={openCatalogCategory}
            openReviewsPage={openReviewsPage}
            openFaqPage={openFaqPage}
            openSkinQuizPage={openSkinQuizPage}
            openBlogCategory={openBlogCategory}
            openBlogPost={openBlogPost}
            scrollToSection={scrollToSection}
            setSortBy={setSortBy}
            featureFlags={featureFlags}
          />
        )}

        {/* Detail produk sekarang punya halaman sendiri di /produk/:id */}

        <React.Suspense fallback={null}>
          {showWishlist && (
            <WishlistDrawer
              open={showWishlist}
              onClose={() => setShowWishlist(false)}
              wishlist={wishlist}
              onRemove={toggleWishlist}
              onAdd={addToCart}
              onAddAll={addWishlistItemsToCart}
              onBrowseCatalog={() => scrollToSection("katalog")}
            />
          )}
          {showCart && (
            <CartDrawer
              open={showCart}
              onClose={() => setShowCart(false)}
              cart={cart}
              onQty={changeQty}
              onCheckout={() => {
                setShowCart(false);
                setShowCheckout(true);
                analytics.beginCheckout(cart);
              }}
            />
          )}
          {showLogin && (
            <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
          )}
          {showCustomerAccount && (
            <CustomerAccountModal
              open={showCustomerAccount}
              customer={customer}
              initialReferralCode={pendingReferralCode}
              onReferralHandled={() => {
                clearPendingReferralCode();
                setPendingReferralCode("");
              }}
              onClose={() => setShowCustomerAccount(false)}
              onReorder={(items = []) => {
                const reorderedCart = items.map((item) => {
                  const latest = products.find((product) => product.id === item.id);
                  if (!latest || Number(latest.stock || 0) <= 0) return null;
                  return { ...latest, qty: Math.max(1, Math.min(Number(item.qty || 1), Number(latest.stock || 0))) };
                }).filter(Boolean);
                if (reorderedCart.length === 0) return;
                setCart(reorderedCart);
                setShowCart(true);
              }}
              featureFlags={featureFlags}
            />
          )}
          {showCheckout && (
            <CheckoutModal
              open={showCheckout}
              onClose={() => setShowCheckout(false)}
              cart={cart}
              onConfirm={handleCheckoutConfirm}
              onTrackOrder={(trackedOrderId) => {
                scrollToSection("lacak");
                window.setTimeout(() => {
                  window.dispatchEvent(
                    new CustomEvent("mg:track-order", { detail: { orderId: trackedOrderId } })
                  );
                }, 180);
              }}
              onContinueShopping={() => navigate(route("catalog"))}
              onRetryOrder={() => setShowCart(true)}
              coupons={coupons}
              customer={customer}
              featureFlags={featureFlags}
            />
          )}
        </React.Suspense>

        {/* Toast notifications */}
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            pointerEvents: "none",
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "#1F2E22",
                color: "#F6F1E7",
                padding: "12px 16px",
                minWidth: "260px",
                maxWidth: "320px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                animation: "slideInToast 0.25s ease",
                pointerEvents: "auto",
                borderRadius: "12px",
              }}
            >
              {t.product.image ? (
                <img
                  src={resolveProductImage(t.product)}
                  alt=""
                  loading="lazy"
                  style={{
                    width: "40px",
                    height: "40px",
                    objectFit: "cover",
                    flexShrink: 0,
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
              ) : (
                <div
                  style={{ width: "40px", height: "40px", background: "#2E4232", flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    color: t.product._stockWarning ? "#F0C080" : "#A8C5A0",
                    letterSpacing: "0.05em",
                    marginBottom: "2px",
                  }}
                >
                  {t.product._stockWarning ? "STOK SUDAH MAKSIMAL" : "DITAMBAHKAN KE KERANJANG"}
                </p>
                <p
                  style={{
                    fontFamily: "'Work Sans', sans-serif",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#F6F1E7",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {t.product.name}
                </p>
              </div>
              <button
                onClick={() => setShowCart(true)}
                style={{
                  background: "#4C6354",
                  border: "none",
                  color: "#F6F1E7",
                  fontFamily: "'Work Sans', sans-serif",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "5px 10px",
                  cursor: "pointer",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                Lihat →
              </button>
            </div>
          ))}
        </div>

        <style>{APP_REVEAL_STYLES}</style>
        <style>{APP_ANIMATION_STYLES}</style>
        <div className="mg-scroll-progress" aria-hidden="true" />

        <PrivacyNotice />

        {gesaReady &&
          view !== "admin" &&
          !showCart &&
          !showCheckout &&
          !showWishlist &&
          !showNotifPanel &&
          !showMobileMenu && (
            <React.Suspense fallback={null}>
              <GesaChat compact={gesaCompact} locale={locale} />
            </React.Suspense>
          )}
      </div>
    </ErrorBoundary>
  );
}

export function CatalogPage() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    let restoreScrollY = Number(location.state?.restoreScrollY);

    if ((!Number.isFinite(restoreScrollY) || restoreScrollY < 0) && navigationType === "POP") {
      try {
        const saved = JSON.parse(sessionStorage.getItem(CATALOG_SCROLL_MEMORY_KEY) || "null");
        const currentPath = `${location.pathname}${location.search}${location.hash}`;
        if (saved?.path === currentPath) restoreScrollY = Number(saved.scrollY);
      } catch {}
    }

    const hasRestorePosition = Number.isFinite(restoreScrollY) && restoreScrollY >= 0;
    const targetScrollY = hasRestorePosition ? restoreScrollY : 0;
    const scrollToTarget = () => window.scrollTo({ top: targetScrollY, left: 0, behavior: "auto" });

    scrollToTarget();
    let secondFrame = null;
    const firstFrame = window.requestAnimationFrame(() => {
      scrollToTarget();
      secondFrame = window.requestAnimationFrame(scrollToTarget);
    });
    const settleTimer = window.setTimeout(scrollToTarget, 160);

    if (hasRestorePosition || navigationType !== "POP") {
      try {
        sessionStorage.removeItem(CATALOG_SCROLL_MEMORY_KEY);
      } catch {}
    }

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settleTimer);
    };
  }, [
    location.key,
    location.pathname,
    location.search,
    location.hash,
    location.state?.restoreScrollY,
    navigationType,
  ]);

  return <App />;
}

export function ReviewsPage() {
  const location = useLocation();

  useLayoutEffect(() => {
    const hasRestorePosition =
      Boolean(location.state?.restoreSection) ||
      (Number.isFinite(Number(location.state?.restoreScrollY)) &&
        Number(location.state?.restoreScrollY) >= 0);
    if (!hasRestorePosition) window.scrollTo(0, 0);
  }, [location.key, location.state?.restoreSection, location.state?.restoreScrollY]);

  return <App />;
}

export function FaqPage() {
  const location = useLocation();

  useLayoutEffect(() => {
    const hasRestorePosition =
      Boolean(location.state?.restoreSection) ||
      (Number.isFinite(Number(location.state?.restoreScrollY)) &&
        Number(location.state?.restoreScrollY) >= 0);
    if (!hasRestorePosition) window.scrollTo(0, 0);
  }, [location.key, location.state?.restoreSection, location.state?.restoreScrollY]);

  return <App />;
}
