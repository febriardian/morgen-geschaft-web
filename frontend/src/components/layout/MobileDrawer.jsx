import { X, ChevronRight, Star, Bell, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { CATEGORIES, BLOG_CATEGORY_OPTIONS } from "../../config/constants.js";
import { LanguageSwitcher } from "../shared/LanguageSwitcher.jsx";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import { parseLocalizedPath } from "../../i18n/locale.js";

export function MobileDrawer({
  showMobileMenu,
  setShowMobileMenu,
  openMobileNav,
  setOpenMobileNav,
  mobileActiveGroup,
  openCatalogCategory,
  scrollToSection,
  openReviewsPage,
  openReviewFormFromNav,
  openBlogCategory,
  openFaqPage,
  openSkinQuizPage,
  handlePushSubscribe,
  pushState,
}) {
  const location = useLocation();
  const { route, t } = useLocale();
  const routeInfo = parseLocalizedPath(location.pathname);
  const isFaqPage = routeInfo.key === "faq";

  return (
    <>
      {/* Backdrop */}
      {showMobileMenu && (
        <div
          className="mobile-only-drawer"
          aria-hidden="true"
          onClick={() => setShowMobileMenu(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(31,46,34,0.45)",
            zIndex: 70,
            backdropFilter: "blur(1px)",
          }}
        />
      )}

      {/* Drawer */}
      <aside
        className="mobile-only-drawer"
        aria-label="Menu navigasi"
        aria-hidden={!showMobileMenu}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100dvh",
          maxHeight: "100dvh",
          width: "min(342px, 92vw)",
          maxWidth: "100vw",
          background: "#F6F1E7",
          borderLeft: "1px solid #E3DCC9",
          zIndex: 71,
          transform: showMobileMenu ? "translateX(0)" : "translateX(100%)",
          visibility: showMobileMenu ? "visible" : "hidden",
          transition: "transform 0.3s ease, visibility 0.3s ease",
          display: "flex",
          flexDirection: "column",
          boxShadow: showMobileMenu ? "-10px 0 30px rgba(22,43,69,0.12)" : "none",
          overscrollBehavior: "contain",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            minHeight: "64px",
            padding: "0 18px 0 20px",
            borderBottom: "1px solid #E3DCC9",
            background: "rgba(246,241,231,.98)",
            flexShrink: 0,
          }}
        >
          <div>
            <span
              style={{
                display: "block",
                fontFamily: "'Fraunces', serif",
                fontSize: "19px",
                color: "#162B45",
              }}
            >
              Menu
            </span>
            <span
              style={{
                display: "block",
                marginTop: "2px",
                fontFamily: "'Work Sans', sans-serif",
                fontSize: "10px",
                color: "#A39E8E",
              }}
            >
              Pilih halaman atau kategori
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <LanguageSwitcher compact onChange={() => setShowMobileMenu(false)} />
            <button
              type="button"
              aria-label={t("Tutup menu", "Close menu")}
              onClick={() => setShowMobileMenu(false)}
              style={{
                width: "38px",
                height: "38px",
                display: "grid",
                placeItems: "center",
                background: "#FFFFFF",
                border: "1px solid #E3DCC9",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              <X size={19} color="#162B45" />
            </button>
          </div>
        </div>

        {/* Scrollable content — key di-remount saat menu dibuka agar animasi stagger main lagi */}
        <div
          key={showMobileMenu ? "open" : "closed"}
          className="mg-drawer-list"
          style={{
            overflowY: "auto",
            flex: "1 1 auto",
            minHeight: 0,
            padding: "8px 0 10px",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Katalog */}
          <MobileAccordion
            label="Katalog"
            groupKey="catalog"
            openMobileNav={openMobileNav}
            setOpenMobileNav={setOpenMobileNav}
            mobileActiveGroup={mobileActiveGroup}
          >
            {CATEGORIES.map((category) => {
              const targetPath = route("catalog", { categoryId: category.id });
              const isActive = location.pathname === targetPath;
              return (
                <MobileMenuItem
                  key={category.id}
                  label={category.id === "semua" ? "Semua Produk" : category.label}
                  isActive={isActive}
                  onClick={() => {
                    setShowMobileMenu(false);
                    openCatalogCategory(category.id);
                  }}
                />
              );
            })}
          </MobileAccordion>

          {/* Promo */}
          <MobileAccordion
            label="Promo"
            groupKey="promo"
            openMobileNav={openMobileNav}
            setOpenMobileNav={setOpenMobileNav}
            mobileActiveGroup={mobileActiveGroup}
          >
            {[
              { label: "Semua Promo", action: () => scrollToSection("promo") },
              { label: "Kode Kupon", action: () => scrollToSection("promo") },
              { label: "Promo Pembeli Baru", action: () => scrollToSection("promo") },
              { label: "Bundle Hemat", action: () => openCatalogCategory("bundle") },
            ].map((item) => (
              <MobileMenuItem
                key={item.label}
                label={item.label}
                onClick={() => {
                  setShowMobileMenu(false);
                  item.action();
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setShowMobileMenu(false);
                handlePushSubscribe();
              }}
              style={{
                width: "100%",
                minHeight: "44px",
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "none",
                borderRadius: "9px",
                background: pushState === "subscribed" ? "#E7EFE2" : "transparent",
                color: pushState === "subscribed" ? "#F59A1A" : "#4D5C69",
                fontFamily: "'Work Sans', sans-serif",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span>
                {pushState === "subscribed"
                  ? "Notifikasi Promo Aktif"
                  : "Aktifkan Notifikasi Promo"}
              </span>
              <Bell size={14} aria-hidden="true" />
            </button>
          </MobileAccordion>

          {/* Ulasan */}
          <MobileAccordion
            label="Ulasan"
            groupKey="reviews"
            openMobileNav={openMobileNav}
            setOpenMobileNav={setOpenMobileNav}
            mobileActiveGroup={mobileActiveGroup}
          >
            {[
              {
                label: "Semua Ulasan",
                action: () => openReviewsPage(),
                isActive: routeInfo.key === "reviews",
              },
              { label: "Ulasan Produk", action: () => openCatalogCategory("semua") },
              {
                label: "Tulis Ulasan",
                action: openReviewFormFromNav,
                icon: <Star size={14} aria-hidden="true" />,
              },
            ].map((item) => (
              <MobileMenuItem
                key={item.label}
                label={item.label}
                isActive={item.isActive}
                icon={item.icon}
                onClick={() => {
                  setShowMobileMenu(false);
                  item.action();
                }}
              />
            ))}
          </MobileAccordion>

          {/* Artikel */}
          <MobileAccordion
            label="Artikel"
            groupKey="articles"
            openMobileNav={openMobileNav}
            setOpenMobileNav={setOpenMobileNav}
            mobileActiveGroup={mobileActiveGroup}
          >
            <MobileMenuItem
              label="Semua Artikel"
              isActive={routeInfo.key === "blog"}
              onClick={() => {
                setShowMobileMenu(false);
                openBlogCategory("semua");
              }}
            />
            {BLOG_CATEGORY_OPTIONS.map((category) => {
              const targetPath = route("blogCategory", { categoryId: category.value });
              return (
                <MobileMenuItem
                  key={category.value}
                  label={category.label}
                  isActive={location.pathname === targetPath}
                  onClick={() => {
                    setShowMobileMenu(false);
                    openBlogCategory(category.value);
                  }}
                />
              );
            })}
          </MobileAccordion>

          {/* Tentang Kami */}
          <button
            type="button"
            onClick={() => {
              setShowMobileMenu(false);
              scrollToSection("tentang");
            }}
            style={{
              width: "100%",
              minHeight: "56px",
              padding: "0 18px 0 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              border: "none",
              borderBottom: "1px solid #E9E3D6",
              borderLeft:
                mobileActiveGroup === "about" ? "3px solid #F59A1A" : "3px solid transparent",
              background: mobileActiveGroup === "about" ? "#FFF7E8" : "transparent",
              color: mobileActiveGroup === "about" ? "#F59A1A" : "#162B45",
              fontFamily: "'Work Sans', sans-serif",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span>Tentang Kami</span>
            <ChevronRight size={17} aria-hidden="true" />
          </button>

          {/* Lainnya */}
          <MobileAccordion
            label="Lainnya"
            groupKey="more"
            openMobileNav={openMobileNav}
            setOpenMobileNav={setOpenMobileNav}
            mobileActiveGroup={mobileActiveGroup}
          >
            <MobileMenuItem
              label="Kuis Tipe Kulit"
              isActive={routeInfo.key === "skinQuiz"}
              icon={<Sparkles size={14} aria-hidden="true" />}
              onClick={() => {
                setShowMobileMenu(false);
                openSkinQuizPage();
              }}
            />
            {[
              { label: "Lacak Pesanan", target: "lacak" },
              { label: "FAQ", target: "faq" },
              { label: "Kontak", target: "kontak" },
            ].map((item) => {
              const isActive =
                item.target === "faq" ? isFaqPage : location.hash === `#${item.target}`;
              return (
                <MobileMenuItem
                  key={item.label}
                  label={item.label}
                  isActive={isActive}
                  onClick={() => {
                    setShowMobileMenu(false);
                    item.target === "faq" ? openFaqPage() : scrollToSection(item.target);
                  }}
                />
              );
            })}
          </MobileAccordion>
        </div>

        {/* Footer */}
        <div
          style={{
            flexShrink: 0,
            padding: "12px 18px calc(12px + env(safe-area-inset-bottom, 0px))",
            borderTop: "1px solid #E3DCC9",
            background: "rgba(241,234,220,.96)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#7D776B",
              fontFamily: "'Work Sans', sans-serif",
              fontSize: "10px",
              lineHeight: 1.5,
            }}
          >
            © {new Date().getFullYear()} Morgen Geschäft
          </p>
          <p
            style={{
              margin: "2px 0 0",
              color: "#AAA394",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "8px",
              letterSpacing: ".05em",
              textTransform: "uppercase",
            }}
          >
            Morgen Group
          </p>
        </div>
      </aside>
    </>
  );
}

function MobileAccordion({
  label,
  groupKey,
  openMobileNav,
  setOpenMobileNav,
  mobileActiveGroup,
  children,
}) {
  const isOpen = openMobileNav === groupKey;
  const isActive = mobileActiveGroup === groupKey;
  return (
    <div style={{ borderBottom: "1px solid #E9E3D6" }}>
      <button
        type="button"
        onClick={() => setOpenMobileNav((c) => (c === groupKey ? null : groupKey))}
        aria-expanded={isOpen}
        style={{
          width: "100%",
          minHeight: "56px",
          padding: "0 18px 0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          border: "none",
          borderLeft: isActive ? "3px solid #F59A1A" : "3px solid transparent",
          background: isActive ? "#FFF7E8" : "transparent",
          color: isActive ? "#F59A1A" : "#162B45",
          fontFamily: "'Work Sans', sans-serif",
          fontSize: "15px",
          fontWeight: 600,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span>{label}</span>
        <ChevronRight
          size={17}
          aria-hidden="true"
          style={{
            transform: isOpen ? "rotate(90deg)" : "rotate(0)",
            transition: "transform .2s ease",
          }}
        />
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition: "grid-template-rows .24s ease",
        }}
      >
        <div style={{ minHeight: 0, overflow: "hidden" }}>
          <div style={{ padding: "4px 12px 10px 22px", background: "rgba(255,255,255,.48)" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileMenuItem({ label, isActive = false, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: "44px",
        padding: "0 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "none",
        borderRadius: "9px",
        background: isActive ? "#F6E8D0" : "transparent",
        color: isActive ? "#A9573D" : "#4D5C69",
        fontFamily: "'Work Sans', sans-serif",
        fontSize: "13px",
        fontWeight: isActive ? 600 : 500,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span>{label}</span>
      {icon || <ChevronRight size={14} aria-hidden="true" />}
    </button>
  );
}
