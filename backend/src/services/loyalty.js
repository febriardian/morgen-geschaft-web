import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../config/firebaseAdmin.js";
import {
  createReferralCode,
  isValidReferralCode,
  normalizeReferralCode,
} from "../utils/customerSecurity.js";
import { log } from "./logger.js";

export const LOYALTY_RULES = Object.freeze({
  spendPerPoint: 10_000,
  pointValue: 100,
  minimumRedemptionPoints: 10,
  maximumPointDiscountRate: 0.2,
  referralReward: 10_000,
  referralMinimumSpend: 100_000,
});

function rewardTransactionRef(db, customerUid, orderId, type) {
  return db.collection("rewardTransactions").doc(`${orderId}__${type}__${customerUid}`);
}

function rewardTransactionData({
  customerUid,
  orderId,
  type,
  points = 0,
  referralCredit = 0,
  value = 0,
  status = "completed",
  createdAt,
}) {
  return {
    customerUid,
    orderId,
    type,
    points: Math.trunc(Number(points) || 0),
    referralCredit: Math.trunc(Number(referralCredit) || 0),
    value: Math.trunc(Number(value) || 0),
    status,
    createdAt,
    updatedAt: createdAt,
  };
}

export async function ensureCustomerProfile(uid, email, options = {}) {
  const db = getAdminDb();
  const customerRef = db.collection("customerProfiles").doc(uid);
  const referralCode = createReferralCode(uid);
  const invitedByCode = normalizeReferralCode(options.referralCode);
  const now = new Date().toISOString();
  let profileCreated = false;
  let referralApplied = false;
  let referralStatus = invitedByCode ? "existing_account" : "none";

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(customerRef);
    if (snapshot.exists) {
      tx.set(customerRef, { email, updatedAt: now }, { merge: true });
      if (snapshot.data()?.referredByUid) referralStatus = "already_bound";
      return;
    }

    let referrerUid = "";
    if (invitedByCode) {
      if (!isValidReferralCode(invitedByCode)) {
        const error = new Error("Kode referral tidak valid.");
        error.code = "INVALID_REFERRAL_CODE";
        throw error;
      }
      const referredCodeSnapshot = await tx.get(
        db.collection("referralCodes").doc(invitedByCode)
      );
      referrerUid = referredCodeSnapshot.exists
        ? String(referredCodeSnapshot.data()?.uid || "")
        : "";
      if (!referrerUid) {
        const error = new Error("Kode referral tidak valid.");
        error.code = "INVALID_REFERRAL_CODE";
        throw error;
      }
      if (referrerUid === uid) {
        const error = new Error("Kode referral sendiri tidak dapat digunakan.");
        error.code = "SELF_REFERRAL_CODE";
        throw error;
      }
    }

    profileCreated = true;
    referralApplied = Boolean(referrerUid);
    referralStatus = referralApplied ? "applied" : "none";
    tx.create(customerRef, {
      uid,
      email,
      referralCode,
      referredByUid: referrerUid,
      referredByCode: referralApplied ? invitedByCode : "",
      referralBoundAt: referralApplied ? now : "",
      points: 0,
      referralCredit: 0,
      paidOrders: 0,
      lifetimeSpend: 0,
      addresses: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.set(db.collection("referralCodes").doc(referralCode), { uid, createdAt: now });
  });

  const saved = await customerRef.get();
  return {
    uid,
    ...saved.data(),
    profileCreated,
    referralApplied,
    referralStatus,
  };
}

export function loyaltyRedemptionValue(points) {
  const normalized = Math.max(0, Math.floor(Number(points) || 0));
  if (normalized === 0) return 0;
  if (normalized < LOYALTY_RULES.minimumRedemptionPoints) return -1;
  return normalized * LOYALTY_RULES.pointValue;
}

export function maximumRedeemablePoints(subtotal, availablePoints = Number.MAX_SAFE_INTEGER) {
  const normalizedSubtotal = Math.max(0, Math.floor(Number(subtotal) || 0));
  const normalizedAvailable = Math.max(0, Math.floor(Number(availablePoints) || 0));
  const maximumDiscount = Math.floor(normalizedSubtotal * LOYALTY_RULES.maximumPointDiscountRate);
  return Math.max(0, Math.min(
    normalizedAvailable,
    Math.floor(maximumDiscount / LOYALTY_RULES.pointValue),
  ));
}

export function reserveRewardTransactions(tx, db, {
  customerUid,
  orderId,
  points = 0,
  pointValue = 0,
  referralCredit = 0,
  createdAt,
}) {
  if (points > 0) {
    tx.set(rewardTransactionRef(db, customerUid, orderId, "points_redeemed"), rewardTransactionData({
      customerUid,
      orderId,
      type: "points_redeemed",
      points: -points,
      value: -pointValue,
      status: "pending",
      createdAt,
    }));
  }
  if (referralCredit > 0) {
    tx.set(rewardTransactionRef(db, customerUid, orderId, "referral_redeemed"), rewardTransactionData({
      customerUid,
      orderId,
      type: "referral_redeemed",
      referralCredit: -referralCredit,
      value: -referralCredit,
      status: "pending",
      createdAt,
    }));
  }
}

export async function releaseLoyaltyReservation(db, order) {
  const points = Math.max(0, Math.floor(Number(order?.loyaltyPointsRedeemed) || 0));
  const referralCredit = Math.max(0, Math.floor(Number(order?.referralCreditRedeemed) || 0));
  if (!order?.customerUid || (points === 0 && referralCredit === 0) || order.loyaltyProcessed || order.loyaltyReservationReleased) return;
  const orderRef = db.collection("orders").doc(order.orderId);
  const customerRef = db.collection("customerProfiles").doc(order.customerUid);
  await db.runTransaction(async (tx) => {
    const [freshOrder, customer] = await Promise.all([tx.get(orderRef), tx.get(customerRef)]);
    if (!freshOrder.exists || !customer.exists) return;
    const data = freshOrder.data();
    if (data.loyaltyProcessed || data.loyaltyReservationReleased) return;
    tx.update(customerRef, {
      points: FieldValue.increment(points),
      referralCredit: FieldValue.increment(referralCredit),
      updatedAt: new Date().toISOString(),
    });
    const now = new Date().toISOString();
    if (points > 0) {
      tx.set(rewardTransactionRef(db, order.customerUid, order.orderId, "points_redeemed"), {
        status: "cancelled",
        updatedAt: now,
      }, { merge: true });
      tx.set(rewardTransactionRef(db, order.customerUid, order.orderId, "points_restored"), rewardTransactionData({
        customerUid: order.customerUid,
        orderId: order.orderId,
        type: "points_restored",
        points,
        value: points * LOYALTY_RULES.pointValue,
        createdAt: now,
      }));
    }
    if (referralCredit > 0) {
      tx.set(rewardTransactionRef(db, order.customerUid, order.orderId, "referral_redeemed"), {
        status: "cancelled",
        updatedAt: now,
      }, { merge: true });
      tx.set(rewardTransactionRef(db, order.customerUid, order.orderId, "referral_restored"), rewardTransactionData({
        customerUid: order.customerUid,
        orderId: order.orderId,
        type: "referral_restored",
        referralCredit,
        value: referralCredit,
        createdAt: now,
      }));
    }
    tx.update(orderRef, { loyaltyReservationReleased: true, updatedAt: now });
  });
}

export async function applyPaidOrderBenefits(orderId) {
  const db = getAdminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const firstRead = await orderRef.get();
  if (!firstRead.exists) return;
  const initialOrder = firstRead.data();
  if (!initialOrder.customerUid || initialOrder.loyaltyProcessed) return;

  const customerRef = db.collection("customerProfiles").doc(initialOrder.customerUid);
  const referrerRef = initialOrder.referrerUid
    ? db.collection("customerProfiles").doc(initialOrder.referrerUid)
    : null;

  await db.runTransaction(async (tx) => {
    const reads = [tx.get(orderRef), tx.get(customerRef)];
    if (referrerRef) reads.push(tx.get(referrerRef));
    const [orderSnapshot, customerSnapshot, referrerSnapshot] = await Promise.all(reads);
    if (!orderSnapshot.exists || !customerSnapshot.exists) return;

    const order = orderSnapshot.data();
    const customer = customerSnapshot.data();
    if (order.loyaltyProcessed || order.status !== "paid") return;

    const amount = Math.max(0, Number(order.amount || 0));
    const rewardableSpend = Math.max(0, Number(order.subtotal || 0) - Number(order.discount || 0));
    const pointsEarned = Math.floor(rewardableSpend / LOYALTY_RULES.spendPerPoint);
    const firstPaidOrder = Math.max(0, Number(customer.paidOrders || 0)) === 0;
    const referralEligible = Boolean(
      firstPaidOrder &&
      referrerRef &&
      referrerSnapshot?.exists &&
      order.referrerUid !== order.customerUid &&
      rewardableSpend >= LOYALTY_RULES.referralMinimumSpend
    );

    const customerUpdate = {
      points: FieldValue.increment(pointsEarned),
      lifetimePointsEarned: FieldValue.increment(pointsEarned),
      paidOrders: FieldValue.increment(1),
      lifetimeSpend: FieldValue.increment(amount),
      updatedAt: new Date().toISOString(),
    };
    const now = new Date().toISOString();
    if (Number(order.loyaltyPointsRedeemed || 0) > 0) {
      tx.set(rewardTransactionRef(db, order.customerUid, orderId, "points_redeemed"), {
        status: "completed",
        updatedAt: now,
      }, { merge: true });
    }
    if (Number(order.referralCreditRedeemed || 0) > 0) {
      tx.set(rewardTransactionRef(db, order.customerUid, orderId, "referral_redeemed"), {
        status: "completed",
        updatedAt: now,
      }, { merge: true });
    }
    if (pointsEarned > 0) {
      tx.set(rewardTransactionRef(db, order.customerUid, orderId, "points_earned"), rewardTransactionData({
        customerUid: order.customerUid,
        orderId,
        type: "points_earned",
        points: pointsEarned,
        value: pointsEarned * LOYALTY_RULES.pointValue,
        createdAt: now,
      }));
    }
    if (referralEligible) {
      customerUpdate.referralCredit = FieldValue.increment(LOYALTY_RULES.referralReward);
      tx.update(referrerRef, {
        referralCredit: FieldValue.increment(LOYALTY_RULES.referralReward),
        successfulReferrals: FieldValue.increment(1),
        updatedAt: now,
      });
      tx.set(rewardTransactionRef(db, order.customerUid, orderId, "referral_join_bonus"), rewardTransactionData({
        customerUid: order.customerUid,
        orderId,
        type: "referral_join_bonus",
        referralCredit: LOYALTY_RULES.referralReward,
        value: LOYALTY_RULES.referralReward,
        createdAt: now,
      }));
      tx.set(rewardTransactionRef(db, order.referrerUid, orderId, "referral_invite_bonus"), rewardTransactionData({
        customerUid: order.referrerUid,
        orderId,
        type: "referral_invite_bonus",
        referralCredit: LOYALTY_RULES.referralReward,
        value: LOYALTY_RULES.referralReward,
        createdAt: now,
      }));
    }
    tx.update(customerRef, customerUpdate);
    tx.update(orderRef, {
      loyaltyProcessed: true,
      loyaltyPointsEarned: pointsEarned,
      loyaltyRewardableSpend: rewardableSpend,
      referralRewardGranted: referralEligible,
      rewardsFinalizedAt: now,
      updatedAt: now,
    });
  }).catch((error) => {
    log("error", "loyalty", "Gagal memproses benefit pesanan", { orderId, error: error.message });
    throw error;
  });
}
