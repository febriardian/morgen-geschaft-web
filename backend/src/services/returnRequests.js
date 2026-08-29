const RETURN_WINDOW_HOURS = 72;

const RETURN_ISSUE_TYPES = new Set([
  "damaged_or_leaking",
  "wrong_item",
  "missing_quantity",
  "expired_or_unfit",
  "seller_error",
]);

const RETURN_REQUESTED_RESOLUTIONS = new Set(["replacement", "refund"]);
const RETURN_RESOLUTIONS = new Set(["replacement", "refund"]);

const RETURN_STATUS_ACTIONS = {
  start_review: {
    from: new Set(["submitted"]),
    to: "reviewing",
  },
  request_info: {
    from: new Set(["submitted", "reviewing"]),
    to: "waiting_customer",
  },
  approve: {
    from: new Set(["submitted", "reviewing"]),
    to: "approved",
  },
  reject: {
    from: new Set(["submitted", "reviewing", "waiting_customer"]),
    to: "rejected",
  },
  customer_response: {
    from: new Set(["waiting_customer"]),
    to: "submitted",
  },
  submit_return_shipment: {
    from: new Set(["approved"]),
    to: "return_in_transit",
  },
  mark_return_received: {
    from: new Set(["return_in_transit"]),
    to: "return_received",
  },
  complete: {
    from: new Set(["approved", "return_received"]),
    to: "completed",
  },
};

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value?._seconds === "number") return value._seconds * 1000;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizePhone(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .replace(/^0/, "62");
}

function customerOwnsOrder(order, phone) {
  const expected = normalizePhone(order?.customerPhone);
  const actual = normalizePhone(phone);
  return Boolean(expected && actual && expected === actual);
}

function returnRequestId(orderId) {
  return `RTN-${String(orderId || "").replace(/^MG-/, "")}`;
}

function getReturnEligibility(order, existingRequest = null, nowMs = Date.now()) {
  const deliveredAtMs = toMillis(
    order?.deliveredAt || (order?.status === "delivered" ? order?.updatedAt : null)
  );
  const deadlineMs = deliveredAtMs ? deliveredAtMs + RETURN_WINDOW_HOURS * 60 * 60 * 1000 : 0;
  const base = {
    eligible: false,
    windowHours: RETURN_WINDOW_HOURS,
    deadline: deadlineMs ? new Date(deadlineMs).toISOString() : "",
  };

  if (existingRequest) return { ...base, reason: "already_submitted" };
  if (order?.status !== "delivered") return { ...base, reason: "not_delivered" };
  if (!deliveredAtMs) return { ...base, reason: "delivery_time_missing" };
  if (Number(nowMs) > deadlineMs) return { ...base, reason: "window_expired" };
  return { ...base, eligible: true, reason: "eligible" };
}

function parseClaimedItems(rawItems, orderItems) {
  let requested = rawItems;
  if (typeof rawItems === "string") {
    try {
      requested = JSON.parse(rawItems);
    } catch {
      throw new Error("Daftar produk bermasalah tidak valid.");
    }
  }

  if (!Array.isArray(requested) || requested.length === 0) {
    throw new Error("Pilih minimal satu produk yang bermasalah.");
  }
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    throw new Error("Produk pada pesanan tidak tersedia.");
  }

  const orderedById = new Map(
    orderItems.filter((item) => item?.id).map((item) => [String(item.id), item])
  );
  const seen = new Set();
  const selectedItems = [];

  for (const entry of requested) {
    const itemId = String(entry?.id || "").trim();
    if (!itemId || seen.has(itemId)) {
      throw new Error("Daftar produk bermasalah tidak valid.");
    }
    seen.add(itemId);

    const ordered = orderedById.get(itemId);
    if (!ordered) throw new Error("Produk yang dipilih tidak ada pada pesanan.");

    const orderedQty = Math.max(1, Math.floor(Number(ordered.qty || 1)));
    const claimedQty = Math.floor(Number(entry?.qty || 0));
    if (!Number.isFinite(claimedQty) || claimedQty < 1 || claimedQty > orderedQty) {
      throw new Error(`Jumlah komplain untuk ${ordered.name || "produk"} tidak valid.`);
    }

    const unitPrice = Math.max(0, Number(ordered.price || 0));
    selectedItems.push({
      id: itemId,
      name: String(ordered.name || "Produk").slice(0, 200),
      qty: claimedQty,
      orderedQty,
      unitPrice,
      claimedAmount: unitPrice * claimedQty,
      image: String(ordered.image || ordered.images?.[0] || "").slice(0, 1000),
    });
  }

  return {
    items: selectedItems,
    claimedAmount: selectedItems.reduce(
      (total, item) => total + Number(item.claimedAmount || 0),
      0
    ),
  };
}

function isReturnIssueType(value) {
  return RETURN_ISSUE_TYPES.has(String(value || ""));
}

function isReturnResolution(value) {
  return RETURN_RESOLUTIONS.has(String(value || ""));
}

function isRequestedReturnResolution(value) {
  return RETURN_REQUESTED_RESOLUTIONS.has(String(value || ""));
}

function resolveReturnStatusTransition(currentStatus, action) {
  const rule = RETURN_STATUS_ACTIONS[String(action || "")];
  if (!rule || !rule.from.has(String(currentStatus || ""))) return null;
  return rule.to;
}

function serializeEvidence(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence
    .filter((item) => typeof item?.url === "string" && item.url)
    .slice(0, 12)
    .map((item) => ({
      url: item.url,
      createdAt: item.createdAt || "",
      source: item.source === "customer_response" ? "customer_response" : "initial",
    }));
}

function serializePublicReturnRequest(id, request) {
  if (!request) return null;
  return {
    id: request.id || id || "",
    documentId: id || request.orderId || "",
    orderId: request.orderId || "",
    status: request.status || "submitted",
    issueType: request.issueType || "",
    description: request.description || "",
    requestedResolution: request.requestedResolution || "",
    resolution: request.resolution || "",
    selectedItems: Array.isArray(request.selectedItems) ? request.selectedItems : [],
    claimedAmount: Number(request.claimedAmount || 0),
    refundAmount: Number(request.refundAmount || 0),
    evidence: serializeEvidence(request.evidence),
    customerReplies: Array.isArray(request.customerReplies)
      ? request.customerReplies.slice(-10).map((reply) => ({
          message: reply.message || "",
          evidence: serializeEvidence(reply.evidence),
          createdAt: reply.createdAt || "",
        }))
      : [],
    latestAdminMessage: request.latestAdminMessage || "",
    returnRequired: request.returnRequired === true,
    returnInstructions: request.returnInstructions || "",
    returnShipment: request.returnShipment
      ? {
          courier: request.returnShipment.courier || "",
          trackingNumber: request.returnShipment.trackingNumber || "",
          submittedAt: request.returnShipment.submittedAt || "",
          receivedAt: request.returnShipment.receivedAt || "",
        }
      : null,
    replacementTracking: request.replacementTracking || "",
    refundReference: request.refundReference || "",
    statusHistory: Array.isArray(request.statusHistory)
      ? request.statusHistory.slice(-30).map((entry) => ({
          status: entry.status || "",
          at: entry.at || "",
          actor: entry.actor || "system",
          note: entry.publicNote || "",
        }))
      : [],
    createdAt: request.createdAt || "",
    updatedAt: request.updatedAt || "",
    completedAt: request.completedAt || "",
  };
}

export {
  RETURN_WINDOW_HOURS,
  customerOwnsOrder,
  getReturnEligibility,
  isRequestedReturnResolution,
  isReturnIssueType,
  isReturnResolution,
  normalizePhone,
  parseClaimedItems,
  resolveReturnStatusTransition,
  returnRequestId,
  serializePublicReturnRequest,
  toMillis,
};
