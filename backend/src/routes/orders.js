// routes/orders.js
// Endpoints: list orders, update order, invoice PDF, cancel, payment-expire-check

import { Router } from "express";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { verifyCustomerCancelToken } from "../utils/index.js";
import { log } from "../services/logger.js";
import { optionalCustomerUser, verifyAdmin } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimiter.js";
import { handleOrderBecamePaid, releaseCouponClaim, syncPendingOrderWithMidtrans, restoreReservedStock } from "../services/orders.js";
import { cancelMidtransTransaction } from "../services/midtrans.js";
import { sendStatusUpdateEmail } from "../services/email.js";
import { saveNotification } from "../services/notifications.js";
import { generateInvoicePdf } from "../services/email/invoicePdf.js";
import {
  getReturnEligibility,
  serializePublicReturnRequest,
} from "../services/returnRequests.js";
import { verifyOpaqueToken } from "../utils/customerSecurity.js";
import { releaseLoyaltyReservation } from "../services/loyalty.js";

const router = Router();

async function customerOwnsOrder(req, order) {
  const firebaseUser = await optionalCustomerUser(req);
  if (firebaseUser?.uid && order?.customerUid === firebaseUser.uid) return true;
  const accessToken = String(req.headers["x-customer-access-token"] || req.body?.customerAccessToken || "");
  if (order?.customerAccessTokenHash) {
    return verifyOpaqueToken(accessToken, order.customerAccessTokenHash);
  }
  // Pesanan lama hanya dapat diklaim oleh akun dengan email terverifikasi yang
  // sama. Nomor telepon dan ID pesanan tidak lagi dianggap bukti kepemilikan.
  return Boolean(
    !order?.customerAccessTokenHash
    && firebaseUser?.email
    && String(order?.customerEmail || "").trim().toLowerCase() === String(firebaseUser.email).trim().toLowerCase()
  );
}

function publicOrder(orderId, order) {
  return {
    id: orderId,
    orderId,
    locale: order.locale || "id",
    status: order.status || "pending",
    transactionStatus: order.transactionStatus || "",
    paymentSessionStatus: order.paymentSessionStatus || "",
    amount: Number(order.amount || 0),
    subtotal: Number(order.subtotal || 0),
    discount: Number(order.discount || 0),
    shippingFee: Number(order.shippingFee || 0),
    shippingCourier: order.shippingCourier || "",
    shippingService: order.shippingService || "",
    destinationAreaName: order.destinationAreaName || "",
    customerName: order.customerName || "",
    address: order.address || "",
    items: Array.isArray(order.items) ? order.items : [],
    trackingNumber: order.trackingNumber || "",
    shippingStatus: order.shippingStatus || "",
    trackingUrl: order.trackingUrl || "",
    notes: order.notes || "",
    statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory : [],
    paymentStartedAt: order.paymentStartedAt || "",
    paymentExpiresAt: order.paymentExpiresAt || "",
    createdAt: order.createdAt || "",
    updatedAt: order.updatedAt || "",
    shippedAt: order.shippedAt || "",
    deliveredAt: order.deliveredAt || "",
    cancelledAt: order.cancelledAt || "",
    cancelledBy: order.cancelledBy || "",
    cancellationSource: order.cancellationSource || "",
  };
}

// POST /api/orders/lookup — secured by an opaque order token or verified account.
router.post("/api/orders/lookup", rateLimit, async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || "").trim();
    if (!/^MG-[A-Za-z0-9-]{8,64}$/.test(orderId)) {
      return res.status(400).json({ error: "ID pesanan tidak valid." });
    }

    const db = getAdminDb();
    const snap = await db.collection("orders").doc(orderId).get();
    if (!snap.exists || !(await customerOwnsOrder(req, snap.data()))) {
      return res.status(404).json({ error: "Pesanan tidak ditemukan atau akses tidak valid." });
    }

    const order = snap.data();
    const returnSnapshot = await db
      .collection("returnRequests")
      .doc(orderId)
      .get();
    const returnRequest = returnSnapshot.exists
      ? serializePublicReturnRequest(returnSnapshot.id, returnSnapshot.data())
      : null;

    return res.json({
      order: {
        ...publicOrder(snap.id, order),
        returnEligibility: getReturnEligibility(
          order,
          returnSnapshot.exists ? returnSnapshot.data() : null,
        ),
        returnRequest,
      },
    });
  } catch (error) {
    log("error", "orders", "customer lookup error", { error: error.message });
    return res.status(500).json({ error: "Gagal mengambil pesanan." });
  }
});

// FIX #11: GET /api/orders — admin list orders dengan pagination
router.get("/api/orders", verifyAdmin, async (req, res) => {
  try {
    const db = getAdminDb();
    const { status, cursor, limit: reqLimit } = req.query;
    const pageSize = Math.min(Math.max(1, parseInt(reqLimit) || 20), 100);

    let q = db.collection("orders");
    if (status) {
      q = q.where("status", "==", status);
    }
    q = q.orderBy("createdAt", "desc");
    if (cursor) {
      q = q.startAfter(cursor);
    }
    q = q.limit(pageSize);

    const snap = await q.get();
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const nextCursor = orders.length === pageSize
      ? orders[orders.length - 1].createdAt
      : null;

    return res.status(200).json({ orders, nextCursor, pageSize });
  } catch (err) {
    // Jika composite index belum ada, fallback ke JS filter
    if (err.code === 9 || err.message?.includes("index")) {
      log("warn", "orders", "Composite index belum ada, fallback ke JS filter. Buat index: status ASC, createdAt DESC");
      try {
        const db = getAdminDb();
        const { status, cursor, limit: reqLimit } = req.query;
        const pageSize = Math.min(Math.max(1, parseInt(reqLimit) || 20), 100);

        let q = db.collection("orders").orderBy("createdAt", "desc");
        if (cursor) q = q.startAfter(cursor);
        q = q.limit(pageSize * 3); // fetch more to compensate for JS filter

        const snap = await q.get();
        let orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (status) orders = orders.filter((o) => o.status === status);
        orders = orders.slice(0, pageSize);

        const nextCursor = orders.length === pageSize
          ? orders[orders.length - 1].createdAt
          : null;

        return res.status(200).json({ orders, nextCursor, pageSize });
      } catch (fallbackErr) {
        log("error", "orders", "list-orders fallback error", { error: fallbackErr.message });
        return res.status(500).json({ error: "Gagal memuat pesanan." });
      }
    }
    log("error", "orders", "list-orders error", { error: err.message });
    return res.status(500).json({ error: "Gagal memuat pesanan." });
  }
});

// PATCH /api/orders/:orderId — admin update status
router.patch("/api/orders/:orderId", verifyAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, trackingNumber, notes } = req.body;
    const allowedStatuses = ["pending", "expired", "paid", "processing", "shipped", "delivered", "cancelled"];
    if (status && !allowedStatuses.includes(status)) return res.status(400).json({ error: "Status tidak valid." });
    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
    const order = orderSnap.data();
    if (status === "cancelled" && ["paid", "processing", "shipped", "delivered"].includes(order.status)) {
      return res.status(409).json({
        error: "Pesanan berbayar tidak dapat dibatalkan dari perubahan status biasa. Selesaikan refund melalui prosedur admin terlebih dahulu.",
      });
    }
    if (status === "paid" && order.status !== "paid") {
      if (order.status !== "pending") {
        return res.status(409).json({ error: `Pesanan berstatus ${order.status} tidak dapat diubah menjadi paid.` });
      }
      const paidResult = await handleOrderBecamePaid(orderId, {
        paymentType: order.paymentMethod || "admin-confirmed",
        transactionId: order.transactionId || "",
        transactionStatus: "admin-confirmed",
        transactionTime: new Date().toISOString(),
      });
      if (!paidResult.becamePaid) {
        return res.status(409).json({ error: "Transisi pembayaran tidak dapat diselesaikan." });
      }
    }
    const updates = { updatedAt: new Date().toISOString() };
    if (status && status !== "paid") updates.status = status;
    if (trackingNumber !== undefined) updates.trackingNumber = String(trackingNumber || "").trim().slice(0, 120);
    if (notes !== undefined) updates.notes = String(notes || "").trim().slice(0, 1000);
    if (status === "shipped" && trackingNumber) updates.shippedAt = new Date().toISOString();
    if (status === "delivered") updates.deliveredAt = new Date().toISOString();

    // FIX #5: Admin cancel — restore stock
    if (status === "cancelled" && order.status !== "cancelled" && order.stockReserved) {
      await restoreReservedStock(db, order.items || []);
      updates.stockReserved = false;
    }

    await orderRef.update(updates);

    if (["expired", "cancelled"].includes(status) && order.status === "pending") {
      await releaseCouponClaim(db, order);
      const terminalOrder = await orderRef.get();
      if (terminalOrder.exists) await releaseLoyaltyReservation(db, terminalOrder.data());
    }

    if (status === "shipped" && trackingNumber && order.customerEmail) {
      sendStatusUpdateEmail(order, orderId, "shipped", trackingNumber).catch((err) => log("error", "orders", "Gagal kirim email shipped", { error: err.message }));
    }
    if (status === "delivered" && order.customerEmail) {
      sendStatusUpdateEmail(order, orderId, "delivered").catch((err) => log("error", "orders", "Gagal kirim email delivered", { error: err.message }));
    }

    const statusLabels = { paid: "dibayar", processing: "diproses", shipped: "dikirim", delivered: "sampai", cancelled: "dibatalkan" };
    if (status && status !== "paid" && statusLabels[status]) {
      saveNotification(
        `Pesanan ${orderId} ${statusLabels[status]}`,
        status === "shipped" && trackingNumber
          ? `Pesanan sedang dalam perjalanan. Resi: ${trackingNumber}`
          : status === "delivered"
          ? "Pesanan telah sampai di tujuan. Terima kasih!"
          : `Status pesanan diperbarui menjadi "${statusLabels[status]}".`,
        "/#lacak",
        "pesanan",
        orderId
      );
    }

    return res.status(200).json({ message: "Pesanan diperbarui.", orderId, ...updates });
  } catch (err) {
    log("error", "orders", "update-order error", { error: err.message });
    return res.status(500).json({ error: "Gagal memperbarui pesanan." });
  }
});

// GET /api/orders/:orderId/invoice — admin download invoice PDF
router.get("/api/orders/:orderId/invoice", verifyAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const db = getAdminDb();
    const orderSnap = await db.collection("orders").doc(orderId).get();
    if (!orderSnap.exists) return res.status(404).json({ error: "Pesanan tidak ditemukan." });

    const order = { id: orderSnap.id, ...orderSnap.data() };
    const pdfBuffer = await generateInvoicePdf(order, orderId);
    const safeFilename = `Invoice-${orderId.replace(/[^a-zA-Z0-9._-]/g, "-")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    log("error", "orders", "generate invoice PDF error", { error: error.message });
    return res.status(500).json({ error: "Gagal membuat invoice PDF." });
  }
});

// POST /api/orders/:orderId/payment-expire-check
router.post("/api/orders/:orderId/payment-expire-check", rateLimit, async (req, res) => {
  try {
    const { orderId } = req.params;
    const db = getAdminDb();
    const orderSnap = await db.collection("orders").doc(orderId).get();
    if (!orderSnap.exists || !(await customerOwnsOrder(req, orderSnap.data()))) {
      return res.status(404).json({ error: "Pesanan tidak ditemukan." });
    }
    const result = await syncPendingOrderWithMidtrans(orderId);
    if (!result.found) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
    return res.status(200).json({ orderId, ...result });
  } catch (error) {
    log("error", "orders", "payment-expire-check error", { error: error.message });
    return res.status(500).json({ error: "Gagal menyinkronkan status pembayaran." });
  }
});

// POST /api/orders/:orderId/cancel — customer cancel
router.post("/api/orders/:orderId/cancel", rateLimit, async (req, res) => {
  try {
    const { orderId } = req.params;
    const cancelToken = String(req.body?.cancelToken || "");
    if (!cancelToken) {
      return res.status(400).json({ error: "Token pembatalan tidak tersedia pada perangkat ini." });
    }

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const initialSnap = await orderRef.get();
    if (!initialSnap.exists) return res.status(404).json({ error: "Pesanan tidak ditemukan." });

    const initialOrder = initialSnap.data();
    if (!verifyCustomerCancelToken(cancelToken, initialOrder.customerCancelTokenHash)) {
      return res.status(403).json({ error: "Perangkat ini tidak memiliki izin untuk membatalkan pesanan." });
    }

    if (initialOrder.status === "cancelled") {
      const cancelledAt = initialOrder.cancelledAt || new Date().toISOString();
      if (initialOrder.cancellationSource !== "customer") {
        await orderRef.update({
          cancellationSource: "customer", cancelledBy: "customer", cancelReason: "customer_request",
          cancelledAt, customerCancelEnabled: false, customerCancelTokenHash: null, updatedAt: new Date().toISOString(),
        });
      }
      await releaseLoyaltyReservation(db, initialOrder);
      return res.status(200).json({ orderId, status: "cancelled", transactionStatus: initialOrder.transactionStatus || "cancel", cancelledAt, message: "Pesanan sudah dibatalkan." });
    }

    if (initialOrder.status !== "pending") {
      const paidStatuses = ["paid", "processing", "shipped", "delivered"];
      return res.status(409).json({
        error: paidStatuses.includes(initialOrder.status)
          ? "Pesanan sudah dibayar atau diproses. Hubungi admin untuk mengajukan pembatalan."
          : "Pesanan ini sudah tidak dapat dibatalkan.",
        status: initialOrder.status,
      });
    }

    const synced = await syncPendingOrderWithMidtrans(orderId);
    if (!synced.found) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
    if (synced.status !== "pending") {
      const paidStatuses = ["paid", "processing", "shipped", "delivered"];
      return res.status(409).json({
        error: paidStatuses.includes(synced.status)
          ? "Pembayaran sudah diterima. Hubungi admin untuk mengajukan pembatalan."
          : synced.status === "cancelled" ? "Pesanan sudah dibatalkan." : "Pesanan ini sudah tidak dapat dibatalkan.",
        status: synced.status,
      });
    }

    const midtransCancel = await cancelMidtransTransaction(orderId);
    if (!midtransCancel.ok) {
      const refreshed = await syncPendingOrderWithMidtrans(orderId);
      if (refreshed.status !== "pending") {
        return res.status(409).json({
          error: ["paid", "processing", "shipped", "delivered"].includes(refreshed.status)
            ? "Pembayaran sudah diterima. Hubungi admin untuk mengajukan pembatalan."
            : "Pesanan ini sudah tidak dapat dibatalkan.",
          status: refreshed.status,
        });
      }
      return res.status(502).json({ error: midtransCancel.message || "Gagal membatalkan sesi pembayaran di Midtrans." });
    }

    const now = new Date().toISOString();
    const updated = await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(orderRef);
      if (!freshSnap.exists) return { ok: false, reason: "not_found" };
      const freshOrder = freshSnap.data();
      if (!verifyCustomerCancelToken(cancelToken, freshOrder.customerCancelTokenHash)) return { ok: false, reason: "forbidden" };
      if (freshOrder.status === "cancelled") {
        tx.update(orderRef, { cancellationSource: "customer", cancelledBy: "customer", cancelReason: "customer_request", cancelledAt: freshOrder.cancelledAt || now, customerCancelEnabled: false, customerCancelTokenHash: null, updatedAt: now });
        return { ok: true, alreadyCancelled: true, transactionStatus: freshOrder.transactionStatus || "cancel", stockReserved: freshOrder.stockReserved };
      }
      if (freshOrder.status !== "pending") return { ok: false, reason: freshOrder.status };

      const transactionStatus = String(midtransCancel.data?.transaction_status || freshOrder.transactionStatus || "cancel").toLowerCase();
      tx.update(orderRef, {
        status: "cancelled", paymentSessionStatus: "cancelled", transactionStatus, cancellationSource: "customer",
        cancelledBy: "customer", cancelReason: "customer_request", cancelledAt: now, snapToken: null, snapRedirectUrl: null,
        customerCancelEnabled: false, customerCancelTokenHash: null, stockReserved: false, updatedAt: now,
      });
      return { ok: true, alreadyCancelled: false, transactionStatus, stockReserved: freshOrder.stockReserved, items: freshOrder.items };
    });

    if (!updated.ok) {
      if (updated.reason === "forbidden") return res.status(403).json({ error: "Token pembatalan tidak valid." });
      if (updated.reason === "not_found") return res.status(404).json({ error: "Pesanan tidak ditemukan." });
      return res.status(409).json({
        error: ["paid", "processing", "shipped", "delivered"].includes(updated.reason)
          ? "Pesanan sudah dibayar atau diproses. Hubungi admin untuk mengajukan pembatalan."
          : "Pesanan ini sudah tidak dapat dibatalkan.",
        status: updated.reason,
      });
    }

    // FIX #5: Restore reserved stock saat customer cancel
    if (updated.stockReserved && updated.items && !updated.alreadyCancelled) {
      await restoreReservedStock(db, updated.items);
    }
    const cancelledOrder = await orderRef.get();
    if (cancelledOrder.exists) await releaseLoyaltyReservation(db, cancelledOrder.data());

    saveNotification(`Pesanan ${orderId} dibatalkan`, "Pesanan dibatalkan atas permintaan pelanggan.", "/#lacak", "pesanan", orderId);
    return res.status(200).json({ orderId, status: "cancelled", transactionStatus: updated.transactionStatus || "cancel", cancelledAt: now, message: "Pesanan berhasil dibatalkan." });
  } catch (error) {
    log("error", "orders", "customer cancel order error", { error: error.message });
    return res.status(500).json({ error: "Gagal membatalkan pesanan. Coba lagi sebentar." });
  }
});

export default router;
