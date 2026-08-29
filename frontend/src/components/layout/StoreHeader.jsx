import { useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag, Heart, Bell, LogOut, UserRound } from "lucide-react";
import { SearchDropdown } from "../../features/catalog/Catalog.jsx";
import { DesktopNav } from "./DesktopNav.jsx";
import { NotificationPanel } from "./NotificationPanel.jsx";
import { LanguageSwitcher } from "../shared/LanguageSwitcher.jsx";
import { useLocale } from "../../i18n/LocaleContext.jsx";

export function StoreHeader({
  user,
  customer,
  onOpenCustomerAccount,
  customerAccountsEnabled = true,
  view,
  setView,
  showMobileMenu,
  setShowMobileMenu,
  showSearch,
  setShowSearch,
  searchQuery,
  setSearchQuery,
  products,
  openProduct,
  // Nav actions
  openNavMenu,
  setOpenNavMenu,
  openCatalogCategory,
  scrollToSection,
  openReviewsPage,
  openReviewFormFromNav,
  openBlogCategory,
  openBlogPost,
  openFaqPage,
  openSkinQuizPage,
  handlePushSubscribe,
  pushState,
  pushMessage,
  latestNavPost,
  // Cart / Wishlist
  wishlist,
  cartCount,
  onOpenWishlist,
  onOpenCart,
  // Notifications
  showNotifPanel,
  setShowNotifPanel,
  notifications,
  notifsLoading,
  readNotifIds,
  setReadNotifIds,
  unreadCount,
  openNotifPanel,
  onHideNotification,
  onClearAll,
  // Admin
  adminTapCount,
  setAdminTapCount,
  adminTapTimer,
  setShowLogin,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { route, t } = useLocale();
  const desktopNavRef = useRef(null);

  // Close desktop menu on outside click / scroll / escape
  useEffect(() => {
    if (!openNavMenu) return undefined;

    const closeDesktopMenu = (event) => {
      if (!desktopNavRef.current?.contains(event.target)) setOpenNavMenu(null);
    };
    const closeOnScroll = () => setOpenNavMenu(null);
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpenNavMenu(null);
    };

    document.addEventListener("mousedown", closeDesktopMenu);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", closeDesktopMenu);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnScroll);
    };
  }, [openNavMenu, setOpenNavMenu]);

  return (
    <header
      style={{
        borderBottom: "1px solid #E3DCC9",
        background: "#F6F1E7",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div
        className="header-inner"
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 32px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <button
          onClick={() => {
            setView("store");
            setShowMobileMenu(false);
            if (location.pathname !== route("home")) navigate(route("home"));
            window.scrollTo({ top: 0, behavior: "smooth" });
            if (!user) {
              setAdminTapCount((prev) => {
                const next = prev + 1;
                if (next >= 5) {
                  setShowLogin(true);
                  return 0;
                }
                clearTimeout(adminTapTimer[0]);
                adminTapTimer[0] = setTimeout(() => setAdminTapCount(0), 1500);
                return next;
              });
            }
          }}
          className="site-brand"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "none",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <img
            className="site-brand-logo"
            src="/photos/logo-512.webp"
            alt="Logo Morgen Geschäft"
            style={{ width: "34px", height: "34px" }}
          />
          <span
            className="site-brand-name"
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "20px",
              color: "#173B5E",
              whiteSpace: "nowrap",
            }}
          >
            Morgen Geschäft
          </span>
        </button>

        {showMobileMenu ? (
          <DesktopNav
            desktopNavRef={desktopNavRef}
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
            latestNavPost={latestNavPost}
          />
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {/* Right icons */}
        <div
          className="header-actions"
          style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}
        >
          <span className="desktop-language-switcher">
            <LanguageSwitcher />
          </span>
          <SearchDropdown
            showSearch={showSearch}
            setShowSearch={setShowSearch}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            products={products}
            openProduct={openProduct}
          />

          {/* Hamburger */}
          <button
            className="premium-icon-btn hamburger-btn"
            onClick={() => setShowMobileMenu((m) => !m)}
            aria-label={
              showMobileMenu ? t("Tutup menu", "Close menu") : t("Buka menu", "Open menu")
            }
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              padding: "4px",
            }}
          >
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "#162B45",
                borderRadius: "2px",
                transition: "all 0.25s",
                transform: showMobileMenu ? "rotate(45deg) translateY(7px)" : "none",
              }}
            />
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "#162B45",
                borderRadius: "2px",
                transition: "all 0.25s",
                opacity: showMobileMenu ? 0 : 1,
              }}
            />
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "#162B45",
                borderRadius: "2px",
                transition: "all 0.25s",
                transform: showMobileMenu ? "rotate(-45deg) translateY(-7px)" : "none",
              }}
            />
          </button>

          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="nav-label-masuk" style={{ fontSize: "13px", color: "#6B6558" }}>
                Hai, {user.split("@")[0]}
              </span>
              <button
                onClick={async () => {
                  const { signOutAdmin } = await import("../../services/firebaseAuth.js");
                  await signOutAdmin();
                  setView("store");
                }}
                title={t("Keluar", "Sign out")}
                aria-label={t("Keluar", "Sign out")}
              >
                <LogOut size={16} color="#6B6558" />
              </button>
              <button
                onClick={() => setView(view === "admin" ? "store" : "admin")}
                style={{
                  fontSize: "12px",
                  border: "1px solid #E3DCC9",
                  background: view === "admin" ? "#1F2E22" : "transparent",
                  color: view === "admin" ? "#F6F1E7" : "#162B45",
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                Admin
              </button>
            </div>
          )}

          {!user && customerAccountsEnabled && (
            <button
              className="premium-icon-btn"
              type="button"
              onClick={onOpenCustomerAccount}
              title={customer ? customer.email : t("Masuk akun pelanggan", "Customer sign in")}
              aria-label={customer ? t("Buka akun pelanggan", "Open customer account") : t("Masuk akun pelanggan", "Customer sign in")}
              style={{ position: "relative", background: "none", border: "none", cursor: "pointer" }}
            >
              <UserRound size={19} color={customer ? "#F59A1A" : "#162B45"} />
              {customer && <span aria-hidden="true" style={{ position: "absolute", width: 7, height: 7, borderRadius: "50%", background: "#F59A1A", right: -2, top: -2, border: "2px solid #F6F1E7" }} />}
            </button>
          )}

          <button
            className="premium-icon-btn"
            onClick={onOpenWishlist}
            style={{ position: "relative", background: "none", border: "none", cursor: "pointer" }}
            title="Wishlist"
            aria-label={t(
              `Wishlist, ${wishlist.length} produk tersimpan`,
              `Wishlist, ${wishlist.length} saved products`
            )}
          >
            <Heart size={19} color="#162B45" fill={wishlist.length > 0 ? "#C97B5E" : "none"} />
            {wishlist.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -8,
                  background: "#C97B5E",
                  color: "#fff",
                  fontSize: "10px",
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {wishlist.length}
              </span>
            )}
          </button>

          {/* Notification bell */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <button
              className="premium-icon-btn"
              onClick={openNotifPanel}
              style={{
                position: "relative",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              title={t("Notifikasi", "Notifications")}
              aria-label={t("Notifikasi", "Notifications")}
            >
              <Bell
                size={19}
                color={pushState === "subscribed" ? "#F59A1A" : "#162B45"}
                fill={pushState === "subscribed" ? "rgba(245,154,26,.16)" : "none"}
              />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -8,
                    background: "#C97B5E",
                    color: "#fff",
                    fontSize: "10px",
                    borderRadius: "50%",
                    width: 16,
                    height: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              {unreadCount === 0 && pushState === "subscribed" && (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    background: "#F59A1A",
                    borderRadius: "50%",
                    width: 8,
                    height: 8,
                    border: "2px solid #F6F1E7",
                  }}
                />
              )}
            </button>

            {showNotifPanel && (
              <NotificationPanel
                notifications={notifications}
                notifsLoading={notifsLoading}
                readNotifIds={readNotifIds}
                setReadNotifIds={setReadNotifIds}
                onClose={() => setShowNotifPanel(false)}
                onHideNotification={onHideNotification}
                onClearAll={onClearAll}
                pushState={pushState}
                pushMessage={pushMessage}
                onPushSubscribe={handlePushSubscribe}
              />
            )}
          </div>

          <button
            className="premium-icon-btn"
            onClick={onOpenCart}
            style={{ position: "relative", background: "none", border: "none", cursor: "pointer" }}
            aria-label={t(`Keranjang, ${cartCount} item`, `Cart, ${cartCount} items`)}
          >
            <ShoppingBag size={20} color="#162B45" />
            {cartCount > 0 && (
              <span
                key={cartCount}
                className="mg-cart-badge"
                style={{
                  position: "absolute",
                  top: -6,
                  right: -8,
                  background: "#C97B5E",
                  color: "#fff",
                  fontSize: "10px",
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
