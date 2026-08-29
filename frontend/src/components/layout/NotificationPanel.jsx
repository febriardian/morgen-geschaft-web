import { useMemo, useState } from "react";
import { X, Bell, Tag, Package, Leaf, FileText, Star, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import { localizeRecord } from "../../i18n/locale.js";

const NOTIF_CATEGORIES = [
  { key: "semua", label: "Semua", icon: null },
  { key: "promo", label: "Promo", icon: <Tag size={12} /> },
  { key: "pesanan", label: "Pesanan", icon: <Package size={12} /> },
  { key: "produk", label: "Produk", icon: <Leaf size={12} /> },
  { key: "artikel", label: "Artikel", icon: <FileText size={12} /> },
  { key: "ulasan", label: "Ulasan", icon: <Star size={12} /> },
  { key: "broadcast", label: "Broadcast", icon: <Megaphone size={12} /> },
];

const CAT_COLORS = { promo: "#F59A1A", pesanan: "#C97B5E", artikel: "#173B5E", produk: "#162B45", ulasan: "#C97B5E", broadcast: "#6B6558" };
const CAT_LABELS = { promo: "Promo", pesanan: "Pesanan", artikel: "Artikel", produk: "Produk", ulasan: "Ulasan", broadcast: "Broadcast" };

function inferCategory(n) {
  if (n.category) return n.category;
  const t = (n.title || "").toLowerCase();
  if (t.startsWith("promo")) return "promo";
  if (t.startsWith("pesanan") || t.startsWith("pembayaran")) return "pesanan";
  if (t.startsWith("artikel")) return "artikel";
  if (t.startsWith("produk") || t.includes("tersedia kembali")) return "produk";
  if (t.startsWith("ulasan")) return "ulasan";
  return "broadcast";
}

export function NotificationPanel({
  notifications,
  notifsLoading,
  readNotifIds,
  setReadNotifIds,
  onClose,
  onHideNotification,
  onClearAll,
  pushState,
  pushMessage,
  onPushSubscribe,
}) {
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const localizedNotifications = useMemo(
    () => notifications.map((notification) => localizeRecord(notification, locale, "notification")),
    [notifications, locale]
  );
  const [notifTab, setNotifTab] = useState("semua");
  const [openMenuId, setOpenMenuId] = useState(null);

  const unreadCount = localizedNotifications.filter((n) => !readNotifIds.includes(n.id)).length;

  const markAllRead = () => {
    setReadNotifIds(localizedNotifications.map((n) => n.id));
  };

  const filtered = notifTab === "semua"
    ? localizedNotifications
    : localizedNotifications.filter((n) => inferCategory(n) === notifTab);

  const unreadItems = filtered.filter((n) => !readNotifIds.includes(n.id));
  const previousItems = filtered.filter((n) => readNotifIds.includes(n.id));

  // Tab counts
  const catCounts = {};
  localizedNotifications.forEach((n) => { const c = inferCategory(n); catCounts[c] = (catCounts[c] || 0) + 1; });
  const visibleTabs = NOTIF_CATEGORIES.filter((tab) => tab.key === "semua" || catCounts[tab.key]);

  const renderItem = (n, isUnread) => {
    const category = inferCategory(n);
    return (
      <div
        key={n.id}
        style={{
          position: "relative",
          margin: isUnread ? "7px 8px" : "0",
          borderRadius: isUnread ? "10px" : "0",
          background: isUnread ? "#FBF8F0" : "#fff",
          borderBottom: "1px solid #F0EBE0",
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (!readNotifIds.includes(n.id)) setReadNotifIds((prev) => [...prev, n.id]);
            setOpenMenuId(null);
            if (n.url && n.url !== "/") {
              onClose();
              const target = String(n.url);
              navigate(target.startsWith("/id/") || target === "/id" || target.startsWith("/en/") || target === "/en" ? target : target);
            }
          }}
          style={{
            display: "block", width: "100%", textAlign: "left",
            padding: "11px 48px 11px 14px", background: "transparent",
            border: "none", borderRadius: isUnread ? "10px" : "0",
            cursor: "pointer", fontFamily: "'Work Sans', sans-serif",
          }}
        >
          <div style={{ display: "flex", gap: "9px", alignItems: "flex-start" }}>
            {isUnread && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C97B5E", flexShrink: 0, marginTop: "5px" }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                <span style={{
                  fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                  color: CAT_COLORS[category] || "#6B6558", letterSpacing: "0.05em", textTransform: "uppercase",
                  background: (CAT_COLORS[category] || "#6B6558") + "12", padding: "2px 6px", borderRadius: "6px",
                }}>
                  {t(CAT_LABELS[category] || "Lainnya", ({ pesanan: "Orders", artikel: "Articles", produk: "Products", ulasan: "Reviews", promo: "Promotions", broadcast: "Updates" }[category] || "Other"))}
                </span>
              </div>
              <p style={{ fontSize: "13px", fontWeight: isUnread ? 600 : 500, color: "#162B45", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {n.title}
              </p>
              <p style={{ fontSize: "12px", color: "#6B6558", margin: "3px 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>
                {n.body}
              </p>
              <p style={{ fontSize: "10px", color: "#A39E8E", margin: "5px 0 0" }}>
                {n.sentAt ? new Date(n.sentAt).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
              </p>
            </div>
          </div>
        </button>

        <div style={{ position: "absolute", top: "9px", right: "9px" }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpenMenuId((c) => c === n.id ? null : n.id); }}
            aria-label={t("Menu notifikasi", "Notification menu")} title={t("Menu notifikasi", "Notification menu")}
            style={{ width: "28px", height: "28px", display: "grid", placeItems: "center", background: "#fff", border: "1px solid #E3DCC9", borderRadius: "8px", color: "#6B6558", cursor: "pointer", fontSize: "17px", lineHeight: 1 }}
          >
            ⋯
          </button>
          {openMenuId === n.id && (
            <div style={{ position: "absolute", top: "32px", right: 0, minWidth: "132px", background: "#fff", border: "1px solid #E3DCC9", borderRadius: "9px", boxShadow: "0 10px 26px rgba(22,43,69,.15)", padding: "5px", zIndex: 4 }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onHideNotification(n.id); }}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: "7px", padding: "8px 9px", color: "#A9573D", fontFamily: "'Work Sans', sans-serif", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
              >
                {t("Sembunyikan", "Hide")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
      <div style={{ position: "absolute", top: "36px", right: 0, width: "min(380px, 92vw)", maxHeight: "500px", background: "#fff", border: "1px solid #E3DCC9", borderRadius: "14px", overflow: "hidden", boxShadow: "0 14px 38px rgba(22,43,69,.16)", zIndex: 56, display: "flex", flexDirection: "column", fontFamily: "'Work Sans', sans-serif" }}>
        <style>{`.notif-tabs-scroll::-webkit-scrollbar{display:none}`}</style>

        {/* Header */}
        <div style={{ padding: "12px 16px 0", borderBottom: "1px solid #E3DCC9" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px", color: "#162B45" }}>{t("Notifikasi", "Notifications")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#173B5E", fontFamily: "'Work Sans', sans-serif" }}>
                  {t("Tandai dibaca", "Mark all as read")}
                </button>
              )}
              <button onClick={onClose} aria-label={t("Tutup notifikasi", "Close notifications")} style={{ width: "30px", height: "30px", display: "grid", placeItems: "center", background: "#fff", border: "1px solid #E3DCC9", borderRadius: "8px", cursor: "pointer" }}>
                <X size={15} color="#6B6558" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          {notifications.length > 0 && (
            <div className="notif-tabs-scroll" style={{ display: "flex", gap: "2px", overflowX: "auto", marginBottom: "-1px", scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {visibleTabs.map((tab) => {
                const active = notifTab === tab.key;
                const count = tab.key === "semua" ? notifications.length : (catCounts[tab.key] || 0);
                return (
                  <button
                    key={tab.key}
                    onClick={() => setNotifTab(tab.key)}
                    style={{
                      background: "none", border: "none", borderBottom: active ? "2px solid #1F2E22" : "2px solid transparent",
                      padding: "6px 8px", cursor: "pointer", fontFamily: "'Work Sans', sans-serif",
                      fontSize: "11px", fontWeight: active ? 600 : 400, color: active ? "#1F2E22" : "#A39E8E",
                      display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap", flexShrink: 0,
                      transition: "color 0.15s, border-color 0.15s",
                    }}
                  >
                    {tab.icon}
                    {t(tab.label, ({ Semua: "All", Promo: "Promotions", Pesanan: "Orders", Produk: "Products", Artikel: "Articles", Ulasan: "Reviews", Broadcast: "Updates" }[tab.label] || tab.label))}
                    <span style={{ fontSize: "10px", background: active ? "#1F2E22" : "#E3DCC9", color: active ? "#F6F1E7" : "#6B6558", borderRadius: "8px", padding: "0 5px", lineHeight: "16px", minWidth: "16px", textAlign: "center" }}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Push subscribe prompt */}
        {pushState !== "subscribed" && pushState !== "unsupported" && (
          <div style={{ padding: "10px 16px", background: "#FFF8ED", borderBottom: "1px solid #E9D1AA" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "30px", height: "30px", borderRadius: "9px", display: "grid", placeItems: "center", background: "rgba(245,154,26,.14)", border: "1px solid rgba(245,154,26,.28)", flexShrink: 0 }}>
                <Bell size={15} color="#F59A1A" />
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "12px", color: "#162B45", margin: 0, fontWeight: 600 }}>{t("Aktifkan notifikasi push", "Enable push notifications")}</p>
                <p style={{ fontSize: "11px", color: "#6B6558", margin: "2px 0 0" }}>{t("Dapatkan info promo & produk baru langsung di browser", "Get promotion and new-product updates directly in your browser")}</p>
              </div>
              <button
                onClick={onPushSubscribe}
                disabled={pushState === "loading" || pushState === "denied"}
                style={{ background: pushState === "error" ? "#F59A1A" : "#162B45", color: pushState === "error" ? "#162B45" : "#F6F1E7", border: "none", borderRadius: "9px", padding: "7px 12px", fontSize: "11px", cursor: pushState === "loading" || pushState === "denied" ? "not-allowed" : "pointer", fontFamily: "'Work Sans', sans-serif", fontWeight: 700, opacity: pushState === "loading" || pushState === "denied" ? 0.62 : 1 }}
              >
                {pushState === "loading"
                  ? t("Mengaktifkan...", "Enabling...")
                  : pushState === "denied"
                    ? t("Izin diblokir", "Permission blocked")
                    : pushState === "error"
                      ? t("Coba lagi", "Try again")
                      : t("Aktifkan", "Enable")}
              </button>
            </div>
            {pushMessage && (
              <p role="status" style={{ margin: "8px 0 0 40px", padding: "8px 10px", borderRadius: "8px", background: pushState === "error" || pushState === "denied" ? "#FFF0E5" : "#EEF3F8", border: `1px solid ${pushState === "error" || pushState === "denied" ? "#F0C49A" : "#CCD8E5"}`, color: pushState === "error" || pushState === "denied" ? "#8A4D1C" : "#173B5E", fontSize: "11px", lineHeight: 1.5 }}>
                {pushMessage}
              </p>
            )}
          </div>
        )}

        {pushState === "subscribed" && pushMessage && (
          <div role="status" style={{ padding: "9px 16px", background: "#FFF8ED", borderBottom: "1px solid #E9D1AA", color: "#173B5E", fontSize: "11px", fontWeight: 600 }}>
            <span style={{ color: "#F59A1A", marginRight: "6px" }}>✓</span>{pushMessage}
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {notifsLoading && notifications.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#A39E8E" }}>{t("Memuat...", "Loading...")}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center" }}>
              <Bell size={32} color="#E3DCC9" strokeWidth={1.2} />
              <p style={{ fontSize: "13px", color: "#A39E8E", marginTop: "8px" }}>{t("Belum ada notifikasi", "No notifications yet")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center" }}>
              <Bell size={28} color="#E3DCC9" strokeWidth={1.2} />
              <p style={{ fontSize: "13px", color: "#A39E8E", marginTop: "8px" }}>{t("Tidak ada notifikasi di kategori ini", "No notifications in this category")}</p>
            </div>
          ) : (
            <>
              {unreadItems.length > 0 && (
                <section>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px 3px" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#8F897C", letterSpacing: ".08em" }}>{t("BELUM DIBACA", "UNREAD")}</span>
                    <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#A39E8E" }}>{unreadItems.length}</span>
                  </div>
                  {unreadItems.map((n) => renderItem(n, true))}
                </section>
              )}
              {previousItems.length > 0 && (
                <section>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: unreadItems.length > 0 ? "13px 14px 3px" : "10px 14px 3px" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#8F897C", letterSpacing: ".08em" }}>{t("SEBELUMNYA", "EARLIER")}</span>
                    <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#A39E8E" }}>{previousItems.length}</span>
                  </div>
                  {previousItems.map((n) => renderItem(n, false))}
                </section>
              )}
            </>
          )}

          {notifications.length > 0 && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid #E3DCC9", textAlign: "center" }}>
              <button
                onClick={() => { if (window.confirm(t("Sembunyikan semua notifikasi dari perangkat ini?", "Hide all notifications on this device?"))) onClearAll(); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#A9573D", fontWeight: 600 }}
              >
                {t("Sembunyikan semua", "Hide all")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
