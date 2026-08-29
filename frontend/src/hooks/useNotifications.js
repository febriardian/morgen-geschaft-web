// hooks/useNotifications.js
// Manages notification fetching, read/hide state, and browser push subscription.

import { useState, useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage.js";
import { apiFetch, readJsonResponse } from "../services/apiClient.js";
import { getExistingPushSubscription, subscribeToBrowserPush } from "../services/pushNotifications.js";
import { getLocalOrderAccessProofs, getLocalOrderHistory } from "../utils/paymentStorage.js";
import { useLocale } from "../i18n/LocaleContext.jsx";
import { localizeLegacyUrl, translateUiText } from "../i18n/locale.js";
import {
  createNotificationBaseline,
  filterNotificationsAfterBaseline,
  isNotificationBaselineValid,
} from "../utils/notificationInbox.js";

export function useNotifications(user, customer = null) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [readNotifIds, setReadNotifIds] = useLocalStorage("mg_read_notifs", []);
  const [hiddenNotifIds, setHiddenNotifIds] = useLocalStorage("mg_hidden_notifs", []);
  const [notificationBaseline, setNotificationBaseline] = useLocalStorage("mg_notif_baseline", null);
  const [notifTab, setNotifTab] = useState("semua");
  const [openNotifMenuId, setOpenNotifMenuId] = useState(null);
  const [pushToast, setPushToast] = useState("");
  const [pushState, setPushState] = useState("idle");

  const fetchNotifications = async () => {
    setNotifsLoading(true);
    try {
      const myOrders = getLocalOrderHistory();
      const headers = {};
      let adminRequest = false;

      if (user || customer) {
        try {
          const { auth } = await import("../services/firebaseAuth.js");
          if (!auth.currentUser) throw new Error("Sesi akun tidak tersedia.");
          const token = await auth.currentUser.getIdToken();
          headers.Authorization = `Bearer ${token}`;
          adminRequest = Boolean(user);
        } catch {
          adminRequest = false;
        }
      }

      const orderProofs = adminRequest || customer ? [] : getLocalOrderAccessProofs();
      const endpoint = customer ? "/api/customer/notifications" : orderProofs.length > 0 ? "/api/notifications/orders" : "/api/notifications";
      const requestOptions = orderProofs.length > 0
        ? { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ orders: orderProofs }) }
        : { headers };
      const res = await apiFetch(endpoint, requestOptions, { timeoutMs: 12000, expectJson: true });

      if (res.ok) {
        const data = await readJsonResponse(res);
        const isOrderNotification = (notification) => {
          const category = String(notification?.category || "").toLowerCase();
          const title = String(notification?.title || "").trim().toLowerCase();
          return category === "pesanan"
            || title.startsWith("pesanan")
            || title.startsWith("pembayaran");
        };

        const eligibleNotifications = (data.notifications || []).filter((notification) => {
          if (!isOrderNotification(notification)) return true;
          if (adminRequest || customer) return true;
          return Boolean(
            notification.orderId
            && myOrders.includes(String(notification.orderId))
          );
        });

        if (!isNotificationBaselineValid(notificationBaseline)) {
          setNotificationBaseline(createNotificationBaseline(eligibleNotifications));
          setNotifications([]);
          return;
        }

        const visibleNotifications = filterNotificationsAfterBaseline(
          eligibleNotifications,
          notificationBaseline
        ).filter((notification) => !hiddenNotifIds.includes(notification.id));

        const localized = visibleNotifications.map((notification) => ({
          ...notification,
          title: locale === "en" ? (notification.titleEn || translateUiText(notification.title, "en")) : notification.title,
          body: locale === "en" ? (notification.bodyEn || translateUiText(notification.body, "en")) : notification.body,
          url: locale === "en"
            ? localizeLegacyUrl(notification.urlEn || notification.url, "en")
            : localizeLegacyUrl(notification.url, "id"),
        }));

        setNotifications(localized);
      }
    } catch (err) {
      console.error("Fetch notifs error:", err);
    } finally {
      setNotifsLoading(false);
    }
  };

  const unreadCount = notifications.filter((n) => !readNotifIds.includes(n.id)).length;

  const openNotifPanel = () => {
    setOpenNotifMenuId(null);
    setShowNotifPanel(true);
    fetchNotifications();
  };

  const markAllRead = () => {
    setReadNotifIds(notifications.map((n) => n.id));
  };

  const hideNotificationLocally = (notificationId) => {
    if (!notificationId) return;
    setHiddenNotifIds((previous) => previous.includes(notificationId) ? previous : [...previous, notificationId]);
    setNotifications((previous) => previous.filter((notification) => notification.id !== notificationId));
    setOpenNotifMenuId(null);
  };

  const clearAllNotifications = () => {
    const idsToHide = notifications.map((notification) => notification.id);
    setHiddenNotifIds((previous) => Array.from(new Set([...previous, ...idsToHide])));
    setNotifications([]);
    setReadNotifIds((previous) => Array.from(new Set([...previous, ...idsToHide])));
    setOpenNotifMenuId(null);
  };

  const handlePushSubscribe = async () => {
    if (["subscribed", "unsupported", "loading"].includes(pushState)) return;

    setPushState("loading");
    setPushToast("");

    try {
      await subscribeToBrowserPush(locale);
      setPushState("subscribed");
      setPushToast(isEnglish
        ? "Browser notifications are now active."
        : "Notifikasi browser berhasil diaktifkan."
      );
    } catch (err) {
      console.error("Push subscribe error:", err);

      if (err.code === "unsupported" || err.code === "insecure") {
        setPushState("unsupported");
      } else if (err.code === "denied") {
        setPushState("denied");
      } else if (err.code === "dismissed") {
        setPushState("idle");
      } else {
        setPushState("error");
      }

      setPushToast(err.message || (isEnglish
        ? "Notifications could not be enabled. Make sure the backend is running."
        : "Notifikasi belum dapat diaktifkan. Pastikan backend sedang berjalan."
      ));
    }
  };

  // Check browser push state on mount + initial notification fetch.
  useEffect(() => {
    let cancelled = false;

    const checkPushState = async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setPushState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setPushState("denied");
        return;
      }
      if (Notification.permission !== "granted") return;

      try {
        const subscription = await getExistingPushSubscription();
        if (!cancelled && subscription) setPushState("subscribed");
      } catch {
        if (!cancelled) setPushState("idle");
      }
    };

    checkPushState();
    fetchNotifications();

    return () => { cancelled = true; };
  }, [locale, user, customer?.uid]); // Refresh after language or authenticated identity changes.

  return {
    showNotifPanel, setShowNotifPanel,
    notifications, notifsLoading,
    readNotifIds, setReadNotifIds,
    notifTab, setNotifTab,
    openNotifMenuId, setOpenNotifMenuId,
    pushToast, setPushToast,
    pushState, setPushState, handlePushSubscribe,
    unreadCount,
    openNotifPanel, markAllRead,
    hideNotificationLocally, clearAllNotifications,
    fetchNotifications,
  };
}
