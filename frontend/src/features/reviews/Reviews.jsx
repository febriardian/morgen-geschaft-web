import { useState, useEffect, useMemo } from "react";
import { Leaf, ChevronRight, Trash2, Check, Star, BadgeCheck, ThumbsUp, RotateCcw } from "lucide-react";
import { StandalonePageHero, StandaloneSectionHeader } from "../../components/shared/Transitions.jsx";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import { apiFetch, readJsonResponse } from "../../services/apiClient.js";
import { API_BASE } from "../../config/constants.js";



// ---------- Testimoni ----------

function StarRating({ value, onChange }) {
  const { t } = useLocale();
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: "flex", gap: "4px" }} aria-label={t(`${value || 0} dari 5 bintang`, `${value || 0} out of 5 stars`)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange && onChange(star)}
          onMouseEnter={() => onChange && setHovered(star)}
          onMouseLeave={() => onChange && setHovered(0)}
          aria-label={onChange ? t(`Beri ${star} bintang`, `Give ${star} stars`) : undefined}
          tabIndex={onChange ? 0 : -1}
          style={{ background: "none", border: "none", cursor: onChange ? "pointer" : "default", padding: "0" }}
        >
          <Star
            size={18}
            fill={(hovered || value) >= star ? "#C97B5E" : "none"}
            color={(hovered || value) >= star ? "#C97B5E" : "#C9C2AD"}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

function reviewTimestamp(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function reviewDateLabel(value, locale) {
  const timestamp = reviewTimestamp(value);
  if (!timestamp) return locale === "en" ? "Date unavailable" : "Tanggal tidak tersedia";
  return new Date(timestamp).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function reviewerInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.length ? parts.map((part) => part[0]?.toUpperCase()).join("") : "?";
}

function reviewPhoto(item) {
  const raw = item.photoUrl || item.photoDataUrl || item.photo || item.image || item.reviewImage || "";
  if (raw.startsWith("/uploads/") && API_BASE) return `${API_BASE}${raw}`;
  return raw;
}

function TestimoniSection({
  products,
  isAdmin,
  pageMode = false,
  onViewAll,
  openFormOnMount = false,
}) {
  const { locale, t } = useLocale();
  const [testimoni, setTestimoni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(openFormOnMount);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ratingFilter, setRatingFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [sortFilter, setSortFilter] = useState("newest");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ nama: "", produk: "", rating: 5, komentar: "" });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [helpfulReviews, setHelpfulReviews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mg_helpful_reviews") || "[]");
    } catch {
      return [];
    }
  });
  const [helpfulCounts, setHelpfulCounts] = useState({});
  const PER_PAGE = 6;

  useEffect(() => {
    if (openFormOnMount) setShowForm(true);
  }, [openFormOnMount]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  useEffect(() => {
    const openReviewForm = () => {
      setShowForm(true);
      window.requestAnimationFrame(() => {
        document.getElementById("testimoni")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    };

    window.addEventListener("mg:open-review-form", openReviewForm);
    return () => window.removeEventListener("mg:open-review-form", openReviewForm);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await apiFetch("/api/testimoni", {}, { timeoutMs: 12000, expectJson: true });
        const data = await readJsonResponse(response);
        if (!response.ok) throw new Error(data.error || "Gagal memuat ulasan.");
        if (!cancelled) {
          setTestimoni(Array.isArray(data.reviews) ? data.reviews : []);
        }
      } catch (error) {
        console.error("Gagal memuat testimoni:", error);
        if (!cancelled) setTestimoni([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const refresh = (event) => {
      const type = event?.detail?.type;
      if (!type || type === "reviews") load();
    };

    load();
    window.addEventListener("mg:public-content-updated", refresh);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener("mg:public-content-updated", refresh);
      window.removeEventListener("focus", load);
    };
  }, []);

  useEffect(() => {
    setHelpfulCounts((current) => {
      const next = { ...current };
      testimoni.forEach((item) => {
        if (next[item.id] === undefined) next[item.id] = Number(item.helpfulCount || 0);
      });
      return next;
    });
  }, [testimoni]);

  useEffect(() => {
    setPage(1);
  }, [ratingFilter, productFilter, sortFilter]);

  const submit = async () => {
    if (!form.nama.trim() || !form.komentar.trim()) return;
    if (form.komentar.trim().length < 10) {
      alert(t("Ulasan terlalu pendek — tulis minimal 10 karakter ya.", "The review is too short—please write at least 10 characters."));
      return;
    }

    setSubmitting(true);
    try {
      let uploadedPhotoUrl = "";
      if (photoFile) {
        const uploadBody = new FormData();
        uploadBody.append("image", photoFile);
        const uploadResponse = await apiFetch(
          "/api/testimoni/photo",
          { method: "POST", body: uploadBody },
          { timeoutMs: 30000, expectJson: true }
        );
        const uploadData = await readJsonResponse(uploadResponse);
        if (!uploadResponse.ok) {
          alert(uploadData.error || t("Gagal mengunggah foto ulasan.", "Failed to upload the review photo."));
          setSubmitting(false);
          return;
        }
        uploadedPhotoUrl = uploadData.url || "";
      }

      const response = await apiFetch(
        "/api/testimoni",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nama: form.nama.trim(),
            produk: form.produk,
            rating: form.rating,
            komentar: form.komentar.trim(),
            photoUrl: uploadedPhotoUrl,
            status: "pending",
          }),
        },
        { timeoutMs: 20000, expectJson: true }
      );
      const data = await readJsonResponse(response);
      if (!response.ok) {
        alert(data.error || t("Gagal mengirim ulasan.", "Failed to submit the review."));
        setSubmitting(false);
        return;
      }

      setForm({ nama: "", produk: "", rating: 5, komentar: "" });
      setPhotoFile(null);
      setShowForm(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
    } catch {
      alert(t("Gagal mengirim ulasan. Periksa koneksi internet.", "Failed to submit the review. Check your internet connection."));
    } finally {
      setSubmitting(false);
    }
  };

  const hapus = async (id) => {
    if (!window.confirm(t("Hapus testimoni ini?", "Delete this testimonial?"))) return;
    const [{ deleteDoc, doc }, { db }] = await Promise.all([
      import("firebase/firestore"),
      import("../../services/firebase.js"),
    ]);
    await deleteDoc(doc(db, "testimoni", id));
    setTestimoni((previous) => previous.filter((item) => item.id !== id));
  };

  const toggleHelpful = async (id) => {
    const alreadyHelpful = helpfulReviews.includes(id);
    const nextHelpful = alreadyHelpful
      ? helpfulReviews.filter((reviewId) => reviewId !== id)
      : [...helpfulReviews, id];
    const previousCount = Number(helpfulCounts[id] || 0);
    const optimisticCount = Math.max(0, previousCount + (alreadyHelpful ? -1 : 1));

    setHelpfulReviews(nextHelpful);
    setHelpfulCounts((current) => ({
      ...current,
      [id]: optimisticCount,
    }));

    try {
      localStorage.setItem("mg_helpful_reviews", JSON.stringify(nextHelpful));
    } catch {}

    try {
      const response = await apiFetch(
        `/api/testimoni/${encodeURIComponent(id)}/helpful`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ helpful: !alreadyHelpful }),
        },
        { timeoutMs: 12000, expectJson: true }
      );
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan respons.");
      setHelpfulCounts((current) => ({ ...current, [id]: Number(data.helpfulCount ?? optimisticCount) }));
    } catch {
      setHelpfulReviews(helpfulReviews);
      setHelpfulCounts((current) => ({ ...current, [id]: previousCount }));
      try {
        localStorage.setItem("mg_helpful_reviews", JSON.stringify(helpfulReviews));
      } catch {}
    }
  };

  const avgRating = testimoni.length
    ? (testimoni.reduce((sum, item) => sum + (item.rating || 5), 0) / testimoni.length).toFixed(1)
    : null;

  const filteredReviews = useMemo(() => {
    if (!pageMode) return testimoni;

    const next = testimoni.filter((item) => {
      const ratingMatches = ratingFilter === "all" || Number(item.rating || 5) === Number(ratingFilter);
      const productMatches = productFilter === "all" || item.produk === productFilter;
      return ratingMatches && productMatches;
    });

    next.sort((a, b) => {
      if (sortFilter === "rating-desc") return Number(b.rating || 5) - Number(a.rating || 5) || reviewTimestamp(b.createdAt) - reviewTimestamp(a.createdAt);
      if (sortFilter === "rating-asc") return Number(a.rating || 5) - Number(b.rating || 5) || reviewTimestamp(b.createdAt) - reviewTimestamp(a.createdAt);
      return reviewTimestamp(b.createdAt) - reviewTimestamp(a.createdAt);
    });

    return next;
  }, [pageMode, testimoni, ratingFilter, productFilter, sortFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PER_PAGE));
  const displayedReviews = pageMode
    ? filteredReviews.slice((page - 1) * PER_PAGE, page * PER_PAGE)
    : filteredReviews.slice(0, 3);
  const reviewFiltersActive = pageMode && (ratingFilter !== "all" || productFilter !== "all" || sortFilter !== "newest");

  const resetReviewFilters = () => {
    setRatingFilter("all");
    setProductFilter("all");
    setSortFilter("newest");
  };

  return (
    <section id="testimoni" className="review-section" style={{ borderBottom: "1px solid #E3DCC9", background: "#F6F1E7" }}>
      {pageMode && (
        <StandalonePageHero
          eyebrow={t("ULASAN", "REVIEWS")}
          title={t("Cerita nyata dari pelanggan kami.", "Real stories from our customers.")}
          description={t("Lihat pengalaman pelanggan setelah menggunakan produk Morgen Geschäft, filter berdasarkan rating atau produk, lalu bagikan pengalamanmu sendiri.", "Read customer experiences with Morgen Geschäft products, filter them by rating or product, and share your own experience.")}
        />
      )}

      <div className={pageMode ? "standalone-content-shell" : undefined} style={{ maxWidth: "1280px", margin: "0 auto", padding: pageMode ? undefined : "42px 32px" }}>
        {pageMode ? (
          <StandaloneSectionHeader
            title={t("Pengalaman pelanggan", "Customer experiences")}
            meta={t(`${filteredReviews.length} ulasan`, `${filteredReviews.length} reviews`)}
            supporting={avgRating ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <StarRating value={Math.round(Number(avgRating))} />
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558" }}>
                  {t(`${avgRating} / 5 dari ${testimoni.length} ulasan`, `${avgRating} / 5 from ${testimoni.length} reviews`)}
                </span>
              </div>
            ) : null}
            actions={(
              <button
                type="button"
                onClick={() => setShowForm((current) => !current)}
                className="review-primary-button"
                style={{ background: showForm ? "#fff" : "#1F2E22", color: showForm ? "#162B45" : "#F6F1E7", border: "1.5px solid #1F2E22", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, padding: "9px 20px", cursor: "pointer", borderRadius: "9px" }}
              >
                {showForm ? t("Batal", "Cancel") : t("+ Tulis ulasan", "+ Write a Review")}
              </button>
            )}
          />
        ) : (
          <div className="review-heading-animated" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#F59A1A", letterSpacing: "0.08em", marginBottom: "4px" }}>
                {t("TESTIMONI", "TESTIMONIALS")}
              </p>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "28px", color: "#162B45", marginBottom: "6px" }}>
                {t("Kata mereka yang sudah coba", "What customers are saying")}
              </h2>
              {avgRating && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <StarRating value={Math.round(Number(avgRating))} />
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558" }}>
                    {t(`${avgRating} / 5 dari ${testimoni.length} ulasan`, `${avgRating} / 5 from ${testimoni.length} reviews`)}
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap" }}>
              {testimoni.length > 3 && (
                <button
                  type="button"
                  onClick={onViewAll}
                  className="review-secondary-button"
                  style={{ background: "#fff", color: "#162B45", border: "1px solid #E3DCC9", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, padding: "9px 15px", cursor: "pointer", borderRadius: "9px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                >
                  {t("Lihat semua ulasan", "View All Reviews")}
                  <ChevronRight size={15} />
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowForm((current) => !current)}
                className="review-primary-button"
                style={{ background: showForm ? "#fff" : "#1F2E22", color: showForm ? "#162B45" : "#F6F1E7", border: "1.5px solid #1F2E22", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, padding: "9px 20px", cursor: "pointer", borderRadius: "9px" }}
              >
                {showForm ? t("Batal", "Cancel") : t("+ Tulis ulasan", "+ Write a Review")}
              </button>
            </div>
          </div>
        )}

        {pageMode && (
          <div className="review-toolbar-wrap">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, .65fr) minmax(220px, 1fr) minmax(160px, .7fr)", gap: "10px", alignItems: "center" }} className="review-toolbar">
              <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} style={{ height: "42px", border: ratingFilter !== "all" ? "1.5px solid #4C6354" : "1px solid #E3DCC9", background: ratingFilter !== "all" ? "#FBFDF9" : "#fff", padding: "0 12px", color: "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", cursor: "pointer" }}>
                <option value="all">{t("Semua rating", "All ratings")}</option>
                <option value="5">{t("5 bintang", "5 stars")}</option>
                <option value="4">{t("4 bintang", "4 stars")}</option>
                <option value="3">{t("3 bintang", "3 stars")}</option>
                <option value="2">{t("2 bintang", "2 stars")}</option>
                <option value="1">{t("1 bintang", "1 star")}</option>
              </select>

              <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} style={{ height: "42px", border: productFilter !== "all" ? "1.5px solid #4C6354" : "1px solid #E3DCC9", background: productFilter !== "all" ? "#FBFDF9" : "#fff", padding: "0 12px", color: "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", cursor: "pointer" }}>
                <option value="all">{t("Semua produk", "All products")}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.name}>{product.name}</option>
                ))}
              </select>

              <select value={sortFilter} onChange={(event) => setSortFilter(event.target.value)} style={{ height: "42px", border: sortFilter !== "newest" ? "1.5px solid #4C6354" : "1px solid #E3DCC9", background: sortFilter !== "newest" ? "#FBFDF9" : "#fff", padding: "0 12px", color: "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", cursor: "pointer" }}>
                <option value="newest">{t("Terbaru", "Latest")}</option>
                <option value="rating-desc">{t("Rating tertinggi", "Highest rating")}</option>
                <option value="rating-asc">{t("Rating terendah", "Lowest rating")}</option>
              </select>

            </div>

            {reviewFiltersActive && (
              <button type="button" onClick={resetReviewFilters} style={{ border: "none", background: "transparent", color: "#C26F52", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer", padding: "8px 0 0", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <RotateCcw size={13} /> {t("Reset filter ulasan", "Reset review filters")}
              </button>
            )}
          </div>
        )}

        {showForm && (
          <div className="review-form-animated" style={{ background: "#FFFDF8", border: "1px solid #E3DCC9", padding: "24px", marginBottom: "30px", maxWidth: "620px", borderRadius: "12px" }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", color: "#162B45", marginBottom: "16px" }}>{t("Tulis ulasanmu", "Write your review")}</h3>
            <input value={form.nama} onChange={(event) => setForm({ ...form, nama: event.target.value })} placeholder={t("Nama kamu", "Your name")} style={{ width: "100%", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", border: "1px solid #E3DCC9", padding: "10px 12px", marginBottom: "10px", outline: "none", background: "#fff" }} />
            <select value={form.produk} onChange={(event) => setForm({ ...form, produk: event.target.value })} style={{ width: "100%", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", border: "1px solid #E3DCC9", padding: "10px 12px", marginBottom: "10px", outline: "none", background: "#fff", cursor: "pointer" }}>
              <option value="">{t("Pilih produk (opsional)", "Select a product (optional)")}</option>
              {products.map((product) => <option key={product.id} value={product.name}>{product.name}</option>)}
            </select>
            <div style={{ marginBottom: "10px" }}>
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", marginBottom: "6px" }}>{t("Rating", "Rating")}</p>
              <StarRating value={form.rating} onChange={(rating) => setForm({ ...form, rating })} />
            </div>
            <textarea value={form.komentar} onChange={(event) => setForm({ ...form, komentar: event.target.value })} placeholder={t("Ceritakan pengalamanmu pakai produk ini...", "Tell us about your experience with this product...")} rows={4} style={{ width: "100%", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", border: "1px solid #E3DCC9", padding: "10px 12px", marginBottom: "14px", outline: "none", background: "#fff", resize: "vertical" }} />

            <div style={{ marginBottom: "14px" }}>
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", marginBottom: "7px" }}>{t("Foto produk (opsional, maks. 2MB)", "Product photo (optional, max. 2 MB)")}</p>
              <label className="review-photo-upload" style={{ display: "inline-flex", alignItems: "center", gap: "7px", border: "1px dashed #C9C2AD", background: "#fff", borderRadius: "9px", padding: "9px 12px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#4C6354", fontWeight: 600, cursor: "pointer" }}>
                {t("Pilih foto", "Choose photo")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                      alert(t("Format foto harus JPG, PNG, atau WebP.", "The photo must be JPG, PNG, or WebP."));
                      event.target.value = "";
                      return;
                    }
                    if (file.size > 2 * 1024 * 1024) {
                      alert(t("Ukuran foto maksimal 2MB.", "The maximum photo size is 2 MB."));
                      event.target.value = "";
                      return;
                    }
                    setPhotoFile(file);
                  }}
                />
              </label>
              {photoPreview && (
                <div style={{ marginTop: "10px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <img src={photoPreview} alt={t("Preview foto ulasan", "Review photo preview")} loading="lazy" style={{ width: "92px", height: "92px", objectFit: "cover", borderRadius: "9px", border: "1px solid #E3DCC9" }} />
                  <div>
                    <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#6B6558", maxWidth: "260px", wordBreak: "break-word" }}>{photoFile?.name}</p>
                    <button type="button" onClick={() => setPhotoFile(null)} style={{ marginTop: "7px", border: "none", background: "transparent", color: "#C26F52", fontFamily: "'Work Sans', sans-serif", fontSize: "11px", fontWeight: 600, cursor: "pointer", padding: 0 }}>{t("Hapus foto", "Remove photo")}</button>
                  </div>
                </div>
              )}
            </div>
            <button type="button" onClick={submit} disabled={submitting || !form.nama.trim() || !form.komentar.trim()} style={{ background: submitting ? "#4C6354" : "#1F2E22", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, padding: "10px 24px", border: "none", borderRadius: "9px", cursor: submitting ? "not-allowed" : "pointer", opacity: (!form.nama.trim() || !form.komentar.trim()) ? 0.5 : 1 }}>
              {submitting ? (photoFile ? t("Mengunggah & mengirim...", "Uploading & submitting...") : t("Mengirim...", "Submitting...")) : t("Kirim ulasan", "Submit review")}
            </button>
          </div>
        )}

        {submitted && (
          <div className="review-success-animated" style={{ display: "flex", alignItems: "center", gap: "10px", background: "#DCE6D6", border: "1px solid #A8C5A0", padding: "12px 16px", borderRadius: "10px", marginBottom: "24px", maxWidth: "460px" }}>
            <Check size={16} color="#1F2E22" />
            <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#1F2E22" }}>
              {t("Ulasan berhasil dikirim dan akan tampil setelah diperiksa admin. Terima kasih 🌿", "Your review was submitted and will appear after it is checked by an administrator. Thank you 🌿")}
            </span>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#A39E8E", fontFamily: "'Work Sans', sans-serif", fontSize: "13px" }}>{t("Memuat ulasan...", "Loading reviews...")}</div>
        ) : filteredReviews.length === 0 ? (
          <div className="review-empty-animated" style={{ textAlign: "center", padding: "48px 0" }}>
            <Leaf size={32} color="#C9C2AD" strokeWidth={1.2} style={{ marginBottom: "12px" }} />
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", color: "#7B766A", marginBottom: "6px" }}>{t("Belum ada ulasan", "No reviews yet")}</p>
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#A39E8E", marginBottom: reviewFiltersActive ? "14px" : 0 }}>{t("Belum ada ulasan yang sesuai dengan filter ini.", "No reviews match these filters.")}</p>
            {reviewFiltersActive && (
              <button type="button" onClick={resetReviewFilters} style={{ border: "1px solid #1F2E22", background: "#1F2E22", color: "#F6F1E7", borderRadius: "9px", padding: "9px 16px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <RotateCcw size={13} /> {t("Tampilkan semua ulasan", "Show all reviews")}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="testimoni-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" }}>
              {displayedReviews.map((item, index) => {
                const photo = reviewPhoto(item);
                const verified = Boolean(item.verifiedPurchase || item.verified || item.orderId);
                const helpful = helpfulReviews.includes(item.id);

                return (
                  <article
                    key={`${item.id}-${page}-${ratingFilter}-${productFilter}-${sortFilter}`}
                    className="review-card-animated"
                    style={{ "--review-delay": `${Math.min(index, 8) * 70}ms`, background: "#fff", border: "1px solid #E3DCC9", padding: "20px", position: "relative", borderRadius: "12px", display: "flex", flexDirection: "column", minHeight: "100%" }}
                  >
                    {isAdmin && (
                      <button type="button" onClick={() => hapus(item.id)} style={{ position: "absolute", top: "12px", right: "12px", background: "none", border: "none", cursor: "pointer", opacity: 0.5, zIndex: 2 }} title={t("Hapus testimoni", "Delete testimonial")}>
                        <Trash2 size={13} color="#C97B5E" />
                      </button>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", paddingRight: isAdmin ? "22px" : 0 }}>
                      <StarRating value={item.rating || 5} />
                      {item.featured && (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#F59A1A", letterSpacing: ".06em", whiteSpace: "nowrap" }}>{t("PILIHAN", "FEATURED")}</span>
                      )}
                    </div>

                    {photo && (
                      <div className="review-photo" style={{ marginTop: "14px", height: "150px", overflow: "hidden", borderRadius: "10px", background: "#F3EFE6", border: "1px solid #E8E1D5" }}>
                        <img src={photo} alt={t(`Foto ulasan dari ${item.nama || "pelanggan"}`, `Review photo from ${item.nama || "customer"}`)} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .45s cubic-bezier(.2,.72,.2,1)" }} />
                      </div>
                    )}

                    <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "14px", color: "#162B45", lineHeight: 1.65, margin: "12px 0 16px", flex: 1 }}>
                      “{item.komentar}”
                    </p>

                    <div style={{ borderTop: "1px solid #E3DCC9", paddingTop: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className={`review-avatar${verified ? " is-verified" : ""}`} aria-hidden="true">
                          <span className="review-avatar-initials">{reviewerInitials(item.nama)}</span>
                          {verified && (
                            <span className="review-avatar-badge">
                              <BadgeCheck size={12} strokeWidth={2.25} />
                            </span>
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, color: "#162B45" }}>{item.nama}</p>
                            {verified && (
                              <span title={t("Pembelian terverifikasi", "Verified purchase")} style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "10px", fontWeight: 600 }}>
                                <BadgeCheck size={13} color="#F59A1A" /> {t("Terverifikasi", "Verified")}
                              </span>
                            )}
                          </div>
                          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#A39E8E", marginTop: "2px" }}>{reviewDateLabel(item.createdAt, locale)}</p>
                        </div>
                      </div>

                      {item.produk && (
                        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#162B45", marginTop: "10px", letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.produk}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleHelpful(item.id)}
                        aria-pressed={helpful}
                        className="review-helpful-button"
                        style={{ marginTop: "12px", border: helpful ? "1px solid #162B45" : "1px solid #E3DCC9", background: helpful ? "#EEF1F4" : "#FFFDF8", color: helpful ? "#162B45" : "#6B6558", borderRadius: "8px", padding: "7px 10px", display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "'Work Sans', sans-serif", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                      >
                        <ThumbsUp size={13} fill={helpful ? "currentColor" : "none"} />
                        {t("Membantu", "Helpful")}{Number(helpfulCounts[item.id] || 0) > 0 ? ` (${helpfulCounts[item.id]})` : ""}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {pageMode && totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "30px" }}>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button key={pageNumber} type="button" onClick={() => { setPage(pageNumber); document.getElementById("testimoni")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} style={{ width: 38, height: 38, border: "1px solid #E3DCC9", borderRadius: "9px", background: pageNumber === page ? "#1F2E22" : "#fff", color: pageNumber === page ? "#F6F1E7" : "#162B45", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                    {pageNumber}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export { StarRating, TestimoniSection };
