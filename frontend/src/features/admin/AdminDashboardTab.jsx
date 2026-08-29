import { useState, useMemo, useEffect, useCallback } from "react";
import { ShoppingBag, TrendingUp, Clock3, Truck, CalendarDays, Activity, RefreshCw } from "lucide-react";
import { collection, orderBy, query, onSnapshot } from "firebase/firestore";
import { API_BASE, CATEGORIES, ORDER_STATUS_LABEL } from "../../config/constants.js";
import { db } from "../../services/firebase.js";
import { auth } from "../../services/firebaseAuth.js";
import { adminDate, adminDateLabel, formatIDR } from "../../utils/general.js";
import { ADMIN_SETTLED_STATUSES, adminDashboardRange, adminDashboardDateLabel, adminTrend, buildAdminSalesSeries } from "./adminUtils.js";
import { AdminSalesChart, AdminStatusBars, AdminTopProducts } from "./adminShared.jsx";


export function AdminDashboardTab({ products, onNavigate }) {
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [stockRequests, setStockRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [systemHealthLoading, setSystemHealthLoading] = useState(false);
  const [systemHealthError, setSystemHealthError] = useState("");
  const [featureFlags, setFeatureFlags] = useState(null);
  const [featureFlagSaving, setFeatureFlagSaving] = useState("");

  const loadFeatureFlags = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/feature-flags`);
    const data = await response.json().catch(() => ({}));
    if (response.ok) setFeatureFlags(data.flags || {});
  }, []);

  const toggleFeatureFlag = async (key) => {
    if (!featureFlags || featureFlagSaving) return;
    setFeatureFlagSaving(key);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Sesi admin belum tersedia.");
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_BASE}/api/admin/feature-flags`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: !featureFlags[key] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Feature flag tidak dapat diubah.");
      setFeatureFlags(data.flags);
    } catch (error) {
      alert(error.message);
    } finally {
      setFeatureFlagSaving("");
    }
  };

  const loadSystemHealth = useCallback(async () => {
    setSystemHealthLoading(true);
    setSystemHealthError("");
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Sesi admin belum tersedia.");
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_BASE}/api/admin/health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!data || typeof data !== "object") throw new Error(`Respons health tidak valid (${response.status}).`);
      setSystemHealth(data);
      if (!response.ok) setSystemHealthError(`Status sistem: ${data.status || "degraded"}.`);
    } catch (error) {
      setSystemHealth(null);
      setSystemHealthError(error?.message || "Gagal memeriksa health sistem.");
    } finally {
      setSystemHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    let ordersReady = false;
    let reviewsReady = false;
    const finish = () => {
      if (ordersReady && reviewsReady) setLoading(false);
    };

    const unsubOrders = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        setOrders(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
        ordersReady = true;
        finish();
      },
      () => {
        ordersReady = true;
        finish();
      }
    );

    const unsubReviews = onSnapshot(
      collection(db, "testimoni"),
      (snap) => {
        setReviews(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
        reviewsReady = true;
        finish();
      },
      () => {
        reviewsReady = true;
        finish();
      }
    );

    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE}/api/stock-notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) setStockRequests(data.notifications || []);
      } catch {
        setStockRequests([]);
      }
    })();

    return () => {
      unsubOrders();
      unsubReviews();
    };
  }, []);

  useEffect(() => {
    loadSystemHealth();
    loadFeatureFlags();
  }, [loadSystemHealth, loadFeatureFlags]);

  const range = useMemo(() => adminDashboardRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const inRange = (order, start, end) => {
    const date = adminDate(order.createdAt);
    return Boolean(date && date >= start && date <= end);
  };
  const currentOrders = useMemo(
    () => orders.filter((order) => inRange(order, range.start, range.end)),
    [orders, range.start, range.end]
  );
  const previousOrders = useMemo(
    () => orders.filter((order) => inRange(order, range.previousStart, range.previousEnd)),
    [orders, range.previousStart, range.previousEnd]
  );
  const currentSettled = currentOrders.filter((order) => ADMIN_SETTLED_STATUSES.includes(order.status));
  const previousSettled = previousOrders.filter((order) => ADMIN_SETTLED_STATUSES.includes(order.status));
  const currentRevenue = currentSettled.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const previousRevenue = previousSettled.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const pendingOrders = currentOrders.filter((order) => order.status === "pending");
  const readyToShip = currentOrders.filter((order) => ["paid", "processing"].includes(order.status));
  const lowStock = products.filter((product) => !product.isArchived && Number(product.stock || 0) <= 3);
  const pendingReviews = reviews.filter((review) => review.status === "pending");
  const pendingStockRequests = stockRequests.filter((request) => !request.notified);
  const revenueTrend = adminTrend(currentRevenue, previousRevenue);
  const orderTrend = adminTrend(currentOrders.length, previousOrders.length);
  const series = useMemo(
    () => buildAdminSalesSeries(currentOrders, range.start, range.end, period),
    [currentOrders, range.start, range.end, period]
  );

  const topProducts = useMemo(() => {
    const aggregate = new Map();
    currentSettled.forEach((order) => {
      (Array.isArray(order.items) ? order.items : []).forEach((item) => {
        const key = item.id || item.productId || item.name;
        if (!key) return;
        const quantity = Math.max(1, Number(item.qty || item.quantity || 1));
        const price = Number(item.price || 0);
        const current = aggregate.get(key) || { key, name: item.name || "Produk", qty: 0, revenue: 0 };
        current.qty += quantity;
        current.revenue += price * quantity;
        aggregate.set(key, current);
      });
    });
    return [...aggregate.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 5);
  }, [currentSettled]);

  const healthLabels = {
    firestore: "Firestore",
    redis: "Redis",
    smtp: "Email SMTP",
    midtrans: "Midtrans",
    biteship: "Biteship",
    gemini: "GESA Gemini",
    sentry: "Sentry",
    cloudinary: "Cloudinary",
  };
  const healthEntries = Object.entries(systemHealth?.checks || {}).filter(([key]) => healthLabels[key]);
  const healthyStatuses = new Set(["ok", "ready", "configured", "sent"]);

  const periodLabel = period === "today"
    ? "Hari ini"
    : period === "custom" && customFrom && customTo
    ? `${adminDashboardDateLabel(range.start)} sampai ${adminDashboardDateLabel(range.end)}`
    : `${period} hari terakhir`;

  const cards = [
    {
      label: "Penjualan",
      value: formatIDR(currentRevenue),
      hint: revenueTrend.label,
      trend: revenueTrend.tone,
      icon: <TrendingUp size={17} />,
      tab: "pesanan",
    },
    {
      label: "Pesanan",
      value: currentOrders.length,
      hint: orderTrend.label,
      trend: orderTrend.tone,
      icon: <ShoppingBag size={17} />,
      tab: "pesanan",
    },
    {
      label: "Menunggu pembayaran",
      value: pendingOrders.length,
      hint: pendingOrders.length ? "Perlu dipantau" : "Tidak ada yang tertunda",
      trend: pendingOrders.length ? "attention" : "neutral",
      icon: <Clock3 size={17} />,
      tab: "pesanan",
      preset: "pending",
    },
    {
      label: "Perlu diproses atau dikirim",
      value: readyToShip.length,
      hint: readyToShip.length ? "Butuh tindakan operasional" : "Semua pesanan tertangani",
      trend: readyToShip.length ? "attention" : "neutral",
      icon: <Truck size={17} />,
      tab: "pesanan",
      preset: "ready",
    },
  ];

  if (loading) {
    return (
      <div className="admin-dashboard-loading" aria-label="Memuat ringkasan dashboard">
        {Array.from({ length: 4 }).map((_, index) => <span key={index} />)}
      </div>
    );
  }

  return (
    <div className="admin-dashboard-v2">
      <div className="admin-dashboard-toolbar">
        <div>
          <p>RINGKASAN KINERJA</p>
          <h2>Data toko yang perlu diperhatikan</h2>
          <span>{periodLabel}</span>
        </div>
        <div className="admin-period-controls">
          {[{ key: "today", label: "Hari ini" }, { key: "7", label: "7 hari" }, { key: "30", label: "30 hari" }, { key: "90", label: "90 hari" }].map((item) => (
            <button
              key={item.key}
              className={period === item.key ? "active" : ""}
              onClick={() => { setPeriod(item.key); setShowCustomRange(false); }}
            >
              {item.label}
            </button>
          ))}
          <button
            className={period === "custom" ? "active" : ""}
            onClick={() => setShowCustomRange((value) => !value)}
          >
            <CalendarDays size={13} /> Pilih tanggal
          </button>
        </div>
      </div>

      {showCustomRange && (
        <div className="admin-custom-range">
          <label>Dari<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
          <label>Sampai<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label>
          <button
            disabled={!customFrom || !customTo || customFrom > customTo}
            onClick={() => { setPeriod("custom"); setShowCustomRange(false); }}
          >
            Terapkan
          </button>
        </div>
      )}

      <div className="admin-dashboard-grid admin-dashboard-kpis">
        {cards.map((card) => (
          <button key={card.label} className="admin-dashboard-card admin-kpi-card" onClick={() => onNavigate(card.tab, card.preset || null)}>
            <span className="admin-kpi-icon">{card.icon}</span>
            <span className="admin-dashboard-label">{card.label}</span>
            <strong>{card.value}</strong>
            <small className={`admin-kpi-trend ${card.trend}`}>{card.hint}</small>
          </button>
        ))}
      </div>

      <div className="admin-operational-strip">
        <button onClick={() => onNavigate("produk")}>
          <span>Stok menipis</span><b>{lowStock.length}</b><small>Stok 3 atau kurang</small>
        </button>
        <button onClick={() => onNavigate("ulasan")}>
          <span>Ulasan menunggu</span><b>{pendingReviews.length}</b><small>{reviews.length} ulasan tersimpan</small>
        </button>
        <button onClick={() => onNavigate("stok-notify")}>
          <span>Permintaan stok</span><b>{pendingStockRequests.length}</b><small>Belum menerima notifikasi</small>
        </button>
      </div>

      <div className="admin-visual-grid">
        <AdminSalesChart series={series} />
        <AdminStatusBars orders={currentOrders} />
      </div>

      <div className="admin-dashboard-bottom-grid">
        <AdminTopProducts rows={topProducts} onNavigate={onNavigate} />

        <section className="admin-panel-card admin-latest-orders-card">
          <div className="admin-panel-card-head">
            <div><p>PESANAN TERBARU</p><h3>Aktivitas terbaru</h3></div>
            <button onClick={() => onNavigate("pesanan")}>Lihat semua</button>
          </div>
          {currentOrders.slice(0, 5).length === 0 ? (
            <p className="admin-compact-empty">Belum ada pesanan pada periode ini.</p>
          ) : currentOrders.slice(0, 5).map((order) => (
            <button key={order.id} className="admin-compact-row" onClick={() => onNavigate("pesanan")}>
              <span>
                <b>{order.customerName || "Pelanggan"}</b>
                <small>{order.id} · {adminDateLabel(order.createdAt)}</small>
              </span>
              <span className="admin-row-right">
                <b>{formatIDR(Number(order.amount || 0))}</b>
                <small>{ORDER_STATUS_LABEL[order.status]?.label || order.status || "-"}</small>
              </span>
            </button>
          ))}
        </section>

        <section className="admin-panel-card admin-low-stock-card">
          <div className="admin-panel-card-head">
            <div><p>STOK MENIPIS</p><h3>Perlu perhatian</h3></div>
            <button onClick={() => onNavigate("produk")}>Kelola</button>
          </div>
          {lowStock.length === 0 ? (
            <p className="admin-compact-empty">Semua stok masih aman.</p>
          ) : lowStock.slice(0, 5).map((product) => (
            <button key={product.id} className="admin-compact-row" onClick={() => onNavigate("produk")}>
              <span>
                <b>{product.name}</b>
                <small>{CATEGORIES.find((category) => category.id === product.category)?.label || "Produk"}</small>
              </span>
              <span className="admin-stock-pill">Stok {product.stock || 0}</span>
            </button>
          ))}
        </section>


        <section className="admin-panel-card admin-system-health-card" style={{ padding: "18px" }}>
          <div className="admin-panel-card-head">
            <div><p>KESEHATAN SISTEM</p><h3>Layanan production</h3></div>
            <button onClick={loadSystemHealth} disabled={systemHealthLoading} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <RefreshCw size={13} className={systemHealthLoading ? "is-spinning" : ""} />
              {systemHealthLoading ? "Memeriksa" : "Perbarui"}
            </button>
          </div>

          {systemHealthError && (
            <p style={{ margin: "0 0 10px", color: "#B8674C", fontSize: "10px", lineHeight: 1.5 }}>{systemHealthError}</p>
          )}

          {healthEntries.length === 0 ? (
            <p className="admin-compact-empty">{systemHealthLoading ? "Memeriksa layanan..." : "Data health belum tersedia."}</p>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {healthEntries.map(([key, status]) => {
                const isHealthy = healthyStatuses.has(String(status));
                const isOptional = ["sentry", "cloudinary"].includes(key) && status === "disabled";
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "9px 10px", border: "1px solid #E8E1D5", borderRadius: "9px", background: "#FFFDF8" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", color: "#162B45", fontSize: "10px", fontWeight: 600 }}>
                      <Activity size={13} /> {healthLabels[key]}
                    </span>
                    <b style={{ color: isHealthy ? "#173B5E" : isOptional ? "#8F897E" : "#B8674C", fontSize: "9px", textTransform: "uppercase", letterSpacing: ".05em" }}>
                      {String(status).replaceAll("_", " ")}
                    </b>
                  </div>
                );
              })}
            </div>
          )}

          {systemHealth?.time && (
            <small style={{ display: "block", marginTop: "10px", color: "#9A9487", fontSize: "9px" }}>
              Diperiksa {new Date(systemHealth.time).toLocaleString("id-ID")}
            </small>
          )}
        </section>

        <section className="admin-panel-card" style={{ padding: "18px" }}>
          <div className="admin-panel-card-head">
            <div><p>FEATURE FLAGS</p><h3>Rollback fitur tanpa deploy</h3></div>
          </div>
          <p style={{ color: "#6B6558", fontSize: 10, lineHeight: 1.55, marginBottom: 12 }}>Matikan fitur baru secara terpisah jika terjadi masalah. Perubahan berlaku paling lambat sekitar 30 detik.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries({ customerAccounts: "Akun pelanggan", loyalty: "Loyalty", referral: "Referral", heroExperiment: "A/B hero", returns: "Retur", flashSale: "Flash sale" }).map(([key, label]) => (
              <button key={key} type="button" disabled={!featureFlags || Boolean(featureFlagSaving)} onClick={() => toggleFeatureFlag(key)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 11px", border: "1px solid #E8E1D5", borderRadius: 9, background: "#FFFDF8", cursor: "pointer" }}>
                <span style={{ fontSize: 11, color: "#162B45", fontWeight: 600 }}>{label}</span>
                <b style={{ fontSize: 9, color: featureFlags?.[key] ? "#173B5E" : "#B8674C", letterSpacing: ".06em" }}>{featureFlagSaving === key ? "MENYIMPAN" : featureFlags?.[key] ? "AKTIF" : "NONAKTIF"}</b>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
