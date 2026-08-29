import { getFirestore, collection, addDoc } from "firebase/firestore";
import { firebaseApp, firebaseConfig } from "./firebaseCore.js";

const db = getFirestore(firebaseApp);


// Helper: simpan notifikasi ke Firestore (dipanggil dari admin panel)
async function addNotification(title, body, url = "/", category = "broadcast", translations = {}) {
  const localized = translations && typeof translations === "object" ? translations : {};
  try {
    await addDoc(collection(db, "notifications"), {
      title,
      body,
      url,
      titleEn: String(localized.titleEn || "").trim(),
      bodyEn: String(localized.bodyEn || "").trim(),
      urlEn: String(localized.urlEn || "").trim(),
      sentAt: new Date().toISOString(),
      auto: true,
      category,
    });
  } catch (err) { console.error("addNotification error:", err); }
}

export { firebaseConfig, firebaseApp, db, addNotification };
