import { ChevronRight, Bell, Star, Sparkles } from "lucide-react";
import { CATEGORIES, BLOG_CATEGORY_OPTIONS } from "../../config/constants.js";

export function DesktopNav({
  desktopNavRef,
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
  latestNavPost,
}) {
  return (
    <nav
      ref={desktopNavRef}
      className="desktop-only-nav"
      onMouseLeave={() => setOpenNavMenu(null)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "32px",
        flex: 1,
      }}
    >
      {/* Katalog */}
      <NavDropdown
        label="Katalog"
        menuKey="catalog"
        openNavMenu={openNavMenu}
        setOpenNavMenu={setOpenNavMenu}
        menuClassName="is-wide"
      >
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            role="menuitem"
            className="premium-more-item"
            onClick={() => openCatalogCategory(category.id)}
          >
            <span>{category.id === "semua" ? "Semua Produk" : category.label}</span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        ))}
      </NavDropdown>

      {/* Promo */}
      <NavDropdown
        label="Promo"
        menuKey="promo"
        openNavMenu={openNavMenu}
        setOpenNavMenu={setOpenNavMenu}
        menuClassName="is-wide"
      >
        <button
          type="button"
          role="menuitem"
          className="premium-more-item"
          onClick={() => {
            setOpenNavMenu(null);
            openSkinQuizPage();
          }}
        >
          <span className="premium-more-item-copy">
            <span>Kuis Tipe Kulit</span>
            <small>Temukan produk sesuai kebutuhan dasar kulit</small>
          </span>
          <Sparkles size={14} aria-hidden="true" />
        </button>
        <div className="premium-more-divider" />
        {[
          {
            label: "Semua Promo",
            desc: "Lihat kode yang sedang aktif",
            action: () => scrollToSection("promo"),
          },
          {
            label: "Kode Kupon",
            desc: "Salin kode untuk checkout",
            action: () => scrollToSection("promo"),
          },
          {
            label: "Promo Pembeli Baru",
            desc: "Penawaran khusus pelanggan baru",
            action: () => scrollToSection("promo"),
          },
          {
            label: "Bundle Hemat",
            desc: "Paket produk dengan harga hemat",
            action: () => openCatalogCategory("bundle"),
          },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="premium-more-item"
            onClick={() => {
              setOpenNavMenu(null);
              item.action();
            }}
          >
            <span className="premium-more-item-copy">
              <span>{item.label}</span>
              <small>{item.desc}</small>
            </span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        ))}

        <div className="premium-more-divider" />

        <button
          type="button"
          role="menuitem"
          className="premium-more-item"
          onClick={() => {
            setOpenNavMenu(null);
            handlePushSubscribe();
          }}
        >
          <span className="premium-more-item-copy">
            <span>Aktifkan Notifikasi Promo</span>
            <small>
              {pushState === "subscribed"
                ? "Notifikasi sudah aktif"
                : "Dapatkan kabar promo terbaru"}
            </small>
          </span>
          <Bell size={14} aria-hidden="true" />
        </button>
      </NavDropdown>

      {/* Ulasan */}
      <NavDropdown
        label="Ulasan"
        menuKey="reviews"
        openNavMenu={openNavMenu}
        setOpenNavMenu={setOpenNavMenu}
        menuClassName="is-wide"
      >
        <button
          type="button"
          role="menuitem"
          className="premium-more-item"
          onClick={() => {
            setOpenNavMenu(null);
            openReviewsPage();
          }}
        >
          <span className="premium-more-item-copy">
            <span>Semua Ulasan</span>
            <small>Pengalaman pelanggan Morgen Geschäft</small>
          </span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          role="menuitem"
          className="premium-more-item"
          onClick={() => openCatalogCategory("semua")}
        >
          <span className="premium-more-item-copy">
            <span>Ulasan Produk</span>
            <small>Buka produk untuk melihat ulasan detail</small>
          </span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          role="menuitem"
          className="premium-more-item"
          onClick={openReviewFormFromNav}
        >
          <span className="premium-more-item-copy">
            <span>Tulis Ulasan</span>
            <small>Bagikan pengalaman menggunakan produk</small>
          </span>
          <Star size={14} aria-hidden="true" />
        </button>
      </NavDropdown>

      {/* Artikel */}
      <NavDropdown
        label="Artikel"
        menuKey="articles"
        openNavMenu={openNavMenu}
        setOpenNavMenu={setOpenNavMenu}
        menuClassName="is-article"
      >
        <button
          type="button"
          role="menuitem"
          className="premium-more-item"
          onClick={() => openBlogCategory("semua")}
        >
          <span>Semua Artikel</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
        {BLOG_CATEGORY_OPTIONS.map((category) => (
          <button
            key={category.value}
            type="button"
            role="menuitem"
            className="premium-more-item"
            onClick={() => openBlogCategory(category.value)}
          >
            <span>{category.label}</span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        ))}
        {latestNavPost && (
          <>
            <div className="premium-more-divider" />
            <p className="premium-more-eyebrow">Terbaru</p>
            <button
              type="button"
              role="menuitem"
              className="premium-more-item"
              onClick={() => openBlogPost(latestNavPost)}
            >
              <span className="premium-more-item-copy">
                <span>{latestNavPost.title}</span>
                <small>{latestNavPost.readTime || "Baca artikel terbaru"}</small>
              </span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </>
        )}
      </NavDropdown>

      {/* Tentang */}
      <button
        type="button"
        className="premium-nav-link"
        onClick={() => {
          setOpenNavMenu(null);
          scrollToSection("tentang");
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#173B5E",
          fontSize: "15px",
          fontWeight: 500,
          letterSpacing: "0.005em",
          fontFamily: "'Work Sans', sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        Tentang Kami
      </button>

      {/* Lainnya */}
      <NavDropdown
        label="Lainnya"
        menuKey="more"
        openNavMenu={openNavMenu}
        setOpenNavMenu={setOpenNavMenu}
      >
        {[
          { label: "Lacak Pesanan", target: "lacak" },
          { label: "FAQ", target: "faq" },
          { label: "Kontak", target: "kontak" },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="premium-more-item"
            onClick={() => {
              setOpenNavMenu(null);
              item.target === "faq" ? openFaqPage() : scrollToSection(item.target);
            }}
          >
            <span>{item.label}</span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        ))}
      </NavDropdown>
    </nav>
  );
}

function NavDropdown({
  label,
  menuKey,
  openNavMenu,
  setOpenNavMenu,
  menuClassName = "",
  children,
}) {
  const isOpen = openNavMenu === menuKey;
  return (
    <div className="premium-more-nav" onMouseEnter={() => setOpenNavMenu(menuKey)}>
      <button
        type="button"
        className="premium-nav-link premium-more-trigger"
        onClick={() => setOpenNavMenu((c) => (c === menuKey ? null : menuKey))}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#173B5E",
          fontSize: "15px",
          fontWeight: 500,
          letterSpacing: "0.005em",
          fontFamily: "'Work Sans', sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        <ChevronRight
          size={15}
          aria-hidden="true"
          style={{
            transform: isOpen ? "rotate(-90deg)" : "rotate(90deg)",
            transition: "transform .2s ease",
          }}
        />
      </button>
      {isOpen && (
        <div className={`premium-more-menu ${menuClassName}`} role="menu">
          {children}
        </div>
      )}
    </div>
  );
}
