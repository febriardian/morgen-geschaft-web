import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveCheckoutToken,
  generateSecureOrderId,
  hashOpaqueToken,
  isValidReferralCode,
  isSecureOrderId,
  isValidIdempotencyKey,
  normalizeReferralCode,
  verifyOpaqueToken,
} from "../src/utils/customerSecurity.js";
import { loyaltyRedemptionValue, LOYALTY_RULES, maximumRedeemablePoints } from "../src/services/loyalty.js";

const testEnv = { CUSTOMER_AUTH_SECRET: "a".repeat(64) };

describe("secure customer order access", () => {
  it("creates 128-bit non-sequential order IDs", () => {
    const first = generateSecureOrderId();
    const second = generateSecureOrderId();
    assert.match(first, /^MG-[A-F0-9]{32}$/);
    assert.equal(isSecureOrderId(first), true);
    assert.notEqual(first, second);
  });

  it("accepts only sufficiently long idempotency keys", () => {
    assert.equal(isValidIdempotencyKey("a".repeat(32)), true);
    assert.equal(isValidIdempotencyKey("short"), false);
    assert.equal(isValidIdempotencyKey("a".repeat(129)), false);
  });

  it("accepts only deterministic Morgen referral codes", () => {
    assert.equal(normalizeReferralCode(" mg4ef1cf80 "), "MG4EF1CF80");
    assert.equal(isValidReferralCode("MG4EF1CF80"), true);
    assert.equal(isValidReferralCode("MG-4EF1CF80"), true);
    assert.equal(isValidReferralCode("MG4EF1CF8Z"), false);
  });

  it("derives purpose-bound access tokens and verifies only the correct value", () => {
    const key = "b".repeat(32);
    const access = deriveCheckoutToken(key, "customer-access", testEnv);
    const cancel = deriveCheckoutToken(key, "customer-cancel", testEnv);
    assert.notEqual(access, cancel);
    const hash = hashOpaqueToken(access);
    assert.equal(verifyOpaqueToken(access, hash), true);
    assert.equal(verifyOpaqueToken(cancel, hash), false);
  });
});

describe("approved loyalty rules", () => {
  it("uses the approved earning and referral values", () => {
    assert.deepEqual(LOYALTY_RULES, {
      spendPerPoint: 10_000,
      pointValue: 100,
      minimumRedemptionPoints: 10,
      maximumPointDiscountRate: 0.2,
      referralReward: 10_000,
      referralMinimumSpend: 100_000,
    });
  });

  it("redeems points from the approved 10-point minimum", () => {
    assert.equal(loyaltyRedemptionValue(10), 1_000);
    assert.equal(loyaltyRedemptionValue(125), 12_500);
    assert.equal(loyaltyRedemptionValue(9), -1);
    assert.equal(loyaltyRedemptionValue(0), 0);
  });

  it("caps the point discount at 20% of product subtotal", () => {
    assert.equal(maximumRedeemablePoints(135_000, 999), 270);
    assert.equal(maximumRedeemablePoints(135_000, 12), 12);
    assert.equal(maximumRedeemablePoints(49_999, 100), 99);
  });
});
