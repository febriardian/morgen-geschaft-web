import React from "react";
import { BLOG_CATEGORY_OPTIONS } from "../config/constants.js";
import { adminDate } from "./general.js";



function getBlogCategoryValue(post = {}) {
  const raw = String(post.category || "").trim().toLowerCase();
  const direct = BLOG_CATEGORY_OPTIONS.find((item) => item.value === raw);
  if (direct) return direct.value;

  const aliases = {
    "panduan skincare": "panduan-skincare",
    "skincare guide": "panduan-skincare",
    tips: "panduan-skincare",
    "bahan aktif": "bahan-aktif",
    "active notes": "bahan-aktif",
    "perawatan harian": "perawatan-harian",
    "daily care": "perawatan-harian",
    "berita produk": "berita-produk",
  };
  if (aliases[raw]) return aliases[raw];

  // Artikel lama di Firestore belum punya kategori. Tebak sementara dari judul/tags,
  // lalu kategorinya akan tersimpan permanen ketika artikel diedit dari admin.
  const tagText = Array.isArray(post.tags) ? post.tags.join(" ") : String(post.tags || "");
  const haystack = `${post.title || ""} ${post.excerpt || ""} ${tagText}`.toLowerCase();
  if (/salicylic|niacinamide|retinol|aha|bha|vitamin c|bahan aktif|ingredient/.test(haystack)) return "bahan-aktif";
  if (/sunscreen|rutinitas|harian|daily|moisturizer|cleanser|skin barrier/.test(haystack)) return "perawatan-harian";
  if (/produk baru|launch|rilis|promo produk|brand/.test(haystack)) return "berita-produk";
  return "panduan-skincare";
}



function getBlogCategoryMeta(post) {
  const value = getBlogCategoryValue(post);
  return BLOG_CATEGORY_OPTIONS.find((item) => item.value === value) || BLOG_CATEGORY_OPTIONS[0];
}



function getBlogCover(post = {}) {
  return String(post.coverImage || post.image || "").trim();
}



function isBlogPublic(post = {}) {
  const status = post.status || "published";
  if (status !== "published") return false;
  const publishDate = adminDate(post.publishedAt);
  return !publishDate || publishDate.getTime() <= Date.now();
}



function blogAdminStatus(post = {}) {
  const status = post.status || "published";
  if (status === "draft") return "draft";
  const publishDate = adminDate(post.publishedAt);
  if (publishDate && publishDate.getTime() > Date.now()) return "scheduled";
  return "published";
}



function toDateTimeLocal(value) {
  const date = adminDate(value);
  if (!date) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}



// ---------- Blog Rich Text Renderer ----------
function renderBlogContent(content) {
  if (!content) return null;
  const paragraphs = content.split(/\n\n+/);
  return paragraphs.map((para, pi) => {
    const processInline = (text) => {
      const parts = [];
      const regex = /(\!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]*)\]\(([^)]+)\))|(\*\*(.+?)\*\*)|(\*(.+?)\*)/g;
      let lastIndex = 0;
      let match;
      let key = 0;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
        if (match[1]) {
          parts.push(<img key={key++} src={match[3]} alt={match[2]} loading="lazy" style={{ maxWidth: "100%", margin: "12px 0", border: "1px solid #E3DCC9" }} />);
        } else if (match[4]) {
          parts.push(<a key={key++} href={match[6]} target="_blank" rel="noreferrer" style={{ color: "#4C6354", textDecoration: "underline" }}>{match[5]}</a>);
        } else if (match[7]) {
          parts.push(<strong key={key++}>{match[8]}</strong>);
        } else if (match[9]) {
          parts.push(<em key={key++}>{match[10]}</em>);
        }
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) parts.push(text.slice(lastIndex));
      return parts.length > 0 ? parts : [text];
    };
    const trimmed = para.trim();
    if (trimmed.startsWith("### ")) return <h4 key={pi} style={{ fontFamily: "'Fraunces', serif", fontSize: "16px", color: "#162B45", margin: "24px 0 8px" }}>{processInline(trimmed.slice(4))}</h4>;
    if (trimmed.startsWith("## ")) return <h3 key={pi} style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", color: "#162B45", margin: "28px 0 10px" }}>{processInline(trimmed.slice(3))}</h3>;
    if (trimmed.startsWith("# ")) return <h2 key={pi} style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", color: "#162B45", margin: "32px 0 12px" }}>{processInline(trimmed.slice(2))}</h2>;
    const lines = para.split("\n");
    const bulletStart = lines.findIndex((line) => line.trim().startsWith("- "));

    if (bulletStart >= 0) {
      const introLines = lines.slice(0, bulletStart).filter((line) => line.trim());
      const bulletLines = lines.slice(bulletStart)
        .filter((line) => line.trim().startsWith("- "))
        .map((line) => line.trim().slice(2));

      return (
        <div key={pi} style={{ marginBottom: "20px" }}>
          {introLines.length > 0 && (
            <p style={{ marginBottom: "10px" }}>
              {introLines.map((line, index) => (
                <React.Fragment key={`${pi}-intro-${index}`}>
                  {index > 0 && <br />}
                  {processInline(line)}
                </React.Fragment>
              ))}
            </p>
          )}
          <ul style={{ margin: 0, paddingLeft: "22px", display: "grid", gap: "8px" }}>
            {bulletLines.map((line, index) => (
              <li key={`${pi}-bullet-${index}`} style={{ paddingLeft: "4px" }}>
                {processInline(line)}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <p key={pi} style={{ marginBottom: "16px" }}>
        {lines.map((line, li) => (
          <React.Fragment key={li}>
            {li > 0 && <br />}
            {processInline(line)}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

export { getBlogCategoryValue, getBlogCategoryMeta, getBlogCover, isBlogPublic, blogAdminStatus, toDateTimeLocal, renderBlogContent };

