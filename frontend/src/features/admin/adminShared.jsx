import { useState } from "react";
import { API_BASE } from "../../config/constants.js";
import { auth } from "../../services/firebaseAuth.js";
import { formatIDR } from "../../utils/general.js";
import { adminCompactCurrency } from "./adminUtils.js";


export function AdminPagination({ page, totalPages, onChange, totalItems, label = "data" }) {
  const safeTotal = Math.max(1, Number(totalPages || 1));
  const current = Math.min(Math.max(1, Number(page || 1)), safeTotal);
  if (safeTotal <= 1) {
    return <p className="admin-pagination-summary">{totalItems} {label}</p>;
  }

  const start = Math.max(1, current - 2);
  const end = Math.min(safeTotal, start + 4);
  const pages = [];
  for (let value = Math.max(1, end - 4); value <= end; value += 1) pages.push(value);

  return (
    <div className="admin-pagination">
      <span>{totalItems} {label}</span>
      <div>
        <button disabled={current === 1} onClick={() => onChange(current - 1)}>←</button>
        {pages.map((value) => (
          <button key={value} className={value === current ? "active" : ""} onClick={() => onChange(value)}>{value}</button>
        ))}
        <button disabled={current === safeTotal} onClick={() => onChange(current + 1)}>→</button>
      </div>
    </div>
  );
}


export function AdminSalesChart({ series }) {
  const maxRevenue = Math.max(1, ...series.map((item) => item.revenue));
  const chartLeft = 58;
  const chartRight = 714;
  const chartTop = 18;
  const chartBottom = 194;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;
  const xStep = series.length > 1 ? chartWidth / (series.length - 1) : chartWidth;
  const points = series.map((item, index) => ({
    ...item,
    x: series.length > 1 ? chartLeft + index * xStep : chartLeft + chartWidth / 2,
    y: chartBottom - (item.revenue / maxRevenue) * chartHeight,
  }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x},${chartBottom} L${points[0].x},${chartBottom} Z`
    : "";
  const labelEvery = Math.max(1, Math.ceil(series.length / 6));
  const totalRevenue = series.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrders = series.reduce((sum, item) => sum + item.orders, 0);
  const hasData = totalRevenue > 0;

  return (
    <section className="admin-insight-card admin-sales-chart-card">
      <div className="admin-insight-head">
        <div>
          <p>TREN PENJUALAN</p>
          <h3>Pergerakan omzet</h3>
        </div>
        <div className="admin-chart-summary">
          <strong>{formatIDR(totalRevenue)}</strong>
          <small>{totalOrders} pesanan dibayar</small>
        </div>
      </div>

      <div className={`admin-sales-chart ${hasData ? "" : "is-empty"}`}>
        <svg viewBox="0 0 740 235" role="img" aria-label="Grafik tren penjualan">
          <defs>
            <linearGradient id="adminSalesArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59A1A" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#F59A1A" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((ratio) => {
            const y = chartTop + ratio * chartHeight;
            const value = maxRevenue * (1 - ratio);
            return (
              <g key={ratio}>
                <line x1={chartLeft} x2={chartRight} y1={y} y2={y} stroke="#E8E1D5" strokeDasharray="4 6" />
                <text x="4" y={y + 4} fill="#9A9487" fontSize="10">{adminCompactCurrency(value)}</text>
              </g>
            );
          })}
          {areaPath && <path d={areaPath} fill="url(#adminSalesArea)" />}
          {linePath && <path d={linePath} fill="none" stroke="#173B5E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
          {points.map((point, index) => (
            <g key={`${point.label}-${index}`}>
              <circle cx={point.x} cy={point.y} r="8" fill="#FFFDF8" opacity="0" className="admin-chart-hit" />
              <circle cx={point.x} cy={point.y} r="4" fill="#F59A1A" stroke="#FFFDF8" strokeWidth="2">
                <title>{point.label}: {formatIDR(point.revenue)} dari {point.orders} pesanan</title>
              </circle>
              {(index % labelEvery === 0 || index === points.length - 1) && (
                <text x={point.x} y="221" textAnchor="middle" fill="#817B70" fontSize="10">{point.label}</text>
              )}
            </g>
          ))}
        </svg>
        {!hasData && (
          <div className="admin-chart-empty">
            <b>Belum ada transaksi pada periode ini</b>
            <span>Grafik akan terisi setelah pembayaran berhasil.</span>
          </div>
        )}
      </div>
    </section>
  );
}


export function AdminStatusBars({ orders }) {
  const groups = [
    { label: "Menunggu pembayaran", count: orders.filter((order) => order.status === "pending").length, tone: "pending" },
    { label: "Sedang diproses", count: orders.filter((order) => ["paid", "processing"].includes(order.status)).length, tone: "processing" },
    { label: "Dikirim", count: orders.filter((order) => order.status === "shipped").length, tone: "shipped" },
    { label: "Selesai", count: orders.filter((order) => order.status === "delivered").length, tone: "delivered" },
    { label: "Dibatalkan", count: orders.filter((order) => ["cancelled", "expired", "failed"].includes(order.status)).length, tone: "cancelled" },
  ];
  const maxCount = Math.max(1, ...groups.map((item) => item.count));
  const total = groups.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="admin-insight-card admin-status-card">
      <div className="admin-insight-head">
        <div>
          <p>STATUS PESANAN</p>
          <h3>Alur operasional</h3>
        </div>
        <span className="admin-total-pill">{total} pesanan</span>
      </div>
      <div className="admin-status-bars">
        {groups.map((item) => (
          <div key={item.label} className="admin-status-row">
            <div><span>{item.label}</span><b>{item.count}</b></div>
            <div className="admin-status-track"><span className={item.tone} style={{ width: `${(item.count / maxCount) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      {total === 0 && <p className="admin-compact-empty">Belum ada pesanan pada periode ini.</p>}
    </section>
  );
}


export function AdminTopProducts({ rows, onNavigate }) {
  const maxQty = Math.max(1, ...rows.map((item) => item.qty));
  return (
    <section className="admin-insight-card admin-top-products-card">
      <div className="admin-insight-head">
        <div>
          <p>PRODUK TERLARIS</p>
          <h3>Pilihan pelanggan</h3>
        </div>
        <button onClick={() => onNavigate("produk")}>Kelola produk</button>
      </div>
      {rows.length === 0 ? (
        <p className="admin-compact-empty">Belum ada penjualan produk pada periode ini.</p>
      ) : (
        <div className="admin-top-products-list">
          {rows.map((item, index) => (
            <div key={item.key} className="admin-top-product-row">
              <span className="admin-product-rank">{String(index + 1).padStart(2, "0")}</span>
              <div className="admin-top-product-copy">
                <div><b>{item.name}</b><span>{item.qty} terjual · {formatIDR(item.revenue)}</span></div>
                <div className="admin-product-progress"><span style={{ width: `${(item.qty / maxQty) * 100}%` }} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


export function AdminImageUpload({ onUploaded, label = "Upload" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 2 * 1024 * 1024;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) { setError("Format harus JPG, PNG, atau WebP."); return; }
    if (file.size > maxSize) { setError("Ukuran maks 2MB."); return; }

    setError("");
    setUploading(true);
    try {
      const user = auth.currentUser;
      if (!user) { setError("Login admin dulu."); setUploading(false); return; }
      const token = await user.getIdToken();

      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal upload.");

      // Cloudinary mengembalikan URL absolut; fallback lokal tetap memakai /uploads.
      const fullUrl = /^https:\/\//i.test(data.url)
        ? data.url
        : API_BASE
          ? `${API_BASE}${data.url}`
          : data.url;
      onUploaded(fullUrl);
    } catch (err) {
      setError(err.message || "Gagal upload.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: "2px" }}>
      <label style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        background: uploading ? "#C9C2AD" : "#4C6354", color: "#F6F1E7",
        fontFamily: "'Work Sans', sans-serif", fontSize: "11px", fontWeight: 600,
        padding: "6px 10px", cursor: uploading ? "not-allowed" : "pointer",
        flexShrink: 0, whiteSpace: "nowrap",
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        {uploading ? "Uploading..." : label}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} disabled={uploading} style={{ display: "none" }} />
      </label>
      {error && <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#C97B5E" }}>{error}</span>}
    </div>
  );
}
