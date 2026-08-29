import {
  browserLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  getMultiFactorResolver,
  multiFactor,
  sendEmailVerification,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
} from "firebase/auth";
import { firebaseApp } from "./firebaseCore.js";

// Admin hanya memakai email/password. Inisialisasi tanpa popupRedirectResolver
// mencegah Firebase membuat iframe OAuth dan memeriksa authorized domain yang
// memang tidak diperlukan untuk alur ini.
const auth = initializeAuth(firebaseApp, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: undefined,
});

function adminAuthError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function adminSessionFromToken(firebaseUser, tokenResult) {
  const claims = tokenResult?.claims || {};
  return {
    isAdmin: claims.admin === true,
    emailVerified: firebaseUser?.emailVerified === true,
    hasSecondFactor: Boolean(claims.firebase?.sign_in_second_factor),
  };
}

async function getAdminSessionStatus(firebaseUser, forceRefresh = false) {
  if (!firebaseUser) {
    return { isAdmin: false, emailVerified: false, hasSecondFactor: false };
  }
  const tokenResult = await firebaseUser.getIdTokenResult(forceRefresh);
  return adminSessionFromToken(firebaseUser, tokenResult);
}

async function resolveAdminAccess(firebaseUser) {
  if (!firebaseUser) return false;
  try {
    const status = await getAdminSessionStatus(firebaseUser);
    if (!status.isAdmin) return false;
    if (import.meta.env.VITE_REQUIRE_ADMIN_MFA !== "true") return true;
    return status.emailVerified && status.hasSecondFactor;
  } catch (err) {
    console.error("Gagal membaca custom claim admin:", err);
    return false;
  }
}

async function resolveAdminClaim(firebaseUser) {
  if (!firebaseUser) return false;
  const status = await getAdminSessionStatus(firebaseUser);
  return status.isAdmin;
}

async function assertAdminAccess() {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error("Sesi admin berakhir. Silakan login ulang.");
  const status = await getAdminSessionStatus(firebaseUser);
  if (!status.isAdmin) throw new Error("Akun ini belum memiliki custom claim admin.");
  if (import.meta.env.VITE_REQUIRE_ADMIN_MFA === "true") {
    if (!status.emailVerified) throw new Error("Email admin belum terverifikasi.");
    if (!status.hasSecondFactor) {
      throw new Error("Verifikasi Authenticator diperlukan untuk mengakses admin.");
    }
  }
  return firebaseUser;
}

function subscribeToAdminAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

function signInAdmin(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

async function beginAdminSignIn(email, password) {
  try {
    return { credential: await signInAdmin(email, password), resolver: null };
  } catch (error) {
    if (error?.code !== "auth/multi-factor-auth-required") throw error;
    return { credential: null, resolver: getMultiFactorResolver(auth, error) };
  }
}

async function completeAdminTotpSignIn(resolver, code) {
  const hint = resolver?.hints?.find((item) => item.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!hint) throw new Error("Faktor TOTP admin tidak ditemukan.");
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, String(code || ""));
  return resolver.resolveSignIn(assertion);
}

async function sendAdminEmailVerification() {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) {
    throw adminAuthError("auth/admin-session-missing", "Sesi admin tidak tersedia.");
  }
  if (!(await resolveAdminClaim(firebaseUser))) {
    throw adminAuthError("auth/admin-access-denied", "Akun ini belum memiliki akses admin.");
  }
  if (firebaseUser.emailVerified === true) {
    return { alreadyVerified: true, email: firebaseUser.email || "" };
  }

  await sendEmailVerification(firebaseUser);
  return { alreadyVerified: false, email: firebaseUser.email || "" };
}

async function refreshAdminEmailVerification() {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) {
    throw adminAuthError("auth/admin-session-missing", "Sesi admin tidak tersedia.");
  }

  await firebaseUser.reload();
  const refreshedUser = auth.currentUser;
  const status = await getAdminSessionStatus(refreshedUser);
  if (!status.isAdmin) {
    throw adminAuthError("auth/admin-access-denied", "Akun ini belum memiliki akses admin.");
  }
  return status;
}

async function beginAdminTotpEnrollment() {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw adminAuthError("auth/admin-session-missing", "Sesi admin tidak tersedia.");

  const status = await getAdminSessionStatus(firebaseUser);
  if (!status.isAdmin) {
    throw adminAuthError("auth/admin-access-denied", "Akun ini belum memiliki akses admin.");
  }
  if (!status.emailVerified) {
    throw adminAuthError(
      "auth/admin-email-not-verified",
      "Email admin belum terverifikasi. Verifikasi email akun di Firebase Authentication terlebih dahulu."
    );
  }

  const enrolledFactors = multiFactor(firebaseUser).enrolledFactors || [];
  if (enrolledFactors.some((factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID)) {
    throw adminAuthError(
      "auth/admin-totp-already-enrolled",
      "Authenticator sudah terdaftar. Keluar lalu masuk kembali menggunakan kode 6 digit."
    );
  }

  const session = await multiFactor(firebaseUser).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  return {
    secret,
    secretKey: secret.secretKey,
    qrCodeUrl: secret.generateQrCodeUrl(firebaseUser.email || "admin", "Morgen Geschäft"),
  };
}

async function completeAdminTotpEnrollment(secret, code) {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser || !secret) throw new Error("Sesi pendaftaran TOTP tidak tersedia.");
  if (!(await resolveAdminClaim(firebaseUser))) {
    throw adminAuthError("auth/admin-access-denied", "Akun ini belum memiliki akses admin.");
  }
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, String(code || ""));
  await multiFactor(firebaseUser).enroll(assertion, "Authenticator Morgen Geschäft");
}

function adminAuthMessage(error, phase = "login") {
  const code = String(error?.code || "");

  const messages = {
    "auth/invalid-credential": "Email atau password admin tidak sesuai.",
    "auth/user-not-found": "Email atau password admin tidak sesuai.",
    "auth/wrong-password": "Email atau password admin tidak sesuai.",
    "auth/invalid-email": "Format email admin belum benar.",
    "auth/user-disabled": "Akun admin ini sedang dinonaktifkan.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.",
    "auth/network-request-failed": "Koneksi ke Firebase gagal. Periksa internet lalu coba lagi.",
    "auth/operation-not-allowed": "TOTP belum diaktifkan pada Firebase Authentication with Identity Platform.",
    "auth/unsupported-first-factor": "Metode login akun ini belum mendukung TOTP MFA.",
    "auth/admin-email-not-verified": "Email admin belum terverifikasi. Verifikasi email akun di Firebase Authentication terlebih dahulu.",
    "auth/admin-access-denied": "Akun ini belum memiliki akses admin.",
    "auth/admin-session-missing": "Sesi admin berakhir. Silakan masuk ulang.",
    "auth/admin-totp-already-enrolled": "Authenticator sudah terdaftar. Masuk ulang menggunakan kode 6 digit.",
    "auth/invalid-verification-code": "Kode Authenticator salah. Gunakan kode 6 digit terbaru.",
    "auth/code-expired": "Kode Authenticator sudah berganti. Masukkan kode terbaru.",
    "auth/invalid-multi-factor-session": "Sesi MFA berakhir. Silakan mulai login kembali.",
    "auth/multi-factor-info-not-found": "Authenticator akun tidak ditemukan. Hubungi pengelola Firebase untuk pemulihan.",
    "auth/requires-recent-login": "Sesi terlalu lama. Silakan masuk ulang sebelum mengaktifkan MFA.",
    "auth/maximum-second-factor-count-exceeded": "Batas faktor keamanan akun sudah tercapai.",
    "auth/second-factor-already-in-use": "Authenticator tersebut sudah terdaftar pada akun ini.",
  };

  if (messages[code]) return messages[code];
  if (error?.message && code.startsWith("auth/admin-")) return error.message;
  if (phase === "totp") return "Kode tidak dapat diverifikasi. Gunakan kode terbaru lalu coba lagi.";
  if (phase === "enrollment") {
    return "TOTP belum dapat didaftarkan. Pastikan Identity Platform dan provider TOTP sudah aktif.";
  }
  return "Login admin gagal. Silakan coba lagi.";
}

function signInCustomerWithToken(customToken) {
  return signInWithCustomToken(auth, customToken);
}

function signOutAdmin() {
  return signOut(auth);
}

export {
  auth,
  adminSessionFromToken,
  getAdminSessionStatus,
  resolveAdminAccess,
  resolveAdminClaim,
  assertAdminAccess,
  subscribeToAdminAuth,
  signInAdmin,
  beginAdminSignIn,
  completeAdminTotpSignIn,
  sendAdminEmailVerification,
  refreshAdminEmailVerification,
  beginAdminTotpEnrollment,
  completeAdminTotpEnrollment,
  adminAuthMessage,
  signInCustomerWithToken,
  signOutAdmin,
};
