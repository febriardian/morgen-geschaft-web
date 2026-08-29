import { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Leaf, ChevronRight, Check, Share2, FileText } from "lucide-react";
import { StandaloneStoreFooter } from "../../components/layout/StandaloneStoreFooter.jsx";
import { BlogDetailSkeleton, BlogGridSkeleton } from "../../components/shared/Skeletons.jsx";
import { PageRouteTransition, SimpleBackHeader, StandalonePageHero, StandaloneSectionHeader } from "../../components/shared/Transitions.jsx";
import { LanguageSwitcher } from "../../components/shared/LanguageSwitcher.jsx";
import { BLOG_CATEGORY_OPTIONS } from "../../config/constants.js";
import { BLOG_POSTS } from "../../config/seedData.js";
import { usePageMeta } from "../../hooks/usePageMeta.js";
import { usePageRouteTransition } from "../../hooks/usePageRouteTransition.js";
import { fetchPublicBlogs, sortBlogs } from "../../services/publicContent.js";
import { getBlogCategoryMeta, getBlogCategoryValue, getBlogCover, isBlogPublic, renderBlogContent } from "../../utils/blog.jsx";
import { toSlug } from "../../utils/general.js";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import { formatLocalizedDate, localizeRecord, localizedBlogCategoryLabel, parseLocalizedPath } from "../../i18n/locale.js";
import { BlogEditorialCard } from "./BlogEditorialCard.jsx";



// ---------- Halaman Semua Blog (URL /blog) ----------

export function BlogListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, route, t } = useLocale();
  const { routeTransition, navigateWithRouteTransition } = usePageRouteTransition(location, navigate);
  const [rawPosts, setRawPosts] = useState(BLOG_POSTS);
  const posts = useMemo(() => rawPosts.map((post) => localizeRecord(post, locale, "blog")), [rawPosts, locale]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PER_PAGE = 6;

  const returnPath = String(location.state?.from || route("home"));
  const returnScrollY = Number(location.state?.scrollY || 0);

  const listNavigationState = {
    from: returnPath.startsWith("/") ? returnPath : route("home"),
    scrollY: Number.isFinite(returnScrollY) && returnScrollY >= 0 ? returnScrollY : 0,
  };

  const changeBlogCategory = (categoryValue) => {
    const destination = categoryValue === "semua" ? route("blog") : route("blogCategory", { categoryId: categoryValue });
    if (destination === location.pathname) return;
    navigateWithRouteTransition(
      destination,
      { state: listNavigationState },
      "Menyiapkan artikel"
    );
  };

  const openBlogPostFromList = (post) => {
    navigateWithRouteTransition(
      route("blogDetail", { blogId: `${toSlug(post.title)}-${post.id}` }),
      {
        state: {
          fromList: `${location.pathname}${location.search}${location.hash}`,
          listScrollY: window.scrollY,
          returnFrom: listNavigationState.from,
          returnScrollY: listNavigationState.scrollY,
        },
      },
      "Membuka artikel"
    );
  };

  const handleBackFromBlogList = () => {
    // Daftar artikel adalah turunan dari section Artikel di beranda.
    // Saat kembali, arahkan tepat ke section tersebut, bukan ke posisi footer
    // yang mungkin tersimpan ketika tinggi halaman berubah.
    navigate(route("home"), {
      state: { restoreSection: "blog", returnTransition: "home" },
    });
  };

  useLayoutEffect(() => {
    const savedScrollY = Number(location.state?.restoreScrollY);
    const targetScrollY = Number.isFinite(savedScrollY) && savedScrollY >= 0 ? savedScrollY : 0;

    let secondFrame = null;
    const firstFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetScrollY, left: 0, behavior: "auto" });
      secondFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetScrollY, left: 0, behavior: "auto" });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [location.key, loading]);

  const routeInfo = parseLocalizedPath(location.pathname);
  const requestedCategory = routeInfo.key === "blogCategory" ? routeInfo.params.categoryId : "semua";
  const activeBlogCategory =
    requestedCategory === "semua" ||
    BLOG_CATEGORY_OPTIONS.some((item) => item.value === requestedCategory)
      ? requestedCategory
      : "semua";

  usePageMeta(
    locale === "en" ? "Articles" : "Artikel",
    locale === "en" ? "Skincare tips and guides from Morgen Geschäft." : "Tips & panduan skincare dari Morgen Geschäft",
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const posts = await fetchPublicBlogs();
        if (!cancelled && posts.length > 0) setRawPosts(posts);
      } catch {
        if (!cancelled) setRawPosts(sortBlogs(BLOG_POSTS));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeBlogCategory]);

  const filteredPosts =
    activeBlogCategory === "semua"
      ? posts
      : posts.filter((post) => getBlogCategoryValue(post) === activeBlogCategory);

  const totalPages = Math.ceil(filteredPosts.length / PER_PAGE);
  const paged = filteredPosts.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const activeCategoryLabel = activeBlogCategory === "semua"
    ? (locale === "en" ? "Latest articles" : "Artikel terbaru")
    : (localizedBlogCategoryLabel(activeBlogCategory, locale) || BLOG_CATEGORY_OPTIONS.find((category) => category.value === activeBlogCategory)?.label || (locale === "en" ? "Articles" : "Artikel"));

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif", background: "#F6F1E7", minHeight: "100vh" }}>
      <PageRouteTransition visible={routeTransition.visible} label={routeTransition.label} />
      {/* Header */}
      <SimpleBackHeader onBack={handleBackFromBlogList} />

      <StandalonePageHero
        eyebrow={t("ARTIKEL", "ARTICLES")}
        title={t("Tips dan panduan skincare.", "Skincare tips and guides.")}
        description={t(
          "Temukan informasi tentang bahan aktif, urutan pemakaian, dan rutinitas perawatan kulit yang lebih mudah dipahami.",
          "Find clear information about active ingredients, application order, and skincare routines that are easier to understand."
        )}
      />

      <div className="standalone-content-shell blog-list-content">
        <StandaloneSectionHeader
          title={activeCategoryLabel}
          meta={`${filteredPosts.length} artikel`}
        />

        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button
              type="button"
              onClick={() => changeBlogCategory("semua")}
              style={{
                border: "1px solid #E3DCC9",
                borderRadius: "9px",
                background: activeBlogCategory === "semua" ? "#1F2E22" : "#fff",
                color: activeBlogCategory === "semua" ? "#F6F1E7" : "#162B45",
                padding: "8px 13px",
                fontFamily: "'Work Sans', sans-serif",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Semua
            </button>

            {BLOG_CATEGORY_OPTIONS.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => changeBlogCategory(category.value)}
                style={{
                  border: "1px solid #E3DCC9",
                  borderRadius: "9px",
                  background: activeBlogCategory === category.value ? "#1F2E22" : "#fff",
                  color: activeBlogCategory === category.value ? "#F6F1E7" : "#162B45",
                  padding: "8px 13px",
                  fontFamily: "'Work Sans', sans-serif",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <BlogGridSkeleton count={6} />
        ) : (
          <>
            {filteredPosts.length === 0 ? (
              <div style={{ border: "1px solid #E3DCC9", borderRadius: "12px", background: "#fff", padding: "42px 24px", textAlign: "center" }}>
                <FileText size={30} color="#C9C2AD" strokeWidth={1.4} style={{ margin: "0 auto 10px" }} />
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", color: "#162B45", marginBottom: "5px" }}>Belum ada artikel di kategori ini</p>
                <p style={{ fontSize: "13px", color: "#A39E8E" }}>Pilih kategori lain untuk melihat artikel yang tersedia.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
                {paged.map((post, index) => (
                  <BlogEditorialCard
                    key={post.id}
                    post={post}
                    index={(page - 1) * PER_PAGE + index}
                    onClick={() => openBlogPostFromList(post)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "32px" }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    style={{
                      width: 36, height: 36, border: "1px solid #E3DCC9",
                      background: p === page ? "#1F2E22" : "#fff",
                      color: p === page ? "#F6F1E7" : "#162B45",
                      fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, cursor: "pointer", borderRadius: "9px",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

          </>
        )}
      </div>

      <StandaloneStoreFooter />
    </div>
  );
}



// ---------- Halaman Detail Blog (URL /blog/:blogId) ----------

export function BlogDetailPage() {
  const { blogId: blogSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, route } = useLocale();
  const { routeTransition, navigateWithRouteTransition } = usePageRouteTransition(location, navigate);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blogShared, setBlogShared] = useState(false);
  const [allBlogPosts, setAllBlogPosts] = useState([]);

  // Setiap artikel selalu dibuka dari bagian paling atas, termasuk ketika
  // berpindah dari artikel lain tanpa reload halaman. Jalankan dua frame agar
  // scroll restoration bawaan browser tidak mengembalikan posisi halaman lama.
  useLayoutEffect(() => {
    let secondFrame = null;
    const firstFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      secondFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [location.key, blogSlug]);

  // Ulangi setelah data artikel selesai dimuat karena tinggi skeleton dan
  // konten asli berbeda. Ini mencegah detail artikel terbuka di bagian bawah.
  useLayoutEffect(() => {
    if (loading || !post) return undefined;
    let secondFrame = null;
    const firstFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      secondFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [loading, post?.id]);

  // Dynamic SEO — must be called before any early return (Rules of Hooks)
  usePageMeta(
    post ? post.title : "Morgen Geschäft Blog",
    post ? post.excerpt : "",
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let allBlogs = [];
      try {
        allBlogs = await fetchPublicBlogs();
      } catch {
        allBlogs = [];
      }
      // Always merge seed as fallback (deduplicate by id)
      const ids = new Set(allBlogs.map((b) => b.id));
      for (const seed of BLOG_POSTS) {
        if (!ids.has(seed.id)) allBlogs.push(seed);
      }
      allBlogs = allBlogs.filter(isBlogPublic);
      const localizedBlogs = allBlogs.map((item) => localizeRecord(item, locale, "blog"));

      // Samakan urutan artikel dengan homepage dan halaman semua artikel:
      // artikel terbaru selalu mendapat nomor paling kecil (01, 02, 03, ...).
      localizedBlogs.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.date || b.createdAt || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return String(a.id || "").localeCompare(String(b.id || ""));
      });

      // Match strategies (most specific → least specific)
      let found = localizedBlogs.find((b) => b.id === blogSlug);
      if (!found) found = localizedBlogs.find((b) => `${toSlug(b.title)}-${b.id}` === blogSlug);
      if (!found) found = localizedBlogs.find((b) => blogSlug.endsWith(`-${b.id}`));
      // Fallback: match slug portion only (ignoring ID suffix)
      if (!found) found = localizedBlogs.find((b) => blogSlug.startsWith(toSlug(b.title)));

      if (!cancelled) {
        setAllBlogPosts(localizedBlogs);
        setPost(found || null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [blogSlug, locale]);

  const goBackToBlog = () => {
    const listPath = String(location.state?.fromList || route("blog"));
    const listScrollY = Number(location.state?.listScrollY || 0);
    const originPath = String(location.state?.returnFrom || location.state?.from || route("home"));
    const originScrollY = Number(location.state?.returnScrollY ?? location.state?.scrollY ?? 0);

    navigate(parseLocalizedPath(listPath.split(/[?#]/)[0]).key === "blog" || parseLocalizedPath(listPath.split(/[?#]/)[0]).key === "blogCategory" ? listPath : route("blog"), {
      state: {
        from: originPath.startsWith("/") ? originPath : route("home"),
        scrollY: Number.isFinite(originScrollY) && originScrollY >= 0 ? originScrollY : 0,
        restoreScrollY: Number.isFinite(listScrollY) && listScrollY >= 0 ? listScrollY : 0,
      },
    });
  };

  const openRelatedBlogPost = (item) => {
    navigateWithRouteTransition(
      route("blogDetail", { blogId: `${toSlug(item.title)}-${item.id}` }),
      { state: location.state },
      "Membuka artikel"
    );
  };

  const shareBlog = () => {
    const url = window.location.href;
    const text = `${post.title}\n${post.excerpt}\n\n${url}`;
    if (navigator.share) {
      navigator.share({ title: post.title, text: post.excerpt, url });
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      setBlogShared(true);
      setTimeout(() => setBlogShared(false), 2000);
    }
  };

  if (loading) {
    return (
      <>
        <PageRouteTransition visible={routeTransition.visible} label={routeTransition.label} />
        <BlogDetailSkeleton />
      </>
    );
  }

  if (!post) {
    return (
      <>
        <PageRouteTransition visible={routeTransition.visible} label={routeTransition.label} />
        <div style={{ fontFamily: "'Work Sans', sans-serif", background: "#F6F1E7", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
        <Leaf size={48} color="#C9C2AD" strokeWidth={1.2} style={{ marginBottom: "20px" }} />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "28px", color: "#162B45", marginBottom: "8px" }}>Artikel tidak ditemukan</h1>
        <p style={{ fontSize: "14px", color: "#6B6558", marginBottom: "24px" }}>Artikel yang kamu cari sudah dihapus atau tidak ada.</p>
        <button onClick={() => navigate(route("home"))} style={{ background: "#1F2E22", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: "14px", padding: "12px 28px", border: "none", cursor: "pointer" }}>
          Kembali ke Beranda
        </button>
        </div>
      </>
    );
  }

  const relatedPosts = post
    ? allBlogPosts
        .filter((item) => item.id !== post.id)
        .slice(0, 3)
    : [];

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif", background: "#F6F1E7", minHeight: "100vh" }}>
      <PageRouteTransition visible={routeTransition.visible} label={routeTransition.label} />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
      <style>{`
        .blog-related-card{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;appearance:none!important;-webkit-appearance:none!important;font-size:0!important;line-height:0!important;vertical-align:top!important}
        .blog-related-card > *{margin-top:0!important;margin-bottom:0}
        .blog-related-card:hover{transform:translateY(-4px);box-shadow:0 16px 36px rgba(22,43,69,.08);border-color:rgba(245,154,26,.45)!important}
        @media(max-width:760px){.blog-related-grid{grid-template-columns:1fr!important}}
      `}</style>
      <header style={{ borderBottom: "1px solid #E3DCC9", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#F6F1E7", zIndex: 40 }}>
        <button onClick={() => navigate(route("home"))} style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer" }}>
          <img src="/photos/logo-512.webp" alt="Logo" style={{ width: "28px", height: "28px" }} />
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", color: "#173B5E" }}>Morgen Geschäft</span>
        </button>
        <LanguageSwitcher />
      </header>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "42px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <button onClick={goBackToBlog} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: "#6B6558", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", padding: 0 }}>
            <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Semua artikel
          </button>
          <button onClick={shareBlog} aria-label="Bagikan artikel" style={{ background: blogShared ? "#DCE6D6" : "transparent", border: `1px solid ${blogShared ? "#A8C5A0" : "#E3DCC9"}`, padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#4C6354", fontWeight: 600 }}>
            {blogShared ? <Check size={14} /> : <Share2 size={14} />} {blogShared ? "Tersalin" : "Bagikan"}
          </button>
        </div>

        <article>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#4C6354", letterSpacing: "0.06em", marginBottom: "12px" }}>
            {formatLocalizedDate(post.date, locale)} · {post.readTime}
          </p>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(24px, 4vw, 36px)", color: "#162B45", lineHeight: 1.2, marginBottom: "22px" }}>
            {post.title}
          </h1>

          {(() => {
            const heroMeta = getBlogCategoryMeta(post);
            const heroIndex = Math.max(0, allBlogPosts.findIndex((item) => item.id === post.id));
            const heroMark = String(heroIndex + 1).padStart(2, "0");

            const coverImage = getBlogCover(post);
            return coverImage ? (
              <div className="blog-detail-visual" style={{ height: "300px", border: "1px solid #E3DCC9", marginBottom: "32px", overflow: "hidden", background: "#fff" }}>
                <img src={coverImage} alt={post.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div className="blog-detail-visual" style={{ height: "280px", border: "1px solid #E3DCC9", marginBottom: "32px", overflow: "hidden", background: heroMeta.bg, position: "relative", padding: "28px" }}>
                <div style={{ position: "absolute", inset: "auto -48px -70px auto", width: "220px", height: "220px", borderRadius: "50%", border: `34px solid ${heroMeta.ring}` }} />
                <div style={{ position: "absolute", top: "24px", right: "28px", fontFamily: "'Fraunces', serif", fontSize: "78px", lineHeight: 1, color: "rgba(22,43,69,.10)" }}>
                  {heroMark}
                </div>
                <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#173B5E", letterSpacing: ".12em" }}>{heroMeta.cardLabel}</p>
                  <div>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#F59A1A", letterSpacing: ".12em", marginBottom: "10px" }}>MORGEN JOURNAL</p>
                    <h2 className="blog-detail-visual-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px, 4vw, 42px)", color: "#162B45", lineHeight: 1.05, maxWidth: "560px" }}>{post.title}</h2>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ fontSize: "15px", color: "#162B45", lineHeight: 1.85 }}>
            {renderBlogContent(post.content)}
          </div>
          {post.tags && post.tags.length > 0 && (
            <div
              aria-label="Tag artikel"
              style={{ display: "flex", gap: "8px 12px", marginTop: "32px", flexWrap: "wrap", alignItems: "center" }}
            >
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    color: "#6B6558",
                    letterSpacing: ".04em",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </article>

        {relatedPosts.length > 0 && (
          <section style={{ marginTop: "48px", paddingTop: "34px", borderTop: "1px solid #E3DCC9" }}>
            <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: "18px", marginBottom: "18px" }}>
              <div>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#F59A1A", letterSpacing: ".12em", marginBottom: "7px" }}>BACA JUGA</p>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", color: "#162B45", lineHeight: 1.2 }}>Artikel lainnya</h2>
              </div>
              <button onClick={goBackToBlog} style={{ background: "transparent", border: "none", color: "#4C6354", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer", padding: 0 }}>
                Semua artikel →
              </button>
            </div>

            <div className="blog-related-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
              {relatedPosts.map((item, index) => {
                const visual = getBlogCategoryMeta(item);
                const itemPosition = Math.max(0, allBlogPosts.findIndex((postItem) => postItem.id === item.id));
                const relatedMark = String(itemPosition + 1).padStart(2, "0");

                return (
                  <button
                    key={item.id}
                    onClick={() => openRelatedBlogPost(item)}
                    className="blog-related-card"
                    style={{
                      background: "#fff",
                      border: "1px solid #E3DCC9",
                      borderRadius: "14px",
                      padding: 0,
                      margin: 0,
                      textAlign: "left",
                      cursor: "pointer",
                      overflow: "hidden",
                      transition: "transform .22s ease, box-shadow .22s ease, border-color .22s ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      justifyContent: "flex-start",
                      appearance: "none",
                      WebkitAppearance: "none",
                      fontSize: 0,
                      lineHeight: 0,
                    }}
                  >
                    {getBlogCover(item) ? (
                      <div style={{ width: "100%", height: "110px", flex: "0 0 110px", overflow: "hidden", background: "#F6F1E7", display: "block", margin: 0, padding: 0, lineHeight: 0 }}>
                        <img src={getBlogCover(item)} alt={item.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", margin: 0, padding: 0 }} />
                      </div>
                    ) : (
                      <div style={{ width: "100%", height: "110px", flex: "0 0 110px", background: visual.bg, position: "relative", overflow: "hidden", padding: "16px", margin: 0, display: "block", lineHeight: 1.2 }}>
                        <span style={{ position: "absolute", right: "16px", top: "12px", fontFamily: "'Fraunces', serif", fontSize: "42px", color: "rgba(22,43,69,.12)" }}>{relatedMark}</span>
                        <span style={{ position: "relative", zIndex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#173B5E", letterSpacing: ".1em" }}>{visual.cardLabel}</span>
                      </div>
                    )}
                    <div style={{ width: "100%", padding: "16px", margin: 0, display: "block", lineHeight: 1.4, fontSize: "initial" }}>
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#A39E8E", marginBottom: "8px" }}>{formatLocalizedDate(item.date, locale)} · {item.readTime}</p>
                      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "16px", color: "#162B45", lineHeight: 1.3, marginBottom: "8px" }}>{item.title}</h3>
                      <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#4C6354", fontWeight: 600 }}>Baca selengkapnya →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <StandaloneStoreFooter />
    </div>
  );
}
