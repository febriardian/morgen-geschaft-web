import { useState, useMemo, useEffect } from "react";
import { collection, orderBy, query, onSnapshot } from "firebase/firestore";
import { API_BASE, ORDER_STATUS_LABEL } from "../../config/constants.js";
import { db } from "../../services/firebase.js";
import { assertAdminAccess } from "../../services/firebaseAuth.js";
import { adminDate, adminDateLabel, formatIDR } from "../../utils/general.js";
import { AdminPagination } from "./adminShared.jsx";


export function AdminOrdersTab({ preset = null }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [courierFilter, setCourierFilter] = useState("all");
  const [page, setPage] = useState(1);
  const ORDER_PAGE_SIZE = 10;

  useEffect(() => {
    if (!preset) return;

    const now = new Date();
    const localDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    setSearchQuery("");
    setPaymentFilter("all");
    setCourierFilter("all");
    setExpandedOrder(null);

    if (preset === "today") {
      setFilterStatus("all");
      setDateFrom(localDate);
      setDateTo(localDate);
    } else if (preset === "pending") {
      setFilterStatus("pending");
      setDateFrom("");
      setDateTo("");
    } else if (preset === "ready") {
      setFilterStatus("ready");
      setDateFrom("");
      setDateTo("");
    } else if (preset === "sales-today") {
      setFilterStatus("sales");
      setDateFrom(localDate);
      setDateTo(localDate);
    }
  }, [preset]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        setOrders(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Gagal memuat pesanan:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const updateOrder = async (order, updates) => {
    try {
      const firebaseUser = await assertAdminAccess();
      const token = await firebaseUser.getIdToken();
      const now = new Date().toISOString();
      const payload = { ...updates, updatedAt: now };

      if (updates.status && updates.status !== order.status) {
        payload.statusHistory = [
          ...(Array.isArray(order.statusHistory) ? order.statusHistory : []),
          {
            from: order.status || null,
            to: updates.status,
            at: now,
            by: firebaseUser.email || "admin",
          },
        ];
      }

      const res = await fetch(`${API_BASE}/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal memperbarui pesanan.");
      }
    } catch (err) {
      console.error("Gagal update pesanan:", err);
      alert("Gagal memperbarui pesanan: " + err.message);
    }
  };

  const printInvoice = async (order) => {
    const popup = window.open("", "_blank", "width=920,height=960");
    if (!popup) {
      alert("Popup diblokir browser. Izinkan popup untuk membuka invoice.");
      return;
    }

    popup.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Menyiapkan invoice...</title></head><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#F6F1E7;color:#162B45;font-family:Arial,sans-serif"><div style="text-align:center"><strong>Menyiapkan invoice PDF...</strong><p style="font-size:12px;color:#6B6558">Mohon tunggu sebentar.</p></div></body></html>`);
    popup.document.close();

    try {
      const firebaseUser = await assertAdminAccess();
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(order.id)}/invoice`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Gagal membuat invoice PDF.");
      }

      const pdfBlob = await response.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);
      popup.location.replace(pdfUrl);
      popup.focus();

      // Beri waktu PDF viewer memuat file sebelum URL lokal dilepas.
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 5 * 60 * 1000);
    } catch (error) {
      popup.close();
      console.error("Gagal membuka invoice PDF:", error);
      alert("Gagal membuka invoice PDF: " + error.message);
    }
  };

  const paymentOptions = useMemo(() => Array.from(new Set(orders.map((order) => String(order.paymentMethod || order.paymentType || order.channel || "").trim()).filter(Boolean))).sort(), [orders]);
  const courierOptions = useMemo(() => Array.from(new Set(orders.map((order) => String(order.shippingCourier || "").trim().toLowerCase()).filter(Boolean))).sort(), [orders]);

  const filtered = useMemo(() => orders.filter((order) => {
    const matchesStatus =
      filterStatus === "all"
        ? true
        : filterStatus === "ready"
        ? ["paid", "processing"].includes(order.status)
        : filterStatus === "sales"
        ? ["paid", "processing", "shipped", "delivered"].includes(order.status)
        : order.status === filterStatus;
    const haystack = `${order.id || ""} ${order.customerName || ""} ${order.customerPhone || ""} ${order.customerEmail || ""}`.toLowerCase();
    const matchesSearch = !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase());
    const orderDate = adminDate(order.createdAt);
    const matchesFrom = !dateFrom || (orderDate && orderDate >= new Date(`${dateFrom}T00:00:00`));
    const matchesTo = !dateTo || (orderDate && orderDate <= new Date(`${dateTo}T23:59:59`));
    const payment = String(order.paymentMethod || order.paymentType || order.channel || "").trim();
    const matchesPayment = paymentFilter === "all" || payment === paymentFilter;
    const courier = String(order.shippingCourier || "").trim().toLowerCase();
    const matchesCourier = courierFilter === "all" || courier === courierFilter;
    return matchesStatus && matchesSearch && matchesFrom && matchesTo && matchesPayment && matchesCourier;
  }), [orders, filterStatus, searchQuery, dateFrom, dateTo, paymentFilter, courierFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ORDER_PAGE_SIZE));
  const pagedOrders = filtered.slice((page - 1) * ORDER_PAGE_SIZE, page * ORDER_PAGE_SIZE);
  const specialStatusFilters = filterStatus === "ready"
    ? ["ready"]
    : filterStatus === "sales"
    ? ["sales"]
    : [];
  const statusFilters = ["all", ...specialStatusFilters, "pending", "expired", "paid", "processing", "shipped", "delivered", "failed", "cancelled"];

  useEffect(() => { setPage(1); }, [filterStatus, searchQuery, dateFrom, dateTo, paymentFilter, courierFilter]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const exportOrdersCsv = () => {
    const esc = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["ID", "Tanggal", "Nama", "Telepon", "Email", "Status", "Pembayaran", "Kurir", "Total"],
      ...filtered.map((order) => [
        order.id,
        adminDateLabel(order.createdAt),
        order.customerName || "",
        order.customerPhone || "",
        order.customerEmail || "",
        ORDER_STATUS_LABEL[order.status]?.label || order.status || "",
        order.paymentMethod || order.paymentType || order.channel || "",
        `${order.shippingCourier || ""} ${order.shippingService || ""}`.trim(),
        Number(order.amount || 0),
      ]),
    ];
    const csv = rows.map((row) => row.map(esc).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pesanan-morgen-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="admin-muted">Memuat pesanan...</p>;
  if (orders.length === 0) return <p className="admin-muted">Belum ada pesanan masuk lewat pembayaran website.</p>;

  return (
    <div>
      <div className="admin-filter-row">
        {statusFilters.map((status) => {
          const count =
            status === "all"
              ? orders.length
              : status === "ready"
              ? orders.filter((order) => ["paid", "processing"].includes(order.status)).length
              : status === "sales"
              ? orders.filter((order) => ["paid", "processing", "shipped", "delivered"].includes(order.status)).length
              : orders.filter((order) => order.status === status).length;
          if (count === 0 && status !== "all" && status !== filterStatus) return null;
          const label =
            status === "all"
              ? "Semua"
              : status === "ready"
              ? "Perlu diproses/dikirim"
              : status === "sales"
              ? "Transaksi dibayar"
              : (ORDER_STATUS_LABEL[status]?.label || status);
          return (
            <button key={status} className={filterStatus === status ? "active" : ""} onClick={() => setFilterStatus(status)}>
              {label} ({count})
            </button>
          );
        })}
      </div>

      <div className="admin-data-toolbar admin-order-toolbar">
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari ID, nama, telepon, atau email..." />
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} title="Tanggal mulai" />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} title="Tanggal akhir" />
        <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
          <option value="all">Semua pembayaran</option>
          {paymentOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={courierFilter} onChange={(event) => setCourierFilter(event.target.value)}>
          <option value="all">Semua kurir</option>
          {courierOptions.map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
        </select>
        <button className="secondary" onClick={exportOrdersCsv} disabled={filtered.length === 0}>Ekspor CSV</button>
      </div>

      <div className="admin-list-card">
        {pagedOrders.length === 0 && <p className="admin-muted" style={{ padding: "18px" }}>Tidak ada pesanan yang sesuai filter.</p>}
        {pagedOrders.map((order) => {
          const subtotal = (order.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
          const phoneDigits = String(order.customerPhone || "").replace(/\D/g, "").replace(/^0/, "62");
          return (
            <div key={order.id} className="admin-order-row">
              <button className="admin-order-summary" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                <span>
                  <b>{order.customerName || "Pelanggan"}</b>
                  <small>{order.id} · {order.customerPhone || "-"}</small>
                </span>
                <span className="admin-row-right">
                  <b>{formatIDR(Number(order.amount || 0))}</b>
                  <small>{adminDateLabel(order.createdAt)}</small>
                </span>
                <span className="admin-status-pill" style={{ background: ORDER_STATUS_LABEL[order.status]?.color || "#6B6558" }}>
                  {ORDER_STATUS_LABEL[order.status]?.label || order.status}
                </span>
              </button>

              {expandedOrder === order.id && (
                <div className="admin-order-detail">
                  <div className="admin-order-detail-grid">
                    <section>
                      <h4>Data pelanggan</h4>
                      <p><b>{order.customerName || "-"}</b></p>
                      <p>{order.customerPhone || "-"}</p>
                      <p>{order.customerEmail || "-"}</p>
                      <p>{order.address || "-"}</p>
                    </section>
                    <section>
                      <h4>Pembayaran & pengiriman</h4>
                      <p>Metode: <b>{order.paymentMethod || order.paymentType || order.channel || "-"}</b></p>
                      <p>Kurir: <b>{`${order.shippingCourier || "-"} ${order.shippingService || ""}`.trim()}</b></p>
                      <p>Ongkir: <b>{formatIDR(Number(order.shippingFee || 0))}</b></p>
                      <p>Resi: <b>{order.trackingNumber || "Belum diisi"}</b></p>
                    </section>
                  </div>

                  <div className="admin-order-items">
                    {(order.items || []).map((item, index) => (
                      <div key={`${item.name}-${index}`}><span>{item.name} ×{item.qty}</span><b>{formatIDR(Number(item.price || 0) * Number(item.qty || 0))}</b></div>
                    ))}
                    <div><span>Subtotal</span><b>{formatIDR(subtotal)}</b></div>
                    {Number(order.discount || 0) > 0 && <div className="discount"><span>Diskon {order.couponCode ? `(${order.couponCode})` : ""}</span><b>-{formatIDR(Number(order.discount || 0))}</b></div>}
                    <div><span>Ongkir</span><b>{formatIDR(Number(order.shippingFee || 0))}</b></div>
                    <div className="total"><span>Total</span><b>{formatIDR(Number(order.amount || 0))}</b></div>
                  </div>

                  <div className="admin-order-actions-top">
                    {phoneDigits && <a href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Halo ${order.customerName || ""}, kami dari Morgen Geschäft terkait pesanan ${order.id}.`)}`} target="_blank" rel="noreferrer">Hubungi WhatsApp</a>}
                    <button onClick={() => printInvoice(order)}>Cetak invoice</button>
                  </div>

                  <div className="admin-order-form-grid">
                    <div>
                      <label>No. resi</label>
                      <div className="admin-inline-field">
                        <input defaultValue={order.trackingNumber || ""} id={`resi-${order.id}`} placeholder="Masukkan nomor resi..." />
                        <button onClick={() => {
                          const value = document.getElementById(`resi-${order.id}`)?.value?.trim();
                          if (!value) return alert("Isi nomor resi dulu.");
                          if (window.confirm(`Simpan resi ${value} dan ubah status ke Dikirim?`)) updateOrder(order, { trackingNumber: value, status: "shipped" });
                        }}>Simpan</button>
                      </div>
                    </div>
                    <div>
                      <label>Catatan internal</label>
                      <input defaultValue={order.notes || ""} placeholder="Catatan admin..." onBlur={(event) => {
                        const value = event.target.value.trim();
                        if (value !== (order.notes || "")) updateOrder(order, { notes: value });
                      }} />
                    </div>
                  </div>

                  <div className="admin-status-actions">
                    {["paid", "processing", "shipped", "delivered", "cancelled"].map((status) => {
                      if (status === order.status) return null;
                      if (status === "paid" && order.status !== "pending") return null;
                      return (
                        <button key={status} style={{ borderColor: ORDER_STATUS_LABEL[status]?.color, color: ORDER_STATUS_LABEL[status]?.color }} onClick={() => {
                          if (window.confirm(`Ubah status ${order.id} menjadi ${ORDER_STATUS_LABEL[status]?.label || status}?`)) updateOrder(order, { status });
                        }}>{ORDER_STATUS_LABEL[status]?.label || status}</button>
                      );
                    })}
                  </div>

                  <div className="admin-history">
                    <h4>Riwayat status</h4>
                    {(Array.isArray(order.statusHistory) && order.statusHistory.length > 0) ? order.statusHistory.slice().reverse().map((item, index) => (
                      <div key={`${item.at}-${index}`}><span>{ORDER_STATUS_LABEL[item.from]?.label || item.from || "Pesanan dibuat"} → <b>{ORDER_STATUS_LABEL[item.to]?.label || item.to}</b></span><small>{adminDateLabel(item.at)} · {item.by || "admin"}</small></div>
                    )) : <p className="admin-muted">Belum ada riwayat perubahan status.</p>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <AdminPagination page={page} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} label="pesanan" />
    </div>
  );
}
