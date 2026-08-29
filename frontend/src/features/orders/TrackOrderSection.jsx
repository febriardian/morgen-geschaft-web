import { useState, useMemo, useEffect, useCallback } from "react";
import { X, Leaf, Check } from "lucide-react";
import { API_BASE, ORDER_STATUS_LABEL, STORE_WHATSAPP } from "../../config/constants.js";
import { usePaymentCountdown } from "../../hooks/usePaymentCountdown.js";
import { adminDateLabel, copyTextWithFallback, formatIDR, resolveProductImage } from "../../utils/general.js";
import { clearPaymentSession, formatPaymentCountdown, getLocalOrderHistory, getOrderAccessToken, getPaymentSession, loadSavedCustomer } from "../../utils/paymentStorage.js";
import { openMidtransPayment } from "../../utils/midtrans.js";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import { localizedOrderStatus } from "../../i18n/locale.js";
import { ReturnRequestPanel } from "./ReturnRequestPanel.jsx";
import { customerAuthorizationHeader } from "../../services/customerAuth.js";



function TrackOrderSection({ products = [], onReorder, onBrowseCatalog }) {
  const { locale } = useLocale();
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState(() => loadSavedCustomer().phone || "");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [tracking, setTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const [paymentActionError, setPaymentActionError] = useState("");
  const [resumingPayment, setResumingPayment] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  const localPaymentSession = useMemo(
    () => (order?.id ? getPaymentSession(order.id) : null),
    [order?.id, order?.snapToken, order?.paymentExpiresAt]
  );
  const paymentToken = localPaymentSession?.token || order?.snapToken || "";
  const paymentRedirectUrl = localPaymentSession?.redirectUrl || order?.snapRedirectUrl || "";
  const paymentCancelToken = localPaymentSession?.cancelToken || "";
  const customerAccessToken = getOrderAccessToken(order?.id);
  const paymentExpiresAt = order?.paymentExpiresAt || localPaymentSession?.expiresAt || "";
  const paymentCountdown = usePaymentCountdown(paymentExpiresAt);
  const visibleOrderStatus = order?.status === "pending" && paymentCountdown.expired ? "expired" : order?.status;
  const visibleOrderStatusLabel =
    visibleOrderStatus === "cancelled" && (order?.cancelledBy === "customer" || order?.cancellationSource === "customer")
      ? (locale === "en" ? "Cancelled by customer" : "Dibatalkan oleh pelanggan")
      : (localizedOrderStatus(visibleOrderStatus, locale) || ORDER_STATUS_LABEL[visibleOrderStatus]?.label || visibleOrderStatus);

  const syncPaymentStatus = useCallback(async (targetOrderId) => {
    if (!targetOrderId) return null;
    try {
      const accountHeaders = await customerAuthorizationHeader().catch(() => ({}));
      const response = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(targetOrderId)}/payment-expire-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customerAccessToken ? { "X-Customer-Access-Token": customerAccessToken } : {}),
          ...accountHeaders,
        },
        body: JSON.stringify({ phone, customerAccessToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return null;

      const syncedStatus = data.status || null;
      if (["paid", "expired", "failed", "cancelled"].includes(syncedStatus)) {
        clearPaymentSession(targetOrderId);
        setOrder((current) => current && current.id === targetOrderId
          ? {
              ...current,
              status: syncedStatus,
              transactionStatus: data.transactionStatus || current.transactionStatus,
              paymentSessionStatus: syncedStatus,
              snapToken: null,
              snapRedirectUrl: null,
            }
          : current
        );
      } else if (syncedStatus === "pending" && data.paymentExpiresAt) {
        setOrder((current) => current && current.id === targetOrderId
          ? { ...current, paymentExpiresAt: data.paymentExpiresAt }
          : current
        );
      }
      return syncedStatus;
    } catch {
      return null;
    }
  }, [phone, customerAccessToken]);

  const fetchTracking = async (waybill, courier) => {
    setTrackingLoading(true);
    setTrackingError("");
    setTracking(null);
    try {
      const res = await fetch(`${API_BASE}/api/shipping/track?waybill=${encodeURIComponent(waybill)}&courier=${encodeURIComponent(courier)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTracking(data);
    } catch (err) {
      setTrackingError(err.message || "Gagal mengambil data tracking.");
    } finally {
      setTrackingLoading(false);
    }
  };

  useEffect(() => {
    setHistory(getLocalOrderHistory());
  }, []);

  // Auto-lookup pesanan terakhir saat pertama kali muncul
  useEffect(() => {
    const h = getLocalOrderHistory();
    if (h.length > 0 && !order && !orderId) {
      lookupOrder(h[0]);
    }
  }, []); // eslint-disable-line

  const lookupOrder = async (id) => {
    const targetId = (id || orderId).trim();
    if (!targetId || !phone.trim()) {
      setError("Masukkan ID pesanan dan nomor WhatsApp yang digunakan saat checkout.");
      return;
    }
    setLoading(true);
    setError("");
    setPaymentActionError("");
    setOrder(null);
    setTracking(null);
    setTrackingError("");
    try {
      const accountHeaders = await customerAuthorizationHeader().catch(() => ({}));
      const response = await fetch(`${API_BASE}/api/orders/lookup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getOrderAccessToken(targetId) ? { "X-Customer-Access-Token": getOrderAccessToken(targetId) } : {}),
          ...accountHeaders,
        },
        body: JSON.stringify({ orderId: targetId, phone, customerAccessToken: getOrderAccessToken(targetId) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.order) {
        throw new Error(data.error || "Pesanan tidak ditemukan. Periksa ID dan nomor WhatsApp.");
      }
      setOrder(data.order);
    } catch {
      setError("Gagal mengambil data pesanan. Coba lagi sebentar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleTrackOrderRequest = (event) => {
      const requestedId = String(event?.detail?.orderId || "").trim();
      if (!requestedId) return;
      setHistory(getLocalOrderHistory());
      setOrderId(requestedId);
      lookupOrder(requestedId);
    };

    window.addEventListener("mg:track-order", handleTrackOrderRequest);
    return () => window.removeEventListener("mg:track-order", handleTrackOrderRequest);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!order?.id || order.status !== "pending") return undefined;

    let cancelled = false;
    const checkStatus = async () => {
      const syncedStatus = await syncPaymentStatus(order.id);
      if (cancelled || !syncedStatus) return;
      if (["paid", "expired", "failed", "cancelled"].includes(syncedStatus)) {
        setPaymentActionError("");
      }
    };

    // Cek langsung dan lanjutkan polling. Ini tetap bekerja walaupun order lama
    // belum mempunyai paymentExpiresAt, karena status diambil dari Midtrans.
    checkStatus();
    const timer = window.setInterval(checkStatus, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [order?.id, order?.status, syncPaymentStatus]);

  const resumePayment = async () => {
    setPaymentActionError("");
    if (!order?.id || visibleOrderStatus !== "pending") return;

    setResumingPayment(true);
    const syncedStatus = await syncPaymentStatus(order.id);
    if (["paid", "expired", "failed", "cancelled"].includes(syncedStatus)) {
      setResumingPayment(false);
      if (syncedStatus === "expired") {
        setPaymentActionError("");
      }
      return;
    }

    if (paymentCountdown.expired) {
      setResumingPayment(false);
      await syncPaymentStatus(order.id);
      setPaymentActionError("Waktu pembayaran sudah berakhir. Silakan buat pesanan baru.");
      return;
    }
    if (!paymentToken && !paymentRedirectUrl) {
      setResumingPayment(false);
      setPaymentActionError("Sesi pembayaran tidak ditemukan pada perangkat ini.");
      return;
    }

    try {
      await openMidtransPayment({
        token: paymentToken,
        redirectUrl: paymentRedirectUrl,
        callbacks: {
      onSuccess: () => {
        clearPaymentSession(order.id);
        setResumingPayment(false);
        window.setTimeout(() => {
          syncPaymentStatus(order.id).then(() => lookupOrder(order.id));
        }, 900);
      },
      onPending: () => {
        setResumingPayment(false);
        window.setTimeout(() => syncPaymentStatus(order.id), 600);
      },
      onError: () => {
        setResumingPayment(false);
        window.setTimeout(async () => {
          const status = await syncPaymentStatus(order.id);
          if (status === "expired") {
            setPaymentActionError("");
          } else {
            setPaymentActionError("Pembayaran belum berhasil. Kamu masih dapat mencoba lagi selama waktunya tersedia.");
          }
        }, 350);
      },
          onClose: () => {
            setResumingPayment(false);
            window.setTimeout(() => syncPaymentStatus(order.id), 500);
          },
        },
      });
    } catch (error) {
      setResumingPayment(false);
      setPaymentActionError(error?.message || "Pembayaran tidak dapat dibuka.");
    }
  };

  const timelineSteps = ["Pesanan dibuat", "Pembayaran", "Diproses", "Dikirim"];

  const getTimelineState = (index) => {
    const status = visibleOrderStatus;

    if (["expired", "failed", "cancelled"].includes(status)) {
      if (index === 0) return "done";
      if (index === 1) return "error";
      return "upcoming";
    }

    const progressByStatus = {
      pending: 1,
      paid: 2,
      processing: 2,
      shipped: 3,
      delivered: 4,
    };
    const progress = progressByStatus[status] ?? 0;

    if (index < progress) return "done";
    if (index === progress && progress < timelineSteps.length) return "active";
    return "upcoming";
  };

  const getProductImage = (item) => {
    const latest = products.find((product) => product.id === item.id);
    const source =
      latest?.image ||
      latest?.images?.[0] ||
      item.image ||
      item.images?.[0] ||
      "";

    return resolveProductImage(source);
  };

  const repeatCurrentOrder = () => {
    if (!order?.items?.length || typeof onReorder !== "function") return;
    onReorder(order.items);
  };

  const browseCatalog = () => {
    if (typeof onBrowseCatalog === "function") onBrowseCatalog();
    else document.getElementById("katalog")?.scrollIntoView({ behavior: "smooth" });
  };

  const copyTrackedOrderId = async () => {
    if (!order?.id) return;
    const success = await copyTextWithFallback(order.id);
    if (!success) {
      setPaymentActionError("ID pesanan tidak dapat disalin otomatis. Silakan blok dan salin secara manual.");
      return;
    }
    setCopiedOrderId(true);
    window.setTimeout(() => setCopiedOrderId(false), 1800);
  };

  const cancelPendingOrder = async () => {
    if (!order?.id || visibleOrderStatus !== "pending" || cancellingOrder) return;
    if (!paymentCancelToken) {
      setShowCancelConfirm(false);
      setPaymentActionError("Pembatalan hanya dapat dilakukan dari perangkat yang digunakan saat checkout.");
      return;
    }

    setCancellingOrder(true);
    setPaymentActionError("");
    try {
      const response = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(order.id)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelToken: paymentCancelToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Pesanan tidak dapat dibatalkan.");

      clearPaymentSession(order.id);
      setOrder((current) => current && current.id === order.id
        ? {
            ...current,
            status: "cancelled",
            paymentSessionStatus: "cancelled",
            transactionStatus: data.transactionStatus || "cancel",
            cancellationSource: "customer",
            cancelledBy: "customer",
            cancelledAt: data.cancelledAt || new Date().toISOString(),
            snapToken: null,
            snapRedirectUrl: null,
          }
        : current
      );
      setShowCancelConfirm(false);
    } catch (error) {
      setShowCancelConfirm(false);
      setPaymentActionError(error.message || "Pesanan tidak dapat dibatalkan.");
      window.setTimeout(() => lookupOrder(order.id), 500);
    } finally {
      setCancellingOrder(false);
    }
  };

  const contactAdminUrl = order?.id
    ? `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(`Halo Morgen Geschäft, saya ingin meminta bantuan terkait pesanan ${order.id}.`)}`
    : `https://wa.me/${STORE_WHATSAPP}`;

  return (
    <section id="lacak" style={{ borderBottom: "1px solid #E3DCC9", background: "#F6F1E7" }}>
      <style>{`
        @media (max-width: 640px) {
          .track-search-row { flex-direction: column; }
          .track-search-row > button { width: 100%; padding: 12px 16px !important; }
          .track-info-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "48px 32px 56px" }}>
        <div style={{ marginBottom: "26px" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#F59A1A", letterSpacing: "0.14em", marginBottom: "8px" }}>
            LACAK PESANAN
          </p>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px, 4vw, 38px)", color: "#162B45", margin: 0 }}>
            Cek status pesananmu
          </h2>
          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", marginTop: "8px", lineHeight: 1.65 }}>
            Masukkan ID pesanan dan nomor WhatsApp yang digunakan saat checkout.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, .9fr) auto", gap: "10px", marginBottom: "18px" }} className="track-search-row">
          <input
            aria-label="ID pesanan"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupOrder()}
            placeholder="ID pesanan (mis. MG-1719...)"
            style={{
              minWidth: 0,
              fontFamily: "'Work Sans', sans-serif",
              border: "1px solid #DCD4C2",
              padding: "13px 15px",
              fontSize: "14px",
              outline: "none",
              borderRadius: "10px",
              background: "#fff",
              color: "#162B45",
            }}
          />
          <input
            aria-label="Nomor HP/WhatsApp"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupOrder()}
            inputMode="tel"
            autoComplete="tel"
            placeholder="Nomor WhatsApp"
            style={{
              minWidth: 0,
              fontFamily: "'Work Sans', sans-serif",
              border: "1px solid #DCD4C2",
              padding: "13px 15px",
              fontSize: "14px",
              outline: "none",
              borderRadius: "10px",
              background: "#fff",
              color: "#162B45",
            }}
          />
          <button
            onClick={() => lookupOrder()}
            disabled={loading}
            style={{
              background: loading ? "#A9A291" : "#1F2E22",
              color: "#F6F1E7",
              fontFamily: "'Work Sans', sans-serif",
              fontWeight: 600,
              padding: "0 24px",
              minHeight: "48px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              borderRadius: "10px",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Mencari..." : "Cek pesanan"}
          </button>
        </div>

        {history.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#8D877A", marginBottom: "8px" }}>
              Pesanan terakhir di perangkat ini
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
              {history.slice(0, 5).map((id) => (
                <button
                  key={id}
                  onClick={() => { setOrderId(id); lookupOrder(id); }}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    border: order?.id === id ? "1px solid #1F2E22" : "1px solid #DCD4C2",
                    background: order?.id === id ? "#EEF2EA" : "#FFFCF6",
                    padding: "6px 9px",
                    cursor: "pointer",
                    color: "#4C6354",
                    borderRadius: "7px",
                  }}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "#FFF2EE", border: "1px solid #E9C8BD", color: "#A45A43", padding: "12px 14px", borderRadius: "9px", fontFamily: "'Work Sans', sans-serif", fontSize: "13px" }}>
            {error}
          </div>
        )}

        {order && (
          <article style={{ background: "#fff", border: "1px solid #DED6C5", borderRadius: "14px", overflow: "hidden", boxShadow: "0 18px 42px rgba(22,43,69,.055)" }}>
            <header style={{ padding: "20px 22px 18px", borderBottom: "1px solid #EEE8DC", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#8D877A", letterSpacing: ".08em", marginBottom: "7px" }}>
                  ID PESANAN
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", color: "#162B45" }}>{order.id}</strong>
                  <button
                    type="button"
                    onClick={copyTrackedOrderId}
                    title={copiedOrderId ? "ID tersalin" : "Salin ID pesanan"}
                    aria-label={copiedOrderId ? "ID pesanan tersalin" : "Salin ID pesanan"}
                    style={{
                      minWidth: copiedOrderId ? "86px" : "30px",
                      height: "30px",
                      padding: copiedOrderId ? "0 9px" : 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      border: "1px solid #DED6C5",
                      background: copiedOrderId ? "#EEF2EA" : "#FFFCF6",
                      borderRadius: "8px",
                      cursor: "pointer",
                      color: "#4C6354",
                      fontFamily: "'Work Sans', sans-serif",
                      fontSize: "10px",
                      fontWeight: 600,
                      transition: "min-width .18s ease, background .18s ease",
                    }}
                  >
                    {copiedOrderId ? (
                      <><Check size={13} /> ID tersalin</>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    )}
                  </button>
                </div>
                <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#9B9588", marginTop: "7px" }}>
                  Dibuat {adminDateLabel(order.createdAt)}
                </p>
              </div>

              <span
                style={{
                  fontFamily: "'Work Sans', sans-serif",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#fff",
                  background: ORDER_STATUS_LABEL[visibleOrderStatus]?.color || "#6B6558",
                  padding: "7px 11px",
                  borderRadius: "8px",
                  whiteSpace: "nowrap",
                }}
              >
                {visibleOrderStatusLabel}
              </span>
            </header>

            <div style={{ padding: "20px 22px 22px" }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${timelineSteps.length}, minmax(0, 1fr))`, marginBottom: "22px" }}>
                {timelineSteps.map((label, index) => {
                  const state = getTimelineState(index);
                  const color = state === "error" ? "#C97B5E" : state === "done" || state === "active" ? "#1F2E22" : "#D7D0C1";
                  return (
                    <div key={label} style={{ position: "relative", textAlign: "center", padding: "0 4px" }}>
                      {index < timelineSteps.length - 1 && (
                        <span style={{ position: "absolute", top: "12px", left: "50%", right: "-50%", height: "2px", background: state === "done" ? "#1F2E22" : "#E4DED1", zIndex: 0 }} />
                      )}
                      <span style={{ position: "relative", zIndex: 1, width: "25px", height: "25px", margin: "0 auto 7px", borderRadius: "50%", display: "grid", placeItems: "center", background: state === "upcoming" ? "#fff" : color, color: state === "upcoming" ? "#A8A294" : "#fff", border: `2px solid ${color}`, fontFamily: "'Work Sans', sans-serif", fontSize: "11px", fontWeight: 700 }}>
                        {state === "error" ? "×" : state === "done" ? "✓" : index + 1}
                      </span>
                      <span style={{ display: "block", fontFamily: "'Work Sans', sans-serif", fontSize: "10px", lineHeight: 1.35, color: state === "upcoming" ? "#AAA497" : "#4A4540" }}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {visibleOrderStatus === "pending" && (paymentToken || paymentRedirectUrl) && (
                <section style={{ background: "#FFF7EC", border: "1px solid #EBCFAE", padding: "16px", marginBottom: "18px", borderRadius: "11px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#7B5737", marginBottom: "5px" }}>
                        Pembayaran belum selesai
                      </p>
                      {paymentCountdown.hasExpiry ? (
                        <>
                          <strong style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: "23px", color: "#C97B5E", letterSpacing: ".04em" }}>
                            {formatPaymentCountdown(paymentCountdown.remainingMs)}
                          </strong>
                          <small style={{ display: "block", fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#9A7555", marginTop: "4px" }}>
                            Berakhir {adminDateLabel(paymentExpiresAt)}
                          </small>
                        </>
                      ) : (
                        <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", margin: 0 }}>
                          Sesi pembayaran masih dapat dibuka dari perangkat ini.
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "190px" }}>
                      <button
                        onClick={resumePayment}
                        disabled={resumingPayment}
                        style={{ width: "100%", background: resumingPayment ? "#C9C2AD" : "#1F2E22", color: "#F6F1E7", border: "none", borderRadius: "9px", padding: "10px 16px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 700, cursor: resumingPayment ? "not-allowed" : "pointer" }}
                      >
                        {resumingPayment ? "Membuka..." : "Lanjutkan pembayaran"}
                      </button>
                      {paymentCancelToken && (
                        <button
                          type="button"
                          onClick={() => setShowCancelConfirm(true)}
                          style={{ width: "100%", background: "transparent", color: "#A9573D", border: "1px solid #C97B5E", borderRadius: "9px", padding: "9px 16px", fontFamily: "'Work Sans', sans-serif", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                        >
                          Batalkan pesanan
                        </button>
                      )}
                    </div>
                  </div>
                  {paymentActionError && <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#C97B5E", marginTop: "9px" }}>{paymentActionError}</p>}
                </section>
              )}

              {visibleOrderStatus === "pending" && !paymentToken && !paymentRedirectUrl && (
                <section style={{ background: "#F7F4EE", border: "1px solid #DED6C5", padding: "14px 15px", marginBottom: "18px", borderRadius: "10px" }}>
                  <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", lineHeight: 1.65, margin: 0 }}>
                    Sesi pembayaran tidak ditemukan pada perangkat ini. Buka pesanan dari perangkat yang digunakan saat checkout atau buat pesanan baru.
                  </p>
                </section>
              )}

              {visibleOrderStatus === "expired" && (
                <section style={{ background: "#F7F2EA", border: "1px solid #DFCDB9", padding: "16px", marginBottom: "18px", borderRadius: "11px" }}>
                  <strong style={{ display: "block", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#7F5736", marginBottom: "5px" }}>
                    Sesi pembayaran telah berakhir
                  </strong>
                  <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", lineHeight: 1.65, margin: 0 }}>
                    Produk belum dibayar dan stok belum dikurangi. Buat pesanan baru untuk melanjutkan pembelian.
                    {order.expiredAt && <> Sesi berakhir pada {adminDateLabel(order.expiredAt)}.</>}
                  </p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "13px" }}>
                    <button
                      onClick={repeatCurrentOrder}
                      disabled={typeof onReorder !== "function"}
                      style={{ background: "#1F2E22", color: "#F6F1E7", border: "none", borderRadius: "9px", padding: "9px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Buat pesanan ulang
                    </button>
                    <button
                      onClick={browseCatalog}
                      style={{ background: "#fff", color: "#4C6354", border: "1px solid #D8D0C0", borderRadius: "9px", padding: "9px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    >
                      Kembali ke katalog
                    </button>
                  </div>
                </section>
              )}

              {visibleOrderStatus === "cancelled" && (
                <section style={{ background: "#F7F4EE", border: "1px solid #DED6C5", padding: "16px", marginBottom: "18px", borderRadius: "11px" }}>
                  <strong style={{ display: "block", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", marginBottom: "5px" }}>
                    Pesanan dibatalkan oleh pelanggan
                  </strong>
                  <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", lineHeight: 1.65, margin: 0 }}>
                    Sesi pembayaran sudah ditutup dan tidak dapat dibuka kembali.
                    {order.cancelledAt && <> Pesanan dibatalkan pada {adminDateLabel(order.cancelledAt)}.</>}
                  </p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "13px" }}>
                    <button
                      onClick={repeatCurrentOrder}
                      disabled={typeof onReorder !== "function"}
                      style={{ background: "#1F2E22", color: "#F6F1E7", border: "none", borderRadius: "9px", padding: "9px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Buat pesanan ulang
                    </button>
                    <button
                      onClick={browseCatalog}
                      style={{ background: "#fff", color: "#4C6354", border: "1px solid #D8D0C0", borderRadius: "9px", padding: "9px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    >
                      Kembali ke katalog
                    </button>
                  </div>
                </section>
              )}

              <section style={{ border: "1px solid #E8E1D5", borderRadius: "10px", overflow: "hidden", marginBottom: "16px" }}>
                <div style={{ padding: "11px 14px", background: "#FBF8F2", borderBottom: "1px solid #E8E1D5" }}>
                  <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "15px", color: "#162B45", margin: 0 }}>Ringkasan produk</h3>
                </div>
                <div style={{ padding: "4px 14px" }}>
                  {(order.items || []).map((item, index) => {
                    const image = getProductImage(item);
                    return (
                      <div key={`${item.id || item.name}-${index}`} style={{ display: "flex", alignItems: "center", gap: "11px", padding: "10px 0", borderBottom: index < (order.items || []).length - 1 ? "1px solid #F0EBE1" : "none" }}>
                        <div style={{ width: "46px", height: "46px", flexShrink: 0, background: "#F4F0E7", border: "1px solid #E7E0D3", borderRadius: "8px", overflow: "hidden", display: "grid", placeItems: "center" }}>
                          {image ? <img src={image} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Leaf size={18} color="#8BA08E" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, color: "#162B45", margin: 0 }}>{products.find((product) => product.id === item.id)?.name || item.name}</p>
                          <small style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#9B9588" }}>{item.qty} × {formatIDR(Number(item.price || 0))}</small>
                        </div>
                        <strong style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#162B45", whiteSpace: "nowrap" }}>
                          {formatIDR(Number(item.price || 0) * Number(item.qty || 0))}
                        </strong>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 14px", background: "#FBF8F2", borderTop: "1px solid #E8E1D5" }}>
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 700, color: "#162B45" }}>Total</span>
                  <strong style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", color: "#162B45" }}>{formatIDR(Number(order.amount || 0))}</strong>
                </div>
              </section>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginBottom: "4px" }} className="track-info-grid">
                <section style={{ background: "#FBF8F2", border: "1px solid #E8E1D5", borderRadius: "10px", padding: "13px 14px" }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#9A9486", letterSpacing: ".08em", marginBottom: "7px" }}>ALAMAT PENGIRIMAN</p>
                  <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#4A4540", lineHeight: 1.6, margin: 0 }}>{order.address || "-"}</p>
                </section>
                <section style={{ background: "#FBF8F2", border: "1px solid #E8E1D5", borderRadius: "10px", padding: "13px 14px" }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#9A9486", letterSpacing: ".08em", marginBottom: "7px" }}>PENGIRIMAN</p>
                  <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#4A4540", lineHeight: 1.6, margin: 0 }}>
                    {order.shippingFee > 0
                      ? `${formatIDR(Number(order.shippingFee || 0))} · ${(order.shippingCourier || "-").toUpperCase()} ${(order.shippingService || "").toUpperCase()}`
                      : order.destinationAreaName
                      ? "Gratis ongkir"
                      : "Belum ditentukan"}
                  </p>
                  {order.trackingNumber && <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4C6354", marginTop: "5px" }}>Resi {order.trackingNumber}</p>}
                </section>
              </div>

              <ReturnRequestPanel
                order={order}
                phone={phone}
                products={products}
                onRefresh={() => lookupOrder(order.id)}
              />

              {["paid", "processing", "shipped"].includes(visibleOrderStatus) && (
                <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                  <a
                    href={contactAdminUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px", background: "#fff", color: "#4C6354", border: "1px solid #BFCBBC", borderRadius: "9px", padding: "9px 13px", fontFamily: "'Work Sans', sans-serif", fontSize: "11px", fontWeight: 600, textDecoration: "none" }}
                  >
                    Hubungi admin
                  </a>
                </div>
              )}

              {(order.status === "shipped" || order.status === "delivered") && order.trackingNumber && (
                <section style={{ marginTop: "16px", borderTop: "1px solid #EEE8DC", paddingTop: "15px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#8D877A", marginBottom: "3px" }}>Nomor resi</p>
                      <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#1F2E22" }}>{order.trackingNumber}</strong>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => fetchTracking(order.trackingNumber, order.shippingCourier || "jne")}
                        disabled={trackingLoading}
                        style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", fontWeight: 600, color: "#229ED9", background: "#fff", border: "1px solid #229ED9", borderRadius: "7px", padding: "6px 10px", cursor: trackingLoading ? "not-allowed" : "pointer" }}
                      >
                        {trackingLoading ? "Memuat..." : tracking ? "Refresh tracking" : "Lacak pengiriman"}
                      </button>
                      <a
                        href={`https://tracking.biteship.com/?waybill_id=${encodeURIComponent(order.trackingNumber)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", fontWeight: 600, color: "#4C6354", border: "1px solid #4C6354", borderRadius: "7px", padding: "6px 10px", textDecoration: "none", display: "inline-block" }}
                      >
                        Live tracking ↗
                      </a>
                    </div>
                  </div>

                  {trackingError && <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#C97B5E" }}>{trackingError}</p>}

                  {tracking?.history?.length > 0 && (
                    <div style={{ borderLeft: "2px solid #E3DCC9", paddingLeft: "14px", marginLeft: "6px" }}>
                      {tracking.history.slice().reverse().map((historyItem, index) => (
                        <div key={index} style={{ marginBottom: "10px", position: "relative" }}>
                          <span style={{ position: "absolute", left: "-20px", top: "4px", width: "10px", height: "10px", borderRadius: "50%", background: index === 0 ? "#229ED9" : "#E3DCC9" }} />
                          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#162B45", margin: 0 }}>{historyItem.note}</p>
                          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#A39E8E", marginTop: "3px" }}>
                            {new Date(historyItem.updatedAt).toLocaleString(locale === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {tracking && (!tracking.history || tracking.history.length === 0) && (
                    <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#6B6558" }}>Belum ada data tracking. Coba lagi nanti.</p>
                  )}
                </section>
              )}
            </div>
          </article>
        )}
      </div>

      {showCancelConfirm && (
        <div
          onClick={() => !cancellingOrder && setShowCancelConfirm(false)}
          style={{ position: "fixed", inset: 0, zIndex: 140, display: "grid", placeItems: "center", padding: "20px", background: "rgba(22,43,69,.50)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-order-title"
            style={{ width: "min(430px, 94vw)", background: "#FFFDF8", border: "1px solid #E3DCC9", borderRadius: "16px", boxShadow: "0 28px 80px rgba(22,43,69,.22)", padding: "24px" }}
          >
            <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#FFF0EA", display: "grid", placeItems: "center", color: "#A9573D", marginBottom: "15px" }}>
              <X size={21} />
            </div>
            <h3 id="cancel-order-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "21px", color: "#162B45", margin: "0 0 8px" }}>
              Batalkan pesanan?
            </h3>
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", lineHeight: 1.7, margin: 0 }}>
              Setelah dibatalkan, sesi pembayaran ini tidak dapat dilanjutkan. Kamu masih dapat membuat pesanan ulang dari halaman lacak pesanan.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "9px", marginTop: "22px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancellingOrder}
                style={{ background: "#fff", color: "#4C6354", border: "1px solid #D8D0C0", borderRadius: "9px", padding: "9px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: cancellingOrder ? "not-allowed" : "pointer" }}
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={cancelPendingOrder}
                disabled={cancellingOrder}
                style={{ background: cancellingOrder ? "#D7B2A5" : "#A9573D", color: "#fff", border: "none", borderRadius: "9px", padding: "9px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 700, cursor: cancellingOrder ? "not-allowed" : "pointer" }}
              >
                {cancellingOrder ? "Membatalkan..." : "Ya, batalkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export { TrackOrderSection };
