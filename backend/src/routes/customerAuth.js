import crypto from "node:crypto";
import { Router } from "express";
import { getAdminAuth, getAdminDb } from "../config/firebaseAdmin.js";
import {
  customerOtpRequestRateLimit,
  customerOtpVerifyRateLimit,
} from "../middleware/rateLimiter.js";
import { sendCustomerOtpEmail } from "../services/email.js";
import { ensureCustomerProfile } from "../services/loyalty.js";
import { log } from "../services/logger.js";
import {
  hashOtp,
  isValidCustomerEmail,
  isValidReferralCode,
  normalizeCustomerEmail,
  normalizeReferralCode,
  verifyOtp,
} from "../utils/customerSecurity.js";
import { getFeatureFlags } from "../services/featureFlags.js";

const router = Router();
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

router.post("/api/customer-auth/request-otp", customerOtpRequestRateLimit, async (req, res) => {
  const featureFlags = await getFeatureFlags();
  if (!featureFlags.customerAccounts) {
    return res.status(503).json({ error: "Akun pelanggan sedang dinonaktifkan sementara." });
  }
  const email = normalizeCustomerEmail(req.body?.email);
  const referralCode = normalizeReferralCode(req.body?.referralCode);
  if (!isValidCustomerEmail(email)) {
    return res.status(400).json({ error: "Alamat email tidak valid." });
  }
  if (referralCode && !featureFlags.referral) {
    return res.status(409).json({ error: "Program referral sedang dinonaktifkan." });
  }
  if (referralCode && !isValidReferralCode(referralCode)) {
    return res.status(400).json({ error: "Format kode referral tidak valid." });
  }

  const challengeId = crypto.randomUUID();
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  try {
    const db = getAdminDb();
    if (referralCode) {
      const referralSnapshot = await db.collection("referralCodes").doc(referralCode).get();
      if (!referralSnapshot.exists || !referralSnapshot.data()?.uid) {
        return res.status(400).json({ error: "Kode referral tidak ditemukan." });
      }
    }
    await db.collection("customerOtpChallenges").doc(challengeId).set({
      email,
      referralCode,
      codeHash: hashOtp(challengeId, email, code),
      attempts: 0,
      used: false,
      expiresAt,
      createdAt: now.toISOString(),
    });
    await sendCustomerOtpEmail(email, code, OTP_TTL_MINUTES);
    return res.status(200).json({ challengeId, expiresAt, message: "Kode masuk telah dikirim." });
  } catch (error) {
    log("error", "customer-auth", "Gagal mengirim OTP pelanggan", { error: error.message });
    return res.status(503).json({ error: "Kode belum dapat dikirim. Coba lagi sebentar." });
  }
});

router.post("/api/customer-auth/verify-otp", customerOtpVerifyRateLimit, async (req, res) => {
  if (!(await getFeatureFlags()).customerAccounts) {
    return res.status(503).json({ error: "Akun pelanggan sedang dinonaktifkan sementara." });
  }
  const email = normalizeCustomerEmail(req.body?.email);
  const challengeId = String(req.body?.challengeId || "").trim();
  const code = String(req.body?.code || "").replace(/\D/g, "");
  if (!isValidCustomerEmail(email) || !/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Data verifikasi tidak valid." });
  }

  try {
    const db = getAdminDb();
    const challengeRef = db.collection("customerOtpChallenges").doc(challengeId);
    const result = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(challengeRef);
      if (!snapshot.exists) return { ok: false, reason: "invalid" };
      const challenge = snapshot.data();
      const expired = new Date(challenge.expiresAt || 0).getTime() <= Date.now();
      if (challenge.used || expired || challenge.email !== email || Number(challenge.attempts || 0) >= MAX_ATTEMPTS) {
        return { ok: false, reason: expired ? "expired" : "invalid" };
      }
      if (!verifyOtp(challengeId, email, code, challenge.codeHash)) {
        tx.update(challengeRef, { attempts: Number(challenge.attempts || 0) + 1 });
        return { ok: false, reason: "invalid" };
      }
      tx.update(challengeRef, { used: true, usedAt: new Date().toISOString(), codeHash: null });
      return { ok: true, referralCode: normalizeReferralCode(challenge.referralCode) };
    });

    if (!result.ok) {
      return res.status(401).json({
        error: result.reason === "expired" ? "Kode sudah kedaluwarsa. Minta kode baru." : "Kode salah atau sudah tidak berlaku.",
      });
    }

    const auth = getAdminAuth();
    let firebaseUser;
    try {
      firebaseUser = await auth.getUserByEmail(email);
      if (!firebaseUser.emailVerified) firebaseUser = await auth.updateUser(firebaseUser.uid, { emailVerified: true });
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      firebaseUser = await auth.createUser({ email, emailVerified: true, disabled: false });
    }
    await auth.setCustomUserClaims(firebaseUser.uid, {
      ...(firebaseUser.customClaims || {}),
      customer: true,
    });
    const profile = await ensureCustomerProfile(firebaseUser.uid, email, {
      referralCode: result.referralCode || "",
    });
    const customToken = await auth.createCustomToken(firebaseUser.uid, { customer: true });
    return res.status(200).json({
      customToken,
      referralApplied: profile.referralApplied === true,
      referralStatus: profile.referralStatus || "none",
      customer: {
        uid: firebaseUser.uid,
        email,
        points: Number(profile.points || 0),
        referralCredit: Number(profile.referralCredit || 0),
        referralCode: profile.referralCode,
        referredByCode: profile.referredByCode || "",
      },
    });
  } catch (error) {
    log("error", "customer-auth", "Verifikasi OTP pelanggan gagal", { error: error.message });
    return res.status(500).json({ error: "Verifikasi belum dapat diselesaikan." });
  }
});

export default router;
