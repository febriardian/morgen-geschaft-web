import { getApps, initializeApp } from "firebase/app";

// Keep Firebase App separate from Firestore. Public storefront pages only need
// the backend API, while Firebase is loaded on demand for the admin workspace.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const FIREBASE_CONFIG_MISSING = !firebaseConfig.apiKey || !firebaseConfig.projectId;

if (FIREBASE_CONFIG_MISSING) {
  console.error(
    "⚠️ Firebase config tidak lengkap. Pastikan VITE_FIREBASE_* sudah diset di .env"
  );

  if (typeof document !== "undefined") {
    const showConfigurationBanner = () => {
      if (document.querySelector("[data-morgen-firebase-warning]")) return;
      const banner = document.createElement("div");
      banner.dataset.morgenFirebaseWarning = "true";
      banner.textContent =
        "⚠️ Firebase belum dikonfigurasi. Cek file .env (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID).";
      banner.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:99999;background:#C97B5E;color:#fff;padding:12px 16px;font-family:sans-serif;font-size:13px;text-align:center;";
      document.body.prepend(banner);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showConfigurationBanner, { once: true });
    } else {
      showConfigurationBanner();
    }
  }
}

const firebaseApp = getApps()[0] || initializeApp(firebaseConfig);

export { firebaseConfig, firebaseApp };
