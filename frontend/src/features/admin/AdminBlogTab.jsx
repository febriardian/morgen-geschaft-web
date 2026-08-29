import { useState, useMemo, useEffect } from "react";
import { Plus, Pencil, Trash2, ExternalLink, FileText } from "lucide-react";
import { collection, deleteDoc, doc, orderBy, query, setDoc, onSnapshot } from "firebase/firestore";
import { BLOG_CATEGORY_OPTIONS } from "../../config/constants.js";
import { addNotification, db } from "../../services/firebase.js";
import { assertAdminAccess } from "../../services/firebaseAuth.js";
import { blogAdminStatus, getBlogCategoryMeta, getBlogCategoryValue, getBlogCover, isBlogPublic, renderBlogContent, toDateTimeLocal } from "../../utils/blog.jsx";
import { adminDate, adminDateLabel, toSlug } from "../../utils/general.js";
import { AdminPagination, AdminImageUpload } from "./adminShared.jsx";


export function AdminBlogTab() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [previewPost, setPreviewPost] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const BLOG_ADMIN_PAGE_SIZE = 8;
  const blank = {
    id: "", title: "", excerpt: "", content: "",
    titleEn: "", excerptEn: "", contentEn: "", readTimeEn: "3 min read",
    date: new Date().toISOString().slice(0, 10), readTime: "3 menit",
    category: "panduan-skincare", tags: [], coverImage: "",
    status: "draft", publishedAt: "",
  };

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "blogs"), orderBy("date", "desc")),
      (snap) => { setPosts(snap.docs.map((d) => ({ ...d.data(), id: d.id }))); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => posts.filter((post) => {
    const haystack = `${post.title || ""} ${post.excerpt || ""} ${(post.tags || []).toString()}`.toLowerCase();
    const matchesSearch = !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase());
    const matchesCategory = categoryFilter === "all" || getBlogCategoryValue(post) === categoryFilter;
    const state = blogAdminStatus(post);
    const matchesStatus = statusFilter === "all" || state === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  }), [posts, searchQuery, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / BLOG_ADMIN_PAGE_SIZE));
  const pagedPosts = filtered.slice((page - 1) * BLOG_ADMIN_PAGE_SIZE, page * BLOG_ADMIN_PAGE_SIZE);
  useEffect(() => { setPage(1); }, [searchQuery, categoryFilter, statusFilter]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const save = async (post, forcedStatus = null) => {
    if (!post.title?.trim()) return alert("Judul artikel wajib diisi.");
    setSaving(true);
    try {
      const firebaseUser = await assertAdminAccess();
      const existing = posts.find((item) => item.id === post.id);
      const id = post.id || `blog-${Date.now()}`;
      const status = forcedStatus || post.status || (existing ? (existing.status || "published") : "draft");
      const now = new Date().toISOString();
      let publishedAt = null;
      if (status === "published") {
        const parsed = adminDate(post.publishedAt);
        publishedAt = parsed ? parsed.toISOString() : (existing?.publishedAt || now);
      }
      const payload = {
        ...post,
        id,
        title: post.title.trim(),
        excerpt: String(post.excerpt || "").trim(),
        content: String(post.content || "").trim(),
        titleEn: String(post.titleEn || "").trim(),
        excerptEn: String(post.excerptEn || "").trim(),
        contentEn: String(post.contentEn || "").trim(),
        readTimeEn: String(post.readTimeEn || "").trim(),
        category: getBlogCategoryValue(post),
        tags: typeof post.tags === "string" ? post.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : (post.tags || []),
        coverImage: String(post.coverImage || "").trim(),
        status,
        publishedAt,
        date: post.date || (publishedAt ? publishedAt.slice(0, 10) : now.slice(0, 10)),
        createdAt: existing?.createdAt || post.createdAt || now,
        updatedAt: now,
        updatedBy: firebaseUser.email || "admin",
      };
      await setDoc(doc(db, "blogs", id), payload, { merge: true });
      window.dispatchEvent(
        new CustomEvent("mg:public-content-updated", { detail: { type: "blogs" } })
      );

      const publishDate = adminDate(publishedAt);
      const becamePublic = status === "published" && (!publishDate || publishDate.getTime() <= Date.now()) && (!existing || !isBlogPublic(existing));
      if (becamePublic) {
        addNotification(
          "Artikel baru: " + payload.title,
          payload.excerpt || "Baca artikel terbaru dari Morgen Geschäft.",
          `/id/artikel/${toSlug(payload.title)}-${id}`,
          "artikel",
          {
            titleEn: `New article: ${payload.titleEn || payload.title}`,
            bodyEn: payload.excerptEn || "Read the latest article from Morgen Geschäft.",
            urlEn: `/en/articles/${toSlug(payload.titleEn || payload.title)}-${id}`,
          }
        );
      }
      setEditing(null);
    } catch (err) {
      alert(err.message || "Gagal menyimpan artikel.");
    } finally {
      setSaving(false);
    }
  };

  const setPostStatus = async (post, status) => {
    const message = status === "draft" ? `Sembunyikan artikel "${post.title}" menjadi draft?` : `Terbitkan artikel "${post.title}" sekarang?`;
    if (!window.confirm(message)) return;
    await save({ ...post, publishedAt: status === "published" ? new Date().toISOString() : null }, status);
  };

  const hapus = async (id) => {
    const post = posts.find((item) => item.id === id);
    const confirmation = window.prompt(`Hapus artikel "${post?.title || id}"? Ketik HAPUS untuk melanjutkan.`);
    if (confirmation !== "HAPUS") return;
    await assertAdminAccess();
    await deleteDoc(doc(db, "blogs", id));
    window.dispatchEvent(
      new CustomEvent("mg:public-content-updated", { detail: { type: "blogs" } })
    );
  };

  if (loading) return <p className="admin-muted">Memuat blog...</p>;

  return (
    <div>
      <div className="admin-section-actions">
        <button onClick={() => setEditing({ ...blank })} className="primary"><Plus size={14} /> Artikel Baru</button>
      </div>

      <div className="admin-data-toolbar">
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari judul, ringkasan, atau tag..." />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">Semua kategori</option>
          {BLOG_CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Semua status</option>
          <option value="draft">Draft</option>
          <option value="published">Terbit</option>
          <option value="scheduled">Terjadwal</option>
        </select>
      </div>

      <div className="admin-list-card">
        {pagedPosts.length === 0 && <p className="admin-muted" style={{ padding: "18px" }}>Tidak ada artikel yang sesuai filter.</p>}
        {pagedPosts.map((post) => {
          const state = blogAdminStatus(post);
          return (
            <div key={post.id} className="admin-generic-row admin-blog-row">
              <span>
                <b>{post.title}</b>
                <small>{getBlogCategoryMeta(post).label} · {post.date || "-"} · {post.readTime || "3 menit"}</small>
                <small className={`admin-blog-status ${state}`}>
                  {state === "draft" ? "Draft" : state === "scheduled" ? `Terjadwal ${adminDateLabel(post.publishedAt)}` : `Terbit ${adminDateLabel(post.publishedAt || post.date, false)}`}
                </small>
              </span>
              <span className="admin-row-buttons admin-blog-actions">
                <button type="button" className="admin-blog-action preview-action" onClick={() => setPreviewPost(post)} title="Preview artikel">
                  <ExternalLink size={12} /><span>Preview</span>
                </button>
                <button type="button" className="admin-blog-action icon-only" onClick={() => setEditing({ ...post, status: post.status || "published" })} title="Edit artikel" aria-label="Edit artikel">
                  <Pencil size={13} />
                </button>
                {state === "draft" ? (
                  <button type="button" className="admin-blog-action status-action" onClick={() => setPostStatus(post, "published")} title="Terbitkan artikel">
                    <FileText size={12} /><span>Terbitkan</span>
                  </button>
                ) : (
                  <button type="button" className="admin-blog-action status-action" onClick={() => setPostStatus(post, "draft")} title="Sembunyikan menjadi draft">
                    <FileText size={12} /><span>Jadikan draft</span>
                  </button>
                )}
                <button type="button" className="admin-blog-action icon-only danger" onClick={() => hapus(post.id)} title="Hapus artikel" aria-label="Hapus artikel">
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <AdminPagination page={page} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} label="artikel" />

      {editing && (
        <div className="admin-modal-backdrop" onClick={() => !saving && setEditing(null)}>
          <div className="admin-blog-editor-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-title-row">
              <div>
                <p>EDITOR ARTIKEL</p>
                <h3>{editing.id && posts.find((post) => post.id === editing.id) ? "Edit artikel" : "Artikel baru"}</h3>
              </div>
              <button onClick={() => setEditing(null)} aria-label="Tutup">×</button>
            </div>

            <input value={editing.title || ""} onChange={(event) => setEditing({ ...editing, title: event.target.value })} placeholder="Judul artikel" />
            <input value={editing.excerpt || ""} onChange={(event) => setEditing({ ...editing, excerpt: event.target.value })} placeholder="Ringkasan singkat" />

            <div className="admin-blog-editor-grid">
              <div>
                <label>Kategori artikel</label>
                <select value={getBlogCategoryValue(editing)} onChange={(event) => setEditing({ ...editing, category: event.target.value })}>
                  {BLOG_CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label>Status</label>
                <select value={editing.status || "draft"} onChange={(event) => setEditing({ ...editing, status: event.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Terbit / terjadwal</option>
                </select>
              </div>
            </div>

            <label>Cover artikel</label>
            <div className="admin-cover-field">
              <input value={editing.coverImage || ""} onChange={(event) => setEditing({ ...editing, coverImage: event.target.value })} placeholder="URL/path cover (opsional)" />
              <AdminImageUpload onUploaded={(url) => setEditing((current) => ({ ...current, coverImage: url }))} label="Upload cover" />
            </div>
            {editing.coverImage && <img className="admin-cover-preview" src={editing.coverImage} alt="Preview cover artikel" loading="lazy" />}

            <textarea value={editing.content || ""} onChange={(event) => setEditing({ ...editing, content: event.target.value })} placeholder="Isi artikel. Format: **bold**, *italic*, [teks](url), ![alt](url-gambar), # Heading, ## Sub-heading" rows={11} />

            <div style={{ margin: "16px 0 10px", padding: "14px", border: "1px solid #D7D0C2", borderRadius: "10px", background: "#FFFDF8" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: ".08em", color: "#4C6354", marginBottom: "10px" }}>VERSI ENGLISH</p>
              <input value={editing.titleEn || ""} onChange={(event) => setEditing({ ...editing, titleEn: event.target.value })} placeholder="English article title" />
              <input value={editing.excerptEn || ""} onChange={(event) => setEditing({ ...editing, excerptEn: event.target.value })} placeholder="Short English summary" />
              <textarea value={editing.contentEn || ""} onChange={(event) => setEditing({ ...editing, contentEn: event.target.value })} placeholder="English article content. The same formatting rules apply." rows={9} />
              <input value={editing.readTimeEn || ""} onChange={(event) => setEditing({ ...editing, readTimeEn: event.target.value })} placeholder="3 min read" />
              <small style={{ display: "block", color: "#8B8578", lineHeight: 1.5 }}>Jika kolom English kosong, halaman EN sementara memakai konten Indonesia sebagai fallback.</small>
            </div>

            <div className="admin-blog-editor-grid three">
              <div>
                <label>Tanggal artikel</label>
                <input value={editing.date || ""} onChange={(event) => setEditing({ ...editing, date: event.target.value })} type="date" />
              </div>
              <div>
                <label>Waktu baca</label>
                <input value={editing.readTime || ""} onChange={(event) => setEditing({ ...editing, readTime: event.target.value })} placeholder="3 menit" />
              </div>
              <div>
                <label>Waktu terbit</label>
                <input value={toDateTimeLocal(editing.publishedAt)} onChange={(event) => setEditing({ ...editing, publishedAt: event.target.value })} type="datetime-local" />
              </div>
            </div>

            <input value={Array.isArray(editing.tags) ? editing.tags.join(", ") : (editing.tags || "")} onChange={(event) => setEditing({ ...editing, tags: event.target.value })} placeholder="Tags (pisah koma, mis: skincare, pemula)" />

            <div className="admin-blog-editor-actions">
              <button className="secondary" onClick={() => setPreviewPost({ ...editing })}>Preview</button>
              <button className="secondary" disabled={saving} onClick={() => save(editing, "draft")}>{saving ? "Menyimpan..." : "Simpan Draft"}</button>
              <button className="primary" disabled={saving} onClick={() => save(editing, "published")}>{saving ? "Menyimpan..." : (adminDate(editing.publishedAt)?.getTime() > Date.now() ? "Jadwalkan" : "Terbitkan")}</button>
            </div>
          </div>
        </div>
      )}

      {previewPost && (
        <div className="admin-modal-backdrop admin-preview-backdrop" onClick={() => setPreviewPost(null)}>
          <article className="admin-blog-preview" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-title-row">
              <div><p>PREVIEW ARTIKEL</p><h3>Tampilan sebelum diterbitkan</h3></div>
              <button onClick={() => setPreviewPost(null)} aria-label="Tutup preview">×</button>
            </div>
            <p className="admin-blog-preview-meta">{getBlogCategoryMeta(previewPost).cardLabel} · {previewPost.date || "Tanpa tanggal"} · {previewPost.readTime || "3 menit"}</p>
            <h1>{previewPost.title || "Judul artikel"}</h1>
            {getBlogCover(previewPost) && <img src={getBlogCover(previewPost)} alt={previewPost.title || "Cover artikel"} loading="lazy" />}
            {previewPost.excerpt && <p className="admin-blog-preview-excerpt">{previewPost.excerpt}</p>}
            <div className="admin-blog-preview-content">{renderBlogContent(previewPost.content || "Isi artikel belum ditulis.")}</div>
          </article>
        </div>
      )}
    </div>
  );
}
