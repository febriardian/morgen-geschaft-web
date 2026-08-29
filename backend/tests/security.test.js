import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { sanitizeText, hashCustomerCancelToken, verifyCustomerCancelToken } from "../src/utils/index.js";
import { hasAdminClaim, hasAdminMfa, isValidReviewPhotoDataUrl, resolveOrderStatusTransition } from "../src/utils/security.js";

// ===========================================================================
// Unit tests: sanitization, admin auth logic, webhook edge cases
// Jalankan: node --test __tests__/security.test.js
// ===========================================================================

// ===========================================================================
// Sanitization Tests
// ===========================================================================
describe("sanitizeText", () => {
  it("should encode HTML tags (not strip them)", () => {
    // New behavior: tags are entity-encoded, not stripped.
    // This is MORE secure — no bypass via malformed tags.
    const result = sanitizeText("<script>alert('xss')</script>Hello");
    assert.ok(!result.includes("<script>"), "raw <script> should not appear");
    assert.ok(result.includes("&lt;script&gt;"), "should be entity-encoded");
    assert.ok(result.includes("Hello"), "should keep safe text");
    assert.ok(result.includes("&#x27;"), "should encode single quotes");
  });

  it("should neutralize img onerror via encoding", () => {
    const input = '<img src=x onerror=alert(1)>';
    const result = sanitizeText(input);
    assert.ok(!result.includes("<img"), "no raw <img tag");
    assert.ok(!result.includes("onerror="), "onerror stripped by handler regex");
  });

  it("should neutralize malformed tags (no closing >)", () => {
    // This was the bypass vector with the old regex-strip approach
    const input = '<img src=x onerror=alert(1) ';
    const result = sanitizeText(input);
    assert.ok(!result.includes("<img"), "no raw <img even without closing >");
    assert.ok(!result.includes("onerror="), "onerror stripped");
  });

  it("should strip javascript: protocol", () => {
    const result = sanitizeText('click javascript:alert(1)');
    assert.ok(!result.includes("javascript:"));
  });

  it("should strip inline event handlers", () => {
    const result = sanitizeText('text onclick=steal() more');
    assert.ok(!result.includes("onclick="));
  });

  it("should encode HTML entities", () => {
    const result = sanitizeText('a & b "e" \'f\'');
    assert.ok(result.includes("&amp;"), "should encode &");
    assert.ok(result.includes("&quot;"), "should encode double quotes");
    assert.ok(result.includes("&#x27;"), "should encode single quotes");
    const result2 = sanitizeText("2 &lt; 3");
    assert.ok(result2.includes("&amp;"), "should encode & in &lt;");
  });

  it("should not double-encode already-encoded entities", () => {
    // Key fix: &lt; should become &amp;lt; (correct: & is encoded)
    // But NOT &amp;amp;lt; (that would be triple-encoded)
    const result = sanitizeText("&lt;");
    assert.equal(result, "&amp;lt;");
  });

  it("should cap length", () => {
    const long = "a".repeat(2000);
    assert.equal(sanitizeText(long, 100).length, 100);
  });

  it("should trim whitespace", () => {
    assert.equal(sanitizeText("  hello  ", 100), "hello");
  });

  it("should return empty string for non-string input", () => {
    assert.equal(sanitizeText(null), "");
    assert.equal(sanitizeText(undefined), "");
    assert.equal(sanitizeText(123), "");
    assert.equal(sanitizeText({}), "");
  });

  it("should handle nested tags", () => {
    const result = sanitizeText("<div><span>text</span></div>");
    assert.ok(!result.includes("<"), "no raw < in output");
    assert.ok(result.includes("text"));
  });

  it("should pass through clean text unchanged", () => {
    assert.equal(sanitizeText("Hello World"), "Hello World");
  });
});

// ===========================================================================
// Customer Cancel Token Tests
// ===========================================================================
describe("Customer cancel token verification", () => {
  it("should verify matching token", () => {
    const token = crypto.randomBytes(24).toString("hex");
    const hash = hashCustomerCancelToken(token);
    assert.equal(verifyCustomerCancelToken(token, hash), true);
  });

  it("should reject wrong token", () => {
    const token = crypto.randomBytes(24).toString("hex");
    const hash = hashCustomerCancelToken(token);
    assert.equal(verifyCustomerCancelToken("wrongtoken", hash), false);
  });

  it("should reject empty token", () => {
    assert.equal(verifyCustomerCancelToken("", "somehash"), false);
    assert.equal(verifyCustomerCancelToken(null, "somehash"), false);
  });

  it("should reject empty hash", () => {
    assert.equal(verifyCustomerCancelToken("sometoken", ""), false);
    assert.equal(verifyCustomerCancelToken("sometoken", null), false);
  });
});

// ===========================================================================
// Admin Custom Claim Tests
// ===========================================================================
describe("Admin custom claim verification", () => {
  it("should accept a signed admin claim", () => {
    assert.equal(hasAdminClaim({ admin: true }), true);
  });

  it("should reject missing, false, or string claims", () => {
    assert.equal(hasAdminClaim({}), false);
    assert.equal(hasAdminClaim({ admin: false }), false);
    assert.equal(hasAdminClaim({ admin: "true" }), false);
    assert.equal(hasAdminClaim(null), false);
  });

  it("requires a verified email and a non-empty second-factor claim for admin MFA", () => {
    assert.equal(hasAdminMfa({
      email_verified: true,
      firebase: { sign_in_second_factor: "totp-factor-id" },
    }), true);
    assert.equal(hasAdminMfa({
      email_verified: false,
      firebase: { sign_in_second_factor: "totp-factor-id" },
    }), false);
    assert.equal(hasAdminMfa({ email_verified: true, firebase: {} }), false);
    assert.equal(hasAdminMfa({ email_verified: true, firebase: { sign_in_second_factor: "" } }), false);
    assert.equal(hasAdminMfa(null), false);
  });
});

// ===========================================================================
// Webhook Idempotency Edge Cases
// ===========================================================================
describe("Webhook status transitions", () => {

  it("should transition pending → paid on settlement", () => {
    assert.equal(resolveOrderStatusTransition("pending", "settlement"), "paid");
  });

  it("should transition pending → paid on capture", () => {
    assert.equal(resolveOrderStatusTransition("pending", "capture"), "paid");
  });

  it("should NOT revert paid order on expire", () => {
    assert.equal(resolveOrderStatusTransition("paid", "expire"), null);
  });

  it("should NOT revert paid order on cancel", () => {
    assert.equal(resolveOrderStatusTransition("paid", "cancel"), null);
  });

  it("should NOT revert paid order on deny", () => {
    assert.equal(resolveOrderStatusTransition("paid", "deny"), null);
  });

  it("should expire pending on expire", () => {
    assert.equal(resolveOrderStatusTransition("pending", "expire"), "expired");
  });

  it("should cancel pending on cancel", () => {
    assert.equal(resolveOrderStatusTransition("pending", "cancel"), "cancelled");
  });

  it("should fail pending on deny", () => {
    assert.equal(resolveOrderStatusTransition("pending", "deny"), "failed");
  });

  it("should handle unknown status gracefully", () => {
    assert.equal(resolveOrderStatusTransition("pending", "refund"), null);
  });
});

// ===========================================================================
// Photo Data URL Validation (replika dari testimoni endpoint)
// ===========================================================================
describe("Photo data URL validation", () => {

  it("should accept valid JPEG data URL", () => {
    assert.equal(isValidReviewPhotoDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJ=="), true);
  });

  it("should accept valid PNG data URL", () => {
    assert.equal(isValidReviewPhotoDataUrl("data:image/png;base64,iVBORw0KGgo="), true);
  });

  it("should reject SVG (XSS vector)", () => {
    assert.equal(isValidReviewPhotoDataUrl("data:image/svg+xml;base64,PHN2Zz4="), false);
  });

  it("should reject non-image data URL", () => {
    assert.equal(isValidReviewPhotoDataUrl("data:text/html;base64,PHNjcmlwdD4="), false);
  });

  it("should reject plain string", () => {
    assert.equal(isValidReviewPhotoDataUrl("not-a-data-url"), false);
  });

  it("should reject empty string", () => {
    assert.equal(isValidReviewPhotoDataUrl(""), false);
  });
});
