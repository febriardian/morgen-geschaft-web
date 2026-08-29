import { getAdminDb } from "../config/firebaseAdmin.js";
import { log } from "./logger.js";
import { saveNotification } from "./notifications.js";
import { sendStatusUpdateEmail } from "./email.js";
import {
  mapBiteshipStatusToOrderStatus,
  normalizeBiteshipStatus,
  safeBiteshipString,
} from "./biteshipWebhookUtils.js";

const BITESHIP_BASE = "https://api.biteship.com";
const ORDER_ID_PATTERN = /^MG-[A-Za-z0-9-]{8,64}$/;

function authorizationHeader(apiKey) {
  const clean = safeBiteshipString(apiKey, 2000);
  if (!clean) return "";
  return /^Bearer\s/i.test(clean) ? clean : `Bearer ${clean}`;
}

async function findByField(db, field, value) {
  if (!value) return null;
  const snap = await db.collection("orders").where(field, "==", value).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

async function retrieveBiteshipOrder(biteshipOrderId) {
  const apiKey = safeBiteshipString(process.env.BITESHIP_API_KEY, 2200);
  if (!apiKey || !biteshipOrderId) return null;

  try {
    const response = await fetch(`${BITESHIP_BASE}/v1/orders/${encodeURIComponent(biteshipOrderId)}`, {
      headers: { Authorization: authorizationHeader(apiKey) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      log("warn", "biteship-webhook", "Gagal mengambil detail order Biteship", {
        biteshipOrderId,
        status: response.status,
      });
      return null;
    }
    return data;
  } catch (error) {
    log("warn", "biteship-webhook", "Retrieve order Biteship gagal", {
      biteshipOrderId,
      error: error.message,
    });
    return null;
  }
}

async function findLocalOrder(db, payload) {
  if (ORDER_ID_PATTERN.test(payload.referenceId)) {
    const direct = await db.collection("orders").doc(payload.referenceId).get();
    if (direct.exists) return direct;
  }

  const directBiteship = await findByField(db, "biteshipOrderId", payload.biteshipOrderId);
  if (directBiteship) return directBiteship;

  const byTracking = await findByField(db, "biteshipTrackingId", payload.trackingId);
  if (byTracking) return byTracking;

  const byWaybill = await findByField(db, "trackingNumber", payload.waybillId);
  if (byWaybill) return byWaybill;

  // Payload webhook standar tidak selalu membawa reference_id. Ambil detail
  // order Biteship untuk membaca reference_id yang diset saat shipment dibuat.
  const remote = await retrieveBiteshipOrder(payload.biteshipOrderId);
  const remoteReference = safeBiteshipString(remote?.reference_id, 100);
  if (ORDER_ID_PATTERN.test(remoteReference)) {
    const direct = await db.collection("orders").doc(remoteReference).get();
    if (direct.exists) return direct;
  }

  const remoteWaybill = safeBiteshipString(remote?.courier?.waybill_id, 160);
  if (remoteWaybill) {
    const matched = await findByField(db, "trackingNumber", remoteWaybill);
    if (matched) return matched;
  }

  return null;
}

function notificationCopy(orderId, shippingStatus, trackingNumber) {
  const code = normalizeBiteshipStatus(shippingStatus);
  const trackingSuffix = trackingNumber ? ` Resi: ${trackingNumber}` : "";
  const map = {
    confirmed: [`Pengiriman ${orderId} dikonfirmasi`, `Pengiriman telah dikonfirmasi oleh Biteship.${trackingSuffix}`],
    scheduled: [`Penjemputan ${orderId} dijadwalkan`, `Kurir telah dijadwalkan untuk menjemput paket.${trackingSuffix}`],
    allocated: [`Kurir untuk ${orderId} tersedia`, `Kurir telah dialokasikan dan akan menjemput paket.${trackingSuffix}`],
    picking_up: [`Kurir menuju lokasi penjemputan`, `Kurir sedang menuju lokasi untuk menjemput pesanan ${orderId}.${trackingSuffix}`],
    picked: [`Pesanan ${orderId} sudah dijemput`, `Paket telah dijemput kurir dan mulai diproses.${trackingSuffix}`],
    in_transit: [`Pesanan ${orderId} dalam perjalanan`, `Paket sedang dalam perjalanan menuju kota tujuan.${trackingSuffix}`],
    dropping_off: [`Pesanan ${orderId} segera tiba`, `Kurir sedang mengantarkan paket ke alamat tujuan.${trackingSuffix}`],
    delivered: [`Pesanan ${orderId} telah sampai`, "Paket telah diterima. Terima kasih sudah berbelanja di Morgen Geschäft!"],
    on_hold: [`Pengiriman ${orderId} tertahan`, "Pengiriman sedang tertahan. Tim kami akan memantau pembaruannya."],
    return_in_transit: [`Pesanan ${orderId} sedang dikembalikan`, "Paket sedang dalam perjalanan kembali ke pengirim."],
    returned: [`Pesanan ${orderId} telah dikembalikan`, "Paket telah kembali ke pengirim. Hubungi admin untuk tindak lanjut."],
    rejected: [`Pengiriman ${orderId} ditolak`, "Kurir menolak pengiriman. Tim kami akan menindaklanjuti."],
    courier_not_found: [`Kurir ${orderId} tidak ditemukan`, "Biteship belum mendapatkan kurir. Tim kami akan menindaklanjuti."],
    cancelled: [`Pengiriman ${orderId} dibatalkan`, "Pengiriman dibatalkan di Biteship. Status pembayaran tidak diubah otomatis."],
    disposed: [`Pengiriman ${orderId} perlu ditinjau`, "Status paket ditandai disposed oleh kurir. Tim kami akan menindaklanjuti."],
  };
  return map[code] || [`Pembaruan pengiriman ${orderId}`, `Status pengiriman berubah menjadi ${code || "unknown"}.${trackingSuffix}`];
}

export async function processBiteshipWebhook(payload) {
  const db = getAdminDb();
  const orderSnap = await findLocalOrder(db, payload);
  if (!orderSnap) {
    log("warn", "biteship-webhook", "Order lokal tidak ditemukan", {
      biteshipOrderId: payload.biteshipOrderId,
      trackingId: payload.trackingId,
      waybillId: payload.waybillId,
    });
    return { matched: false, duplicate: false };
  }

  const orderRef = orderSnap.ref;
  const now = new Date().toISOString();
  let transactionResult = null;

  await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(orderRef);
    if (!freshSnap.exists) {
      transactionResult = { matched: false, duplicate: false };
      return;
    }

    const order = freshSnap.data();
    const currentStatus = safeBiteshipString(order.status, 40) || "pending";
    const nextStatus = payload.status
      ? mapBiteshipStatusToOrderStatus(currentStatus, payload.status)
      : currentStatus;
    const previousShippingStatus = normalizeBiteshipStatus(order.shippingStatus);
    const previousTrackingNumber = safeBiteshipString(order.trackingNumber, 160);
    const trackingNumber = payload.waybillId || previousTrackingNumber;
    const statusChanged = Boolean(payload.status && payload.status !== previousShippingStatus);
    const trackingChanged = Boolean(payload.waybillId && payload.waybillId !== previousTrackingNumber);
    const orderStatusChanged = nextStatus !== currentStatus;
    const duplicate = !statusChanged && !trackingChanged && !orderStatusChanged && order.biteshipLastEvent === payload.event;

    const updates = {
      biteshipOrderId: payload.biteshipOrderId,
      biteshipLastEvent: payload.event,
      biteshipWebhookUpdatedAt: now,
      updatedAt: now,
    };

    if (payload.trackingId) updates.biteshipTrackingId = payload.trackingId;
    if (payload.waybillId) updates.trackingNumber = payload.waybillId;
    if (payload.status) {
      updates.shippingStatus = payload.status;
      updates.shippingStatusUpdatedAt = now;
    }
    if (payload.courierCompany) updates.shippingCourier = payload.courierCompany;
    if (payload.courierType) updates.shippingService = payload.courierType;
    if (payload.courierLink) updates.trackingUrl = payload.courierLink;
    if (payload.courierDriverName) updates.courierDriverName = payload.courierDriverName;
    if (payload.courierDriverPhone) updates.courierDriverPhone = payload.courierDriverPhone;
    if (payload.courierDriverPhotoUrl) updates.courierDriverPhotoUrl = payload.courierDriverPhotoUrl;
    if (payload.courierDriverPlateNumber) updates.courierDriverPlateNumber = payload.courierDriverPlateNumber;
    if (payload.orderPrice !== null) updates.biteshipOrderPrice = payload.orderPrice;
    if (payload.shipmentFee !== null) updates.biteshipShipmentFee = payload.shipmentFee;

    if (orderStatusChanged) {
      updates.status = nextStatus;
      if (nextStatus === "shipped" && !order.shippedAt) updates.shippedAt = now;
      if (nextStatus === "delivered" && !order.deliveredAt) updates.deliveredAt = now;
    }

    if (!duplicate) {
      const history = Array.isArray(order.statusHistory) ? order.statusHistory.slice(-99) : [];
      history.push({
        source: "biteship",
        event: payload.event,
        status: payload.status || previousShippingStatus || "unknown",
        orderStatus: nextStatus,
        trackingNumber,
        courier: payload.courierCompany || order.shippingCourier || "",
        updatedAt: now,
      });
      updates.statusHistory = history;
    }

    tx.update(orderRef, updates);
    transactionResult = {
      matched: true,
      duplicate,
      orderId: freshSnap.id,
      previousOrder: order,
      previousStatus: currentStatus,
      nextStatus,
      shippingStatus: payload.status,
      trackingNumber,
      statusChanged,
      trackingChanged,
      orderStatusChanged,
    };
  });

  if (!transactionResult?.matched || transactionResult.duplicate) return transactionResult;

  const [title, body] = notificationCopy(
    transactionResult.orderId,
    transactionResult.shippingStatus,
    transactionResult.trackingNumber,
  );
  await saveNotification(
    title,
    body,
    "/id#lacak",
    "pesanan",
    transactionResult.orderId,
    { urlEn: "/en#track-order" },
  );

  if (
    transactionResult.previousOrder?.customerEmail &&
    transactionResult.orderStatusChanged &&
    ["shipped", "delivered"].includes(transactionResult.nextStatus)
  ) {
    await sendStatusUpdateEmail(
      transactionResult.previousOrder,
      transactionResult.orderId,
      transactionResult.nextStatus,
      transactionResult.trackingNumber,
    ).catch((error) => {
      log("error", "biteship-webhook", "Gagal mengirim email status pengiriman", {
        orderId: transactionResult.orderId,
        error: error.message,
      });
    });
  }

  return transactionResult;
}
