import { useState, useMemo, useEffect } from "react";
import { collection, deleteDoc, doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../services/firebase.js";
import { assertAdminAccess } from "../../services/firebaseAuth.js";
import { adminDate, adminDateLabel } from "../../utils/general.js";
import { AdminPagination } from "./adminShared.jsx";


export function AdminReviewsTab() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const REVIEW_PAGE_SIZE = 8;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "testimoni"), (snap) => {
      const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      rows.sort((a, b) => (adminDate(b.createdAt)?.getTime() || 0) - (adminDate(a.createdAt)?.getTime() || 0));
      setReviews(rows);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const reviewStatus = (review) => review.status || "published";

  const updateReview = async (review, updates) => {
    try {
      const firebaseUser = await assertAdminAccess();
      await setDoc(doc(db, "testimoni", review.id), {
        ...updates,
        moderatedAt: new Date().toISOString(),
        moderatedBy: firebaseUser.email || "admin",
      }, { merge: true });
      window.dispatchEvent(new CustomEvent("mg:public-content-updated", { detail: { type: "reviews" } }));
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteReview = async (review) => {
    const confirmation = window.prompt(`Hapus ulasan dari ${review.nama || "pengguna"}? Ketik HAPUS untuk melanjutkan.`);
    if (confirmation !== "HAPUS") return;
    try {
      await assertAdminAccess();
      await deleteDoc(doc(db, "testimoni", review.id));
      window.dispatchEvent(new CustomEvent("mg:public-content-updated", { detail: { type: "reviews" } }));
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = useMemo(() => reviews.filter((review) => {
    const matchesStatus = statusFilter === "all" || reviewStatus(review) === statusFilter;
    const matchesRating = ratingFilter === "all" || Number(review.rating || 0) === Number(ratingFilter);
    const haystack = `${review.nama || ""} ${review.produk || ""} ${review.komentar || ""}`.toLowerCase();
    const matchesSearch = !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase());
    return matchesStatus && matchesRating && matchesSearch;
  }), [reviews, statusFilter, ratingFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / REVIEW_PAGE_SIZE));
  const pagedReviews = filtered.slice((page - 1) * REVIEW_PAGE_SIZE, page * REVIEW_PAGE_SIZE);
  useEffect(() => { setPage(1); }, [statusFilter, ratingFilter, searchQuery]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  if (loading) return <p className="admin-muted">Memuat ulasan...</p>;

  return (
    <div>
      <div className="admin-review-toolbar">
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari nama, produk, atau isi ulasan..." />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Semua status</option>
          <option value="pending">Menunggu</option>
          <option value="published">Ditampilkan</option>
          <option value="hidden">Disembunyikan</option>
        </select>
        <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)}>
          <option value="all">Semua rating</option>
          {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} bintang</option>)}
        </select>
        <span>{filtered.length} ulasan</span>
      </div>

      <div className="admin-review-list">
        {pagedReviews.length === 0 ? <p className="admin-muted">Tidak ada ulasan pada filter ini.</p> : pagedReviews.map((review) => (
          <article key={review.id} className="admin-review-card">
            <div className="admin-review-head">
              <div>
                <b>{review.nama || "Tanpa nama"}</b>
                <small>{review.produk || "Ulasan umum"} · {adminDateLabel(review.createdAt)}</small>
              </div>
              <span className={`admin-review-status ${reviewStatus(review)}`}>{reviewStatus(review)}</span>
            </div>
            <div className="admin-review-stars">{"★".repeat(Number(review.rating || 5))}{"☆".repeat(Math.max(0, 5 - Number(review.rating || 5)))}</div>
            <p>{review.komentar}</p>
            <div className="admin-review-actions">
              {reviewStatus(review) !== "published" && <button onClick={() => updateReview(review, { status: "published" })}>Tampilkan</button>}
              {reviewStatus(review) !== "hidden" && <button onClick={() => updateReview(review, { status: "hidden" })}>Sembunyikan</button>}
              <button className={review.featured ? "active" : ""} onClick={() => updateReview(review, { featured: !review.featured })}>{review.featured ? "Lepas pilihan" : "Jadikan pilihan"}</button>
              <button className={review.verifiedPurchase ? "active" : ""} onClick={() => updateReview(review, { verifiedPurchase: !review.verifiedPurchase })}>{review.verifiedPurchase ? "Terverifikasi" : "Tandai terverifikasi"}</button>
              <button className="danger" onClick={() => deleteReview(review)}>Hapus</button>
            </div>
          </article>
        ))}
      </div>
      <AdminPagination page={page} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} label="ulasan" />
    </div>
  );
}



// ---------- Admin Push Notification Broadcast ----------
