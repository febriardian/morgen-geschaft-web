import crypto from "node:crypto";

const SUPPORTED_EVENTS = new Set(["order.status", "order.waybill_id", "order.price"]);
const PROCESSING_STATUSES = new Set(["confirmed", "scheduled", "allocated", "picking_up"]);
const SHIPPED_STATUSES = new Set(["picked", "in_transit", "dropping_off"]);
const SHIPPING_PROBLEM_STATUSES = new Set([
  "on_hold",
  "return_in_transit",
  "returned",
  "rejected",
  "courier_not_found",
  "cancelled",
  "disposed",
]);
const TERMINAL_ORDER_STATUSES = new Set(["expired", "failed", "cancelled", "delivered"]);

export function safeBiteshipString(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeBiteshipStatus(value) {
  return safeBiteshipString(value, 80)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

export function mapBiteshipStatusToOrderStatus(currentStatus, biteshipStatus) {
  const current = safeBiteshipString(currentStatus, 40).toLowerCase() || "pending";
  const shipping = normalizeBiteshipStatus(biteshipStatus);

  if (TERMINAL_ORDER_STATUSES.has(current)) return current;
  if (["pending", "expired", "failed", "cancelled"].includes(current)) return current;

  if (shipping === "delivered") return "delivered";
  if (SHIPPED_STATUSES.has(shipping)) return "shipped";
  if (PROCESSING_STATUSES.has(shipping)) {
    if (current === "shipped") return "shipped";
    return current === "paid" || current === "processing" ? "processing" : current;
  }

  // Masalah pengiriman disimpan pada shippingStatus, tetapi tidak boleh
  // mengubah order yang sudah dibayar menjadi cancelled secara otomatis.
  if (SHIPPING_PROBLEM_STATUSES.has(shipping)) return current;
  return current;
}

export function timingSafeTokenEqual(provided, expected) {
  const actualBuffer = Buffer.from(safeBiteshipString(provided, 2000));
  const expectedBuffer = Buffer.from(safeBiteshipString(expected, 2000));
  if (actualBuffer.length === 0 || actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function getBiteshipWebhookToken(req) {
  const authorization = safeBiteshipString(
    req.get?.("authorization") || req.headers?.authorization,
    2200,
  );
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";

  let basicPassword = "";
  if (/^Basic\s+/i.test(authorization)) {
    try {
      const decoded = Buffer.from(
        authorization.replace(/^Basic\s+/i, ""),
        "base64",
      ).toString("utf8");
      basicPassword = decoded.includes(":")
        ? decoded.slice(decoded.indexOf(":") + 1)
        : decoded;
    } catch {
      basicPassword = "";
    }
  }

  return [
    req.get?.("x-biteship-webhook-secret"),
    req.get?.("x-webhook-token"),
    bearer,
    basicPassword,
    req.query?.token,
  ]
    .map((value) => safeBiteshipString(value, 2000))
    .find(Boolean) || "";
}

export function verifyBiteshipWebhookRequest(req) {
  const expected = safeBiteshipString(process.env.BITESHIP_WEBHOOK_SECRET, 2000);
  if (!expected) return { ok: false, reason: "missing_configuration" };
  const provided = getBiteshipWebhookToken(req);
  return timingSafeTokenEqual(provided, expected)
    ? { ok: true, reason: "ok" }
    : { ok: false, reason: "invalid_token" };
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

export function validateBiteshipWebhookPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Payload harus berupa objek JSON." };
  }

  const event = safeBiteshipString(body.event, 80);
  const biteshipOrderId = safeBiteshipString(body.order_id, 160);
  if (!SUPPORTED_EVENTS.has(event)) {
    return { ok: false, error: "Event webhook tidak didukung." };
  }
  if (!biteshipOrderId) {
    return { ok: false, error: "order_id Biteship wajib tersedia." };
  }

  return {
    ok: true,
    payload: {
      event,
      biteshipOrderId,
      referenceId: safeBiteshipString(body.reference_id, 100),
      status: normalizeBiteshipStatus(body.status),
      trackingId: safeBiteshipString(body.courier_tracking_id, 160),
      waybillId: safeBiteshipString(body.courier_waybill_id, 160),
      courierCompany: safeBiteshipString(body.courier_company, 80).toLowerCase(),
      courierType: safeBiteshipString(body.courier_type, 80),
      courierDriverName: safeBiteshipString(body.courier_driver_name, 120),
      courierDriverPhone: safeBiteshipString(body.courier_driver_phone, 50),
      courierDriverPhotoUrl: safeBiteshipString(body.courier_driver_photo_url, 1000),
      courierDriverPlateNumber: safeBiteshipString(body.courier_driver_plate_number, 50),
      courierLink: safeBiteshipString(body.courier_link, 1000),
      orderPrice: optionalNumber(body.order_price ?? body.price),
      shipmentFee: optionalNumber(body.shipment_fee ?? body.shippment_fee),
    },
  };
}
