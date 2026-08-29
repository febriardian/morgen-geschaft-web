// backend/tests/unit.test.js
// Unit tests untuk logic kritis: pricing, security, utils.
// Jalankan: node --test tests/unit.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  normalizeRequestedItems,
  calculateCouponDiscount,
  calculateOrderTotal,
} from "../src/services/pricing.js";

import {
  hasAdminClaim,
  hasAdminMfa,
  verifyMidtransSignature,
  paymentAmountMatches,
  resolveOrderStatusTransition,
  isValidReviewPhotoDataUrl,
} from "../src/utils/security.js";

import {
  sanitizeText,
  hashCustomerCancelToken,
  verifyCustomerCancelToken,
} from "../src/utils/index.js";

// ============================================================================
// pricing.js
// ============================================================================

describe("normalizeRequestedItems", () => {
  it("normalizes valid items", () => {
    const result = normalizeRequestedItems([
      { id: "a", qty: 2, name: "Product A" },
      { id: "b", qty: "3", name: "Product B" },
    ]);
    assert.deepStrictEqual(result, [
      { id: "a", qty: 2, name: "Product A" },
      { id: "b", qty: 3, name: "Product B" },
    ]);
  });

  it("skips invalid items (no id, zero qty, negative qty)", () => {
    const result = normalizeRequestedItems([
      { id: "", qty: 1 },
      { id: "a", qty: 0 },
      { id: "b", qty: -5 },
      { id: "c", qty: "abc" },
      { qty: 1 },
    ]);
    assert.strictEqual(result.length, 0);
  });

  it("merges duplicate ids and caps at maxQuantity", () => {
    const result = normalizeRequestedItems(
      [
        { id: "x", qty: 30 },
        { id: "x", qty: 30 },
      ],
      { maxQuantity: 50 },
    );
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].qty, 50);
  });

  it("caps unique items at maxUniqueItems", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      qty: 1,
    }));
    const result = normalizeRequestedItems(items, { maxUniqueItems: 3 });
    assert.strictEqual(result.length, 3);
  });

  it("returns empty array for non-array input", () => {
    assert.deepStrictEqual(normalizeRequestedItems(null), []);
    assert.deepStrictEqual(normalizeRequestedItems("string"), []);
    assert.deepStrictEqual(normalizeRequestedItems(undefined), []);
  });
});

describe("calculateCouponDiscount", () => {
  it("calculates percent discount", () => {
    const discount = calculateCouponDiscount(
      { type: "percent", value: 10 },
      100000,
    );
    assert.strictEqual(discount, 10000);
  });

  it("calculates fixed discount", () => {
    const discount = calculateCouponDiscount(
      { type: "fixed", value: 15000 },
      100000,
    );
    assert.strictEqual(discount, 15000);
  });

  it("caps discount at subtotal (cannot go negative)", () => {
    const discount = calculateCouponDiscount(
      { type: "fixed", value: 200000 },
      50000,
    );
    assert.strictEqual(discount, 50000);
  });

  it("returns 0 for inactive coupon", () => {
    assert.strictEqual(
      calculateCouponDiscount({ type: "fixed", value: 10000, active: false }, 100000),
      0,
    );
  });

  it("returns 0 when subtotal below minOrder", () => {
    assert.strictEqual(
      calculateCouponDiscount({ type: "percent", value: 10, minOrder: 200000 }, 100000),
      0,
    );
  });

  it("returns 0 for null/undefined coupon", () => {
    assert.strictEqual(calculateCouponDiscount(null, 100000), 0);
    assert.strictEqual(calculateCouponDiscount(undefined, 100000), 0);
  });
});

describe("calculateOrderTotal", () => {
  it("computes subtotal, discount, shipping, total correctly", () => {
    const items = [
      { price: 50000, qty: 2 },
      { price: 30000, qty: 1 },
    ];
    const result = calculateOrderTotal(items, 10000, 15000);
    assert.strictEqual(result.subtotal, 130000);
    assert.strictEqual(result.discountAmount, 10000);
    assert.strictEqual(result.shipping, 15000);
    assert.strictEqual(result.total, 135000);
  });

  it("discount cannot exceed subtotal", () => {
    const items = [{ price: 10000, qty: 1 }];
    const result = calculateOrderTotal(items, 99999, 0);
    assert.strictEqual(result.discountAmount, 10000);
    assert.strictEqual(result.total, 0);
  });

  it("handles empty items", () => {
    const result = calculateOrderTotal([], 0, 20000);
    assert.strictEqual(result.subtotal, 0);
    assert.strictEqual(result.total, 20000);
  });
});

// ============================================================================
// security.js
// ============================================================================

describe("hasAdminClaim", () => {
  it("returns true for admin: true", () => {
    assert.strictEqual(hasAdminClaim({ admin: true }), true);
  });

  it("returns false for missing or false claim", () => {
    assert.strictEqual(hasAdminClaim({ admin: false }), false);
    assert.strictEqual(hasAdminClaim({}), false);
    assert.strictEqual(hasAdminClaim(null), false);
    assert.strictEqual(hasAdminClaim(undefined), false);
  });

  it("rejects string 'true' (must be boolean)", () => {
    assert.strictEqual(hasAdminClaim({ admin: "true" }), false);
  });
});

describe("hasAdminMfa", () => {
  it("accepts only verified sessions that contain a second factor", () => {
    assert.strictEqual(hasAdminMfa({
      email_verified: true,
      firebase: { sign_in_second_factor: "totp" },
    }), true);
  });

  it("rejects missing verification or second-factor claims", () => {
    assert.strictEqual(hasAdminMfa({ email_verified: false, firebase: { sign_in_second_factor: "totp" } }), false);
    assert.strictEqual(hasAdminMfa({ email_verified: true, firebase: {} }), false);
    assert.strictEqual(hasAdminMfa({ email_verified: true }), false);
    assert.strictEqual(hasAdminMfa(null), false);
  });
});

describe("verifyMidtransSignature", () => {
  it("accepts valid SHA-512 signature", () => {
    const orderId = "ORDER-123";
    const statusCode = "200";
    const grossAmount = "150000.00";
    const serverKey = "Mid-server-test";
    const expected = crypto
      .createHash("sha512")
      .update(orderId + statusCode + grossAmount + serverKey)
      .digest("hex");

    assert.strictEqual(
      verifyMidtransSignature(orderId, statusCode, grossAmount, serverKey, expected),
      true,
    );
  });

  it("rejects tampered signature", () => {
    assert.strictEqual(
      verifyMidtransSignature("ORDER-1", "200", "100.00", "key", "deadbeef".repeat(16)),
      false,
    );
  });

  it("rejects empty params", () => {
    assert.strictEqual(verifyMidtransSignature("", "", "", "", ""), false);
    assert.strictEqual(verifyMidtransSignature(null, null, null, null, null), false);
  });
});

describe("paymentAmountMatches", () => {
  it("menerima format nominal Midtrans yang setara", () => {
    assert.strictEqual(paymentAmountMatches(120000, "120000.00"), true);
  });

  it("menolak nominal berbeda atau tidak valid", () => {
    assert.strictEqual(paymentAmountMatches(120000, "119999.00"), false);
    assert.strictEqual(paymentAmountMatches(120000, "invalid"), false);
  });
});

describe("resolveOrderStatusTransition", () => {
  it("pending → settlement = paid", () => {
    assert.strictEqual(resolveOrderStatusTransition("pending", "settlement"), "paid");
  });

  it("pending → capture = paid", () => {
    assert.strictEqual(resolveOrderStatusTransition("pending", "capture"), "paid");
  });

  it("expired → settlement = null (no resurrection)", () => {
    assert.strictEqual(resolveOrderStatusTransition("expired", "settlement"), null);
  });

  it("paid → expire = null (cannot downgrade)", () => {
    assert.strictEqual(resolveOrderStatusTransition("paid", "expire"), null);
  });

  it("pending → expire = expired", () => {
    assert.strictEqual(resolveOrderStatusTransition("pending", "expire"), "expired");
  });

  it("pending → cancel = cancelled", () => {
    assert.strictEqual(resolveOrderStatusTransition("pending", "cancel"), "cancelled");
  });

  it("pending → deny = failed", () => {
    assert.strictEqual(resolveOrderStatusTransition("pending", "deny"), "failed");
  });
});

describe("isValidReviewPhotoDataUrl", () => {
  it("accepts valid jpeg data URL", () => {
    const url = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    assert.strictEqual(isValidReviewPhotoDataUrl(url), true);
  });

  it("rejects non-image data URL", () => {
    assert.strictEqual(isValidReviewPhotoDataUrl("data:text/html;base64,abc"), false);
  });

  it("rejects oversized data URL", () => {
    const huge = "data:image/png;base64," + "A".repeat(700000);
    assert.strictEqual(isValidReviewPhotoDataUrl(huge), false);
  });

  it("rejects non-string", () => {
    assert.strictEqual(isValidReviewPhotoDataUrl(null), false);
    assert.strictEqual(isValidReviewPhotoDataUrl(123), false);
  });
});

// ============================================================================
// utils/index.js
// ============================================================================

describe("sanitizeText", () => {
  it("encodes HTML entities", () => {
    assert.strictEqual(sanitizeText("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("strips javascript: protocol", () => {
    const result = sanitizeText('javascript:alert("xss")');
    assert.ok(!result.includes("javascript:"));
  });

  it("strips inline event handlers", () => {
    const result = sanitizeText('onerror=alert(1)');
    assert.ok(!result.includes("onerror="));
  });

  it("truncates to maxLength", () => {
    const long = "a".repeat(2000);
    assert.strictEqual(sanitizeText(long, 100).length, 100);
  });

  it("returns empty string for non-string input", () => {
    assert.strictEqual(sanitizeText(null), "");
    assert.strictEqual(sanitizeText(undefined), "");
    assert.strictEqual(sanitizeText(42), "");
  });
});

describe("hashCustomerCancelToken / verifyCustomerCancelToken", () => {
  it("verify returns true for matching token", () => {
    const token = "abc123-cancel-token";
    const hash = hashCustomerCancelToken(token);
    assert.strictEqual(verifyCustomerCancelToken(token, hash), true);
  });

  it("verify returns false for wrong token", () => {
    const hash = hashCustomerCancelToken("correct-token");
    assert.strictEqual(verifyCustomerCancelToken("wrong-token", hash), false);
  });

  it("verify returns false for empty input", () => {
    assert.strictEqual(verifyCustomerCancelToken("", ""), false);
    assert.strictEqual(verifyCustomerCancelToken(null, null), false);
  });
});
