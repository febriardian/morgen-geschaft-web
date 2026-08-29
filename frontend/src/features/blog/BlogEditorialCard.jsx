// BlogEditorialCard — kartu artikel ringan yang dipakai di beranda (HomeContent)
// dan di daftar blog (Blog.jsx). Dipisah dari Blog.jsx agar beranda tidak ikut
// memuat BlogListPage/BlogDetailPage yang berat, sehingga code-splitting jalan.

import { useLocale } from "../../i18n/LocaleContext.jsx";
import { formatLocalizedDate, localizedBlogCategoryLabel } from "../../i18n/locale.js";
import { getBlogCategoryMeta, getBlogCategoryValue, getBlogCover } from "../../utils/blog.jsx";

export function BlogEditorialCard({ post, index = 0, onClick }) {
  const { locale } = useLocale();
  const meta = getBlogCategoryMeta(post);
  const mark = String(index + 1).padStart(2, "0");
  const coverImage = getBlogCover(post);

  return (
    <button
      type="button"
      className="premium-blog-card"
      onClick={onClick}
      aria-label={`Baca artikel ${post.title}`}
      style={{ background: "#fff", border: "1px solid #E3DCC9", padding: 0, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <div className="premium-blog-thumb" style={{ height: "142px", background: coverImage ? "#162B45" : meta.bg, borderBottom: "1px solid #E3DCC9", position: "relative", overflow: "hidden", padding: "18px" }}>
        {coverImage ? (
          <>
            <img src={coverImage} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(22,43,69,.18), rgba(22,43,69,.78))" }} />
          </>
        ) : (
          <div style={{ position: "absolute", inset: "auto -28px -42px auto", width: "150px", height: "150px", borderRadius: "50%", border: `24px solid ${meta.ring}` }} />
        )}
        <div style={{ position: "absolute", top: "18px", right: "18px", fontFamily: "'Fraunces', serif", fontSize: "42px", lineHeight: 1, color: coverImage ? "rgba(255,255,255,.20)" : "rgba(22,43,69,.10)" }}>
          {mark}
        </div>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: coverImage ? "#fff" : "#173B5E", letterSpacing: ".11em", marginBottom: "18px", position: "relative", zIndex: 1 }}>
          {localizedBlogCategoryLabel(getBlogCategoryValue(post), locale) || meta.cardLabel}
        </p>
        <h3 className="premium-blog-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", color: coverImage ? "#fff" : "#162B45", lineHeight: 1.12, maxWidth: "78%", position: "relative", zIndex: 1 }}>
          {post.title}
        </h3>
      </div>

      <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#A39E8E" }}>{formatLocalizedDate(post.date, locale) || (locale === "en" ? "No date" : "Tanpa tanggal")} · {post.readTime || (locale === "en" ? "3 min read" : "3 menit")}</p>
        <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", lineHeight: 1.6 }}>{post.excerpt || "Baca artikel lengkap untuk melihat pembahasannya."}</p>
        <span className="premium-blog-read" style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#162B45", fontWeight: 600, marginTop: "auto", display: "inline-flex" }}>Baca selengkapnya →</span>
      </div>
    </button>
  );
}
