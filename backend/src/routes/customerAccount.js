import { Router } from "express";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { verifyCustomer } from "../middleware/auth.js";
import { ensureCustomerProfile, LOYALTY_RULES } from "../services/loyalty.js";
import { sanitizeText } from "../utils/index.js";
import { getFeatureFlags } from "../services/featureFlags.js";

const router = Router();

router.use("/api/customer", async (_req, res, next) => {
  try {
    if (!(await getFeatureFlags()).customerAccounts) {
      return res.status(503).json({ error: "Akun pelanggan sedang dinonaktifkan sementara." });
    }
    return next();
  } catch {
    return res.status(503).json({ error: "Konfigurasi fitur belum tersedia." });
  }
});

function publicAccountOrder(document) {
  const order = document.data();
  return {
    orderId: document.id,
    status: order.status || "pending",
    amount: Number(order.amount || 0),
    items: Array.isArray(order.items) ? order.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price || 0),
      qty: Number(item.qty || 0),
    })) : [],
    createdAt: order.createdAt || "",
    paidAt: order.paidAt || "",
    trackingNumber: order.trackingNumber || "",
  };
}

function publicRewardTransaction(document) {
  const transaction = document.data();
  return {
    id: document.id,
    type: String(transaction.type || ""),
    status: String(transaction.status || "completed"),
    orderId: String(transaction.orderId || ""),
    points: Math.trunc(Number(transaction.points) || 0),
    referralCredit: Math.trunc(Number(transaction.referralCredit) || 0),
    value: Math.trunc(Number(transaction.value) || 0),
    createdAt: String(transaction.createdAt || ""),
  };
}

router.get("/api/customer/account", verifyCustomer, async (req, res) => {
  const db = getAdminDb();
  const profile = await ensureCustomerProfile(req.customer.uid, req.customer.email);
  const [ordersSnapshot, rewardsSnapshot] = await Promise.all([
    db.collection("orders")
      .where("customerUid", "==", req.customer.uid)
      .limit(50)
      .get(),
    db.collection("rewardTransactions")
      .where("customerUid", "==", req.customer.uid)
      .limit(100)
      .get(),
  ]);
  const orders = ordersSnapshot.docs
    .map(publicAccountOrder)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const rewardTransactions = rewardsSnapshot.docs
    .map(publicRewardTransaction)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 50);
  return res.status(200).json({
    customer: {
      uid: req.customer.uid,
      email: req.customer.email,
      points: Number(profile.points || 0),
      referralCredit: Number(profile.referralCredit || 0),
      referralCode: profile.referralCode,
      referredByCode: profile.referredByCode || "",
      paidOrders: Number(profile.paidOrders || 0),
      lifetimePointsEarned: Number(profile.lifetimePointsEarned || 0),
      successfulReferrals: Number(profile.successfulReferrals || 0),
      addresses: Array.isArray(profile.addresses) ? profile.addresses : [],
    },
    rules: LOYALTY_RULES,
    orders,
    rewardTransactions,
  });
});

router.patch("/api/customer/account/addresses", verifyCustomer, async (req, res) => {
  const addresses = Array.isArray(req.body?.addresses) ? req.body.addresses.slice(0, 5) : null;
  if (!addresses) return res.status(400).json({ error: "Daftar alamat tidak valid." });
  const cleaned = addresses.map((address) => ({
    label: sanitizeText(address?.label || "Alamat", 40),
    recipient: sanitizeText(address?.recipient || "", 100),
    phone: String(address?.phone || "").replace(/[^0-9+]/g, "").slice(0, 16),
    address: sanitizeText(address?.address || "", 500),
    areaId: String(address?.areaId || "").slice(0, 200),
    areaName: sanitizeText(address?.areaName || "", 160),
  })).filter((address) => address.recipient && address.phone.length >= 9 && address.address.length >= 10);
  await getAdminDb().collection("customerProfiles").doc(req.customer.uid).set({
    addresses: cleaned,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return res.status(200).json({ addresses: cleaned });
});

router.get("/api/customer/notifications", verifyCustomer, async (req, res) => {
  const db = getAdminDb();
  const ordersSnapshot = await db.collection("orders").where("customerUid", "==", req.customer.uid).limit(50).get();
  const orderIds = new Set(ordersSnapshot.docs.map((document) => document.id));
  const notificationsSnapshot = await db.collection("notifications").orderBy("sentAt", "desc").limit(50).get();
  const notifications = notificationsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })).filter((notification) => {
    const category = String(notification.category || "").toLowerCase();
    const title = String(notification.title || "").trim().toLowerCase();
    const isOrder = category === "pesanan" || title.startsWith("pesanan") || title.startsWith("pembayaran");
    return !isOrder || orderIds.has(String(notification.orderId || ""));
  });
  return res.status(200).json({ notifications });
});

export default router;
