// services/notifications.js
// Helper: simpan notifikasi ke Firestore (notification center)

import { getAdminDb } from "../config/firebaseAdmin.js";
import { log } from "./logger.js";

export async function saveNotification(title, body, url = "/", category = "broadcast", orderId = null, translations = {}) {
  try {
    const db = getAdminDb();
    const doc = {
      title,
      body,
      url,
      titleEn: String(translations?.titleEn || "").trim(),
      bodyEn: String(translations?.bodyEn || "").trim(),
      urlEn: String(translations?.urlEn || "").trim(),
      sentAt: new Date().toISOString(),
      auto: true,
      category,
    };
    if (orderId) doc.orderId = orderId;
    await db.collection("notifications").add(doc);
  } catch (err) { log("error", "notifications", "saveNotification error", { error: err.message }); }
}
