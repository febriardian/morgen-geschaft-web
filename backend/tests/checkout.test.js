import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// ===========================================================================
// Unit tests untuk logika bisnis checkout
// Jalankan: node --test __tests__/checkout.test.js
// ===========================================================================

import { calculateCouponDiscount as calculateDiscount, calculateOrderTotal, normalizeRequestedItems } from "../src/services/pricing.js";
import { verifyMidtransSignature } from "../src/utils/security.js";


// ===========================================================================
// Tests
// ===========================================================================

describe("calculateDiscount", () => {
  it("should apply percent discount correctly", () => {
    const coupon = { type: "percent", value: 10, minOrder: 50000 };
    assert.equal(calculateDiscount(coupon, 100000), 10000);
  });

  it("should apply fixed discount correctly", () => {
    const coupon = { type: "fixed", value: 5000, minOrder: 0 };
    assert.equal(calculateDiscount(coupon, 30000), 5000);
  });

  it("should not exceed subtotal", () => {
    const coupon = { type: "fixed", value: 99999, minOrder: 0 };
    assert.equal(calculateDiscount(coupon, 26000), 26000);
  });

  it("should return 0 if subtotal below minOrder", () => {
    const coupon = { type: "percent", value: 10, minOrder: 50000 };
    assert.equal(calculateDiscount(coupon, 30000), 0);
  });

  it("should return 0 if coupon is null", () => {
    assert.equal(calculateDiscount(null, 100000), 0);
  });

  it("should round percent discount to integer", () => {
    const coupon = { type: "percent", value: 15, minOrder: 0 };
    // 15% of 26000 = 3900 (exact)
    assert.equal(calculateDiscount(coupon, 26000), 3900);
    // 15% of 30000 = 4500 (exact)
    assert.equal(calculateDiscount(coupon, 30000), 4500);
  });
});


describe("calculateOrderTotal", () => {
  const sampleItems = [
    { id: "p1", name: "Face Wash", price: 26000, qty: 2 },
    { id: "p9", name: "Serum", price: 30000, qty: 1 },
  ];

  it("should calculate subtotal from items", () => {
    const result = calculateOrderTotal(sampleItems, 0, 0);
    assert.equal(result.subtotal, 82000); // 26000*2 + 30000
  });

  it("should subtract discount from subtotal", () => {
    const result = calculateOrderTotal(sampleItems, 5000, 0);
    assert.equal(result.total, 77000);
  });

  it("should add shipping fee", () => {
    const result = calculateOrderTotal(sampleItems, 0, 15000);
    assert.equal(result.total, 97000);
  });

  it("should not allow negative discount", () => {
    const result = calculateOrderTotal(sampleItems, -5000, 0);
    assert.equal(result.discountAmount, 0);
    assert.equal(result.total, 82000);
  });

  it("should not allow discount exceeding subtotal", () => {
    const result = calculateOrderTotal(sampleItems, 999999, 0);
    assert.equal(result.discountAmount, 82000);
    assert.equal(result.total, 0);
  });

  it("should handle single item", () => {
    const result = calculateOrderTotal([{ id: "p8", price: 26000, qty: 1 }], 0, 9000);
    assert.equal(result.total, 35000);
  });
});


describe("Midtrans signature verification", () => {
  const serverKey = "Mid-server-TEST123";

  it("should verify valid signature", () => {
    const orderId = "MG-20260720-001";
    const statusCode = "200";
    const grossAmount = "82000.00";
    const signature = crypto.createHash("sha512")
      .update(orderId + statusCode + grossAmount + serverKey)
      .digest("hex");

    assert.equal(verifyMidtransSignature(orderId, statusCode, grossAmount, serverKey, signature), true);
  });

  it("should reject tampered signature", () => {
    assert.equal(
      verifyMidtransSignature("MG-001", "200", "82000.00", serverKey, "fakesignature123"),
      false
    );
  });

  it("should reject if amount is changed", () => {
    const orderId = "MG-001";
    const signature = crypto.createHash("sha512")
      .update(orderId + "200" + "82000.00" + serverKey)
      .digest("hex");

    // Attacker tries to change amount
    assert.equal(
      verifyMidtransSignature(orderId, "200", "1.00", serverKey, signature),
      false
    );
  });
});


describe("Input validation edge cases", () => {
  it("should handle empty items array", () => {
    const result = calculateOrderTotal([], 0, 0);
    assert.equal(result.subtotal, 0);
    assert.equal(result.total, 0);
  });

  it("should handle zero quantity", () => {
    const result = calculateOrderTotal([{ price: 26000, qty: 0 }], 0, 0);
    assert.equal(result.subtotal, 0);
  });

  it("should handle NaN shipping", () => {
    const result = calculateOrderTotal([{ price: 26000, qty: 1 }], 0, NaN);
    assert.equal(result.shipping, 0);
    assert.equal(result.total, 26000);
  });
});


describe("normalizeRequestedItems", () => {
  it("should merge duplicate product ids", () => {
    assert.deepEqual(
      normalizeRequestedItems([{ id: "p1", qty: 2 }, { id: "p1", qty: 3 }]),
      [{ id: "p1", qty: 5, name: "p1" }]
    );
  });

  it("should reject invalid quantities and cap abusive totals", () => {
    assert.deepEqual(
      normalizeRequestedItems([{ id: "p1", qty: -1 }, { id: "p2", qty: 999 }]),
      [{ id: "p2", qty: 50, name: "p2" }]
    );
  });
});
