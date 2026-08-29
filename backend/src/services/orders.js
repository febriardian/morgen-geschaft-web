// services/orders.js
// Order lifecycle logic: sync with Midtrans, expire, handle paid transition.
// handleOrderBecamePaid is the SINGLE SOURCE OF TRUTH for paid-order processing.

import { getAdminDb } from "../config/firebaseAdmin.js";
import { FieldValue } from "firebase-admin/firestore";
import { getMidtransTransactionStatus, cancelMidtransTransaction } from "./midtrans.js";
import { sendPaidInvoiceEmailOnce, sendAdminOrderNotification } from "./email.js";
import { saveNotification } from "./notifications.js";
import { log } from "./logger.js";
import { notifyPaymentSuccess } from "./whatsapp.js";
import { trackRevenue } from "./funnelAnalytics.js";
import { applyPaidOrderBenefits, releaseLoyaltyReservation } from "./loyalty.js";
import { paymentAmountMatches } from "../utils/security.js";

/**
 * FIX #5: Restore reserved stock menggunakan FieldValue.increment (atomic).
 * Bisa dipanggil dengan order.items atau array verifiedItems.
 */
export async function restoreReservedStock(db, items) {
  if (!items || items.length === 0) return;
  const batch = db.batch();
  for (const item of items) {
    if (!item.id || !item.qty || item.qty <= 0) continue;
    const ref = db.collection("products").doc(item.id);
    batch.update(ref, { stock: FieldValue.increment(item.qty) });
  }
  try {
    await batch.commit();
    log("info", "stock", `Restored stock for ${items.length} items`);
  } catch (err) {
    log("error", "stock", "Failed to restore reserved stock", { error: err.message });
  }
}

/**
 * Lepas klaim kupon sekali-pakai agar dapat dipakai lagi setelah order
 * gagal / kedaluwarsa / dibatalkan. No-op untuk order tanpa kupon single-use.
 */
export async function releaseCouponClaim(db, order) {
  if (!order?.couponClaimId) return;
  await db.collection("couponClaims").doc(order.couponClaimId).delete().catch((err) =>
    log("warn", "orders", "Gagal melepas klaim kupon", { error: err.message, orderId: order.orderId || order.id || "" }));
}

/**
 * Shared logic: order menjadi "paid" — kirim email, notif admin.
 * FIX #5: Stok sudah direserve saat create-transaction, TIDAK dikurangi lagi di sini.
 * FIX #8: Tolak jika status bukan "pending" (expired/cancelled/failed tidak boleh jadi paid).
 */
export async function handleOrderBecamePaid(orderId, { paymentType, transactionId, transactionStatus, settlementTime, transactionTime }) {
  const db = getAdminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const now = new Date().toISOString();
  const paidAt = settlementTime || transactionTime || now;

  const becamePaid = await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(orderRef);
    if (!freshSnap.exists) return false;
    const freshOrder = freshSnap.data();

    // Sudah paid — skip (idempotent)
    if (freshOrder.status === "paid") return false;

    // FIX #8: Tolak transisi dari status terminal — order yang sudah
    // expired/cancelled/failed TIDAK boleh tiba-tiba jadi paid.
    if (["expired", "cancelled", "failed"].includes(freshOrder.status)) {
      log("warn", "orders", `Rejected paid transition for ${orderId}: status is ${freshOrder.status}`, {
        orderId, currentStatus: freshOrder.status, transactionStatus,
      });
      return false;
    }

    // FIX #5: Jika stok BELUM direserve (order lama sebelum migrasi),
    // kurangi stok di sini sebagai fallback.
    if (!freshOrder.stockReserved) {
      for (const item of freshOrder.items || []) {
        const productRef = db.collection("products").doc(item.id);
        const productSnap = await tx.get(productRef);
        if (productSnap.exists) {
          const currentStock = productSnap.data().stock || 0;
          tx.update(productRef, { stock: Math.max(0, currentStock - item.qty) });
        }
      }
    }

    tx.update(orderRef, {
      status: "paid",
      paidAt,
      paymentMethod: paymentType || freshOrder.paymentMethod || "",
      transactionId: transactionId || freshOrder.transactionId || "",
      transactionStatus: transactionStatus || "settlement",
      paymentSessionStatus: "paid",
      snapToken: null,
      snapRedirectUrl: null,
      updatedAt: now,
    });
    return true;
  });

  // Post-transaction side effects (fire-and-forget)
  const paidSnap = await orderRef.get();
  const paidOrder = paidSnap.data();

  if (paidOrder?.customerEmail) {
    try {
      await sendPaidInvoiceEmailOnce(orderId);
    } catch (error) {
      log("error", "orders", "Gagal kirim invoice PDF", { error: error.message });
    }
  }

  if (becamePaid) {
    sendAdminOrderNotification(paidOrder, orderId)
      .catch((error) => log("error", "orders", "Gagal kirim notif admin", { error: error.message }));

    // Integrasi opsional. Kegagalan WhatsApp/analytics tidak boleh
    // menggagalkan proses pembayaran yang sudah sukses.
    notifyPaymentSuccess(
      { ...paidOrder, total: paidOrder?.total || paidOrder?.amount || 0 },
      orderId,
    ).catch((error) =>
      log("warn", "orders", "Gagal kirim WhatsApp pembayaran", { error: error.message, orderId }),
    );
    trackRevenue(paidOrder?.total || paidOrder?.amount || 0, {
      heroVariant: paidOrder?.heroVariant || "",
    }).catch(() => {});
    saveNotification(
      `Pembayaran ${orderId} berhasil!`,
      "Pembayaran telah dikonfirmasi. Pesanan sedang diproses.",
      "/id#lacak",
      "pesanan",
      orderId,
      {
        titleEn: `Payment for ${orderId} was successful!`,
        bodyEn: "Payment has been confirmed. Your order is being processed.",
        urlEn: "/en#track-order",
      }
    );
  }

  // Idempotent dan tetap dicoba pada notifikasi/sinkronisasi ulang bila proses
  // reward sebelumnya sempat gagal setelah order sudah berstatus paid.
  if (paidOrder?.status === "paid" && !paidOrder.loyaltyProcessed) {
    await applyPaidOrderBenefits(orderId).catch((error) => {
      log("error", "orders", "Gagal menyelesaikan reward pesanan", { error: error.message, orderId });
    });
  }

  return { becamePaid, paidOrder };
}

export async function expireOrderIfNeeded(orderRef, orderData = null) {
  const snap = orderData ? null : await orderRef.get();
  const order = orderData || (snap?.exists ? snap.data() : null);
  if (!order || order.status !== "pending" || !order.paymentExpiresAt) return order?.status || null;

  const expiresAt = new Date(order.paymentExpiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt > Date.now()) return "pending";

  // FIX #5: Restore reserved stock saat expire
  if (order.stockReserved) {
    const db = getAdminDb();
    await restoreReservedStock(db, order.items || []);
  }

  await orderRef.update({
    status: "expired",
    paymentSessionStatus: "expired",
    transactionStatus: order.transactionStatus || "expire",
    failReason: "payment_expired",
    snapToken: null,
    snapRedirectUrl: null,
    stockReserved: false,
    expiredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await releaseCouponClaim(getAdminDb(), order);
  await releaseLoyaltyReservation(getAdminDb(), { ...order, orderId: orderRef.id });
  return "expired";
}

export async function syncPendingOrderWithMidtrans(orderId) {
  const db = getAdminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return { found: false, status: null };

  const order = orderSnap.data();
  if (order.status !== "pending") {
    return { found: true, status: order.status, transactionStatus: order.transactionStatus || "" };
  }

  let remote;
  try {
    remote = await getMidtransTransactionStatus(orderId);
  } catch (error) {
    log("warn", "orders", `Gagal sinkron status Midtrans ${orderId}`, { error: error.message });
    const fallbackStatus = await expireOrderIfNeeded(orderRef, order);
    return { found: true, status: fallbackStatus || "pending", source: "local-fallback" };
  }

  if (!remote.found) {
    const fallbackStatus = await expireOrderIfNeeded(orderRef, order);
    return { found: true, status: fallbackStatus || "pending", source: "local-fallback" };
  }

  const transactionStatus = String(remote.data.transaction_status || "").toLowerCase();
  const now = new Date().toISOString();
  const isSuccess = transactionStatus === "capture" || transactionStatus === "settlement";
  const isExpired = transactionStatus === "expire";
  const isCancelled = transactionStatus === "cancel";
  const isFailed = ["deny", "failure"].includes(transactionStatus);

  if (isSuccess) {
    if (!paymentAmountMatches(order.amount, remote.data.gross_amount)) {
      await orderRef.update({
        paymentSessionStatus: "amount_mismatch",
        manualReviewRequired: true,
        receivedGrossAmount: String(remote.data.gross_amount || ""),
        updatedAt: now,
      });
      log("warn", "orders", "Status pembayaran ditahan karena nominal tidak cocok", {
        orderId,
        expectedAmount: order.amount,
        receivedGrossAmount: remote.data.gross_amount,
      });
      return { found: true, status: "pending", transactionStatus, source: "midtrans", manualReviewRequired: true };
    }
    await handleOrderBecamePaid(orderId, {
      paymentType: remote.data.payment_type,
      transactionId: remote.data.transaction_id,
      transactionStatus,
      settlementTime: remote.data.settlement_time,
      transactionTime: remote.data.transaction_time,
    });
    return { found: true, status: "paid", transactionStatus, source: "midtrans" };
  }

  if (isExpired) {
    // FIX #5: Restore stock
    if (order.stockReserved) {
      await restoreReservedStock(db, order.items || []);
    }
    await orderRef.update({
      status: "expired",
      paymentSessionStatus: "expired",
      failReason: "payment_expired",
      transactionStatus,
      paymentMethod: remote.data.payment_type || order.paymentMethod || "",
      snapToken: null,
      snapRedirectUrl: null,
      stockReserved: false,
      expiredAt: now,
      updatedAt: now,
    });
    await releaseCouponClaim(db, order);
    await releaseLoyaltyReservation(db, { ...order, orderId });
    return { found: true, status: "expired", transactionStatus, source: "midtrans" };
  }

  if (isCancelled) {
    // FIX #5: Restore stock
    if (order.stockReserved) {
      await restoreReservedStock(db, order.items || []);
    }
    await orderRef.update({
      status: "cancelled",
      paymentSessionStatus: "cancelled",
      failReason: "payment_cancelled",
      transactionStatus,
      paymentMethod: remote.data.payment_type || order.paymentMethod || "",
      snapToken: null,
      snapRedirectUrl: null,
      stockReserved: false,
      cancellationSource: order.cancellationSource || "payment_gateway",
      cancelledBy: order.cancelledBy || "system",
      cancelledAt: order.cancelledAt || now,
      customerCancelEnabled: false,
      updatedAt: now,
    });
    await releaseCouponClaim(db, order);
    await releaseLoyaltyReservation(db, { ...order, orderId });
    return { found: true, status: "cancelled", transactionStatus, source: "midtrans" };
  }

  if (isFailed) {
    // FIX #5: Restore stock
    if (order.stockReserved) {
      await restoreReservedStock(db, order.items || []);
    }
    await orderRef.update({
      status: "failed",
      paymentSessionStatus: "failed",
      failReason: transactionStatus,
      transactionStatus,
      paymentMethod: remote.data.payment_type || order.paymentMethod || "",
      snapToken: null,
      snapRedirectUrl: null,
      stockReserved: false,
      updatedAt: now,
    });
    await releaseCouponClaim(db, order);
    await releaseLoyaltyReservation(db, { ...order, orderId });
    return { found: true, status: "failed", transactionStatus, source: "midtrans" };
  }

  const remoteExpiry = remote.data.expiry_time || remote.data?.additionalInfo?.validUpTo || "";
  const updates = {
    transactionStatus: transactionStatus || order.transactionStatus || "pending",
    paymentMethod: remote.data.payment_type || order.paymentMethod || "",
    updatedAt: now,
  };
  if (!order.paymentExpiresAt && remoteExpiry) updates.paymentExpiresAt = remoteExpiry;
  await orderRef.update(updates);

  return {
    found: true,
    status: "pending",
    transactionStatus: transactionStatus || "pending",
    paymentExpiresAt: updates.paymentExpiresAt || order.paymentExpiresAt || "",
    source: "midtrans",
  };
}

/**
 * FIX #8: expirePendingOrders sekarang juga:
 * - Restore reserved stock
 * - Cancel transaksi di Midtrans (supaya customer tidak bisa bayar setelah expire lokal)
 */
export async function expirePendingOrders(db, limit = 100) {
  const snap = await db.collection("orders").where("status", "==", "pending").limit(limit).get();
  const candidates = snap.docs.filter((document) => {
    const expiresAt = new Date(document.data().paymentExpiresAt || 0).getTime();
    return Number.isFinite(expiresAt) && expiresAt <= Date.now();
  });
  if (candidates.length === 0) return 0;

  const timestamp = new Date().toISOString();
  let expiredCount = 0;

  // Process in parallel batches of 5 to avoid overwhelming Midtrans/Firestore
  const BATCH_SIZE = 5;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (document) => {
        const order = document.data();
        const orderId = document.id;

        // FIX #8: Cancel di Midtrans dulu
        await cancelMidtransTransaction(orderId).catch((err) => {
          log("warn", "cron", `Failed to cancel Midtrans for ${orderId}`, { error: err.message });
        });

        // FIX #5: Restore reserved stock
        if (order.stockReserved) {
          await restoreReservedStock(db, order.items || []);
        }

        await document.ref.update({
          status: "expired",
          paymentSessionStatus: "expired",
          transactionStatus: order.transactionStatus || "expire",
          failReason: "payment_expired",
          snapToken: null,
          snapRedirectUrl: null,
          stockReserved: false,
          expiredAt: timestamp,
          updatedAt: timestamp,
        });

        await releaseCouponClaim(db, order);
        await releaseLoyaltyReservation(db, { ...order, orderId });
      })
    );

    for (let j = 0; j < results.length; j++) {
      if (results[j].status === "fulfilled") {
        expiredCount++;
      } else {
        log("error", "cron", `Failed to expire order ${batch[j].id}`, { error: results[j].reason?.message });
      }
    }
  }

  return expiredCount;
}
