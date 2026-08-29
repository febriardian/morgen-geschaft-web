const NOTIFICATION_BASELINE_VERSION = 1;

function getNotificationTime(notification) {
  const sentAt = notification?.sentAt;

  if (typeof sentAt === "number" && Number.isFinite(sentAt)) {
    return sentAt;
  }

  if (typeof sentAt === "string") {
    const parsed = Date.parse(sentAt);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const seconds = sentAt?.seconds ?? sentAt?._seconds;
  if (typeof seconds === "number" && Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  return null;
}

function isNotificationBaselineValid(baseline) {
  return Boolean(
    baseline
    && baseline.version === NOTIFICATION_BASELINE_VERSION
    && Number.isFinite(baseline.sentAtMs)
    && Array.isArray(baseline.idsAtSentAt)
  );
}

function createNotificationBaseline(notifications, now = Date.now()) {
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const notificationTimes = safeNotifications
    .map(getNotificationTime)
    .filter(Number.isFinite);
  const sentAtMs = notificationTimes.length > 0
    ? Math.max(...notificationTimes)
    : now;
  const idsAtSentAt = safeNotifications
    .filter((notification) => getNotificationTime(notification) === sentAtMs)
    .map((notification) => String(notification?.id || ""))
    .filter(Boolean);

  return {
    version: NOTIFICATION_BASELINE_VERSION,
    sentAtMs,
    idsAtSentAt,
  };
}

function isNotificationAfterBaseline(notification, baseline) {
  if (!isNotificationBaselineValid(baseline)) return false;

  const sentAtMs = getNotificationTime(notification);
  if (!Number.isFinite(sentAtMs)) return false;
  if (sentAtMs > baseline.sentAtMs) return true;
  if (sentAtMs < baseline.sentAtMs) return false;

  const notificationId = String(notification?.id || "");
  return Boolean(notificationId && !baseline.idsAtSentAt.includes(notificationId));
}

function filterNotificationsAfterBaseline(notifications, baseline) {
  if (!Array.isArray(notifications)) return [];
  return notifications.filter((notification) => isNotificationAfterBaseline(notification, baseline));
}

export {
  createNotificationBaseline,
  filterNotificationsAfterBaseline,
  getNotificationTime,
  isNotificationAfterBaseline,
  isNotificationBaselineValid,
};
