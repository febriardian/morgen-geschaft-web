import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RETURN_WINDOW_HOURS,
  customerOwnsOrder,
  getReturnEligibility,
  isRequestedReturnResolution,
  isReturnIssueType,
  parseClaimedItems,
  resolveReturnStatusTransition,
  returnRequestId,
  serializePublicReturnRequest,
} from "../src/services/returnRequests.js";

const deliveredAt = "2026-07-29T10:00:00.000Z";
const deliveredOrder = {
  status: "delivered",
  deliveredAt,
  customerPhone: "0812-3456-7890",
  amount: 150000,
  items: [
    { id: "p1", name: "Face Wash", qty: 2, price: 35000 },
    { id: "p2", name: "Serum", qty: 1, price: 80000 },
  ],
};

describe("return eligibility", () => {
  it("opens a 72-hour window after delivery", () => {
    const now = new Date(deliveredAt).getTime() + 71 * 60 * 60 * 1000;
    const result = getReturnEligibility(deliveredOrder, null, now);
    assert.equal(RETURN_WINDOW_HOURS, 72);
    assert.equal(result.eligible, true);
    assert.equal(result.reason, "eligible");
    assert.equal(result.deadline, "2026-08-01T10:00:00.000Z");
  });

  it("closes after the deadline and before delivery", () => {
    const expired = getReturnEligibility(
      deliveredOrder,
      null,
      new Date(deliveredAt).getTime() + 73 * 60 * 60 * 1000
    );
    assert.equal(expired.eligible, false);
    assert.equal(expired.reason, "window_expired");

    const notDelivered = getReturnEligibility({
      ...deliveredOrder,
      status: "shipped",
    });
    assert.equal(notDelivered.eligible, false);
    assert.equal(notDelivered.reason, "not_delivered");
  });

  it("prevents a second request for the same order", () => {
    const result = getReturnEligibility(
      deliveredOrder,
      { status: "submitted" },
      new Date(deliveredAt).getTime() + 1000
    );
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "already_submitted");
  });
});

describe("return ownership and claimed items", () => {
  it("normalizes Indonesian phone formats", () => {
    assert.equal(customerOwnsOrder(deliveredOrder, "+62 812 3456 7890"), true);
    assert.equal(customerOwnsOrder(deliveredOrder, "0812-0000-0000"), false);
  });

  it("copies only products and quantities that exist in the order", () => {
    const claimed = parseClaimedItems(
      JSON.stringify([
        { id: "p1", qty: 1 },
        { id: "p2", qty: 1 },
      ]),
      deliveredOrder.items
    );
    assert.equal(claimed.items.length, 2);
    assert.equal(claimed.items[0].orderedQty, 2);
    assert.equal(claimed.claimedAmount, 115000);
  });

  it("rejects unknown products, duplicate rows, and excess quantities", () => {
    assert.throws(
      () => parseClaimedItems([{ id: "unknown", qty: 1 }], deliveredOrder.items),
      /tidak ada pada pesanan/
    );
    assert.throws(
      () =>
        parseClaimedItems(
          [
            { id: "p1", qty: 1 },
            { id: "p1", qty: 1 },
          ],
          deliveredOrder.items
        ),
      /tidak valid/
    );
    assert.throws(
      () => parseClaimedItems([{ id: "p1", qty: 3 }], deliveredOrder.items),
      /Jumlah komplain/
    );
  });
});

describe("return workflow", () => {
  it("supports review, evidence request, approval, return, and completion", () => {
    assert.equal(resolveReturnStatusTransition("submitted", "start_review"), "reviewing");
    assert.equal(resolveReturnStatusTransition("reviewing", "request_info"), "waiting_customer");
    assert.equal(
      resolveReturnStatusTransition("waiting_customer", "customer_response"),
      "submitted"
    );
    assert.equal(resolveReturnStatusTransition("reviewing", "approve"), "approved");
    assert.equal(
      resolveReturnStatusTransition("approved", "submit_return_shipment"),
      "return_in_transit"
    );
    assert.equal(
      resolveReturnStatusTransition("return_in_transit", "mark_return_received"),
      "return_received"
    );
    assert.equal(resolveReturnStatusTransition("return_received", "complete"), "completed");
  });

  it("rejects invalid status jumps", () => {
    assert.equal(resolveReturnStatusTransition("submitted", "complete"), null);
    assert.equal(resolveReturnStatusTransition("approved", "request_info"), null);
    assert.equal(resolveReturnStatusTransition("completed", "start_review"), null);
  });

  it("accepts only supported issues and customer resolution requests", () => {
    assert.equal(isReturnIssueType("damaged_or_leaking"), true);
    assert.equal(isReturnIssueType("changed_mind"), false);
    assert.equal(isRequestedReturnResolution("refund"), true);
    assert.equal(isRequestedReturnResolution("cash"), false);
  });
});

describe("public return response", () => {
  it("keeps customer-visible progress and removes internal risk data", () => {
    const request = {
      id: returnRequestId("MG-20260729-001"),
      orderId: "MG-20260729-001",
      status: "waiting_customer",
      customerPhone: "081234567890",
      customerPhoneNormalized: "6281234567890",
      customerRiskFlag: true,
      customerRiskReason: "internal",
      internalNotes: [{ note: "private" }],
      evidence: [
        {
          url: "/uploads/photo.webp",
          storage: "local",
          publicId: "private-public-id",
          createdAt: "2026-07-30T00:00:00.000Z",
        },
      ],
      statusHistory: [
        {
          status: "waiting_customer",
          at: "2026-07-30T00:00:00.000Z",
          actor: "admin",
          admin: "admin@example.com",
          publicNote: "Tambahkan foto label produk.",
        },
      ],
    };
    const serialized = serializePublicReturnRequest(request.orderId, request);
    assert.equal(serialized.id, "RTN-20260729-001");
    assert.equal(serialized.evidence[0].url, "/uploads/photo.webp");
    assert.equal(serialized.evidence[0].publicId, undefined);
    assert.equal(serialized.statusHistory[0].note, "Tambahkan foto label produk.");
    assert.equal(serialized.statusHistory[0].admin, undefined);
    assert.equal(serialized.customerPhone, undefined);
    assert.equal(serialized.customerRiskFlag, undefined);
    assert.equal(serialized.internalNotes, undefined);
  });
});
