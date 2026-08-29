// api/_firebaseAdmin.js
//
// Helper buat inisialisasi Firebase Admin SDK sekali aja, dipakai bersama
// oleh create-transaction.js dan midtrans-notification.js.
//
// Admin SDK ini BERBEDA dari Firebase yang dipakai di App.jsx (client SDK).
// Admin SDK punya akses penuh ke Firestore, TIDAK terikat oleh Security Rules
// — makanya credential-nya (service account) harus dirahasiakan di server,
// jangan pernah ditaruh di kode frontend.

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 belum dikonfigurasi.");
  }

  const serviceAccount = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
