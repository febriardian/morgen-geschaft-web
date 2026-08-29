import test from "node:test";
import assert from "node:assert/strict";
import {
  createShippingQuoteToken,
  shippingItemsFingerprint,
  verifyShippingQuoteToken,
} from "../src/services/shippingQuote.js";

process.env.SHIPPING_QUOTE_SECRET = "test-secret-that-is-long-enough-for-hmac";

test("shipping item fingerprint is stable across item order", () => {
  const first = shippingItemsFingerprint([{ id: "p2", qty: 1 }, { id: "p1", qty: 2 }]);
  const second = shippingItemsFingerprint([{ id: "p1", qty: 2 }, { id: "p2", qty: 1 }]);
  assert.equal(first, second);
});

test("signed shipping quote verifies expected destination and cart", () => {
  const itemHash = shippingItemsFingerprint([{ id: "p1", qty: 2 }]);
  const token = createShippingQuoteToken({
    destinationAreaId: "IDNP6IDNC149IDND1490",
    destinationAreaName: "Cirebon",
    shippingFee: 18000,
    shippingCourier: "jne",
    shippingService: "reg",
    itemHash,
  });

  const quote = verifyShippingQuoteToken(token, {
    destinationAreaId: "IDNP6IDNC149IDND1490",
    itemHash,
  });

  assert.equal(quote.shippingFee, 18000);
  assert.equal(quote.shippingCourier, "jne");
  assert.equal(quote.shippingService, "reg");
});

test("signed shipping quote rejects cart or destination changes", () => {
  const itemHash = shippingItemsFingerprint([{ id: "p1", qty: 1 }]);
  const token = createShippingQuoteToken({
    destinationAreaId: "AREA-1",
    shippingFee: 0,
    itemHash,
    freeShipping: true,
  });

  assert.throws(
    () => verifyShippingQuoteToken(token, { destinationAreaId: "AREA-2", itemHash }),
    /Tujuan pengiriman berubah/,
  );
  assert.throws(
    () => verifyShippingQuoteToken(token, {
      destinationAreaId: "AREA-1",
      itemHash: shippingItemsFingerprint([{ id: "p1", qty: 2 }]),
    }),
    /Isi keranjang berubah/,
  );
});

import {
  mapBiteshipStatusToOrderStatus,
  normalizeBiteshipStatus,
  timingSafeTokenEqual,
  validateBiteshipWebhookPayload,
} from "../src/services/biteshipWebhookUtils.js";

test("Biteship status dinormalisasi dari camelCase dan snake_case", () => {
  assert.equal(normalizeBiteshipStatus("inTransit"), "in_transit");
  assert.equal(normalizeBiteshipStatus("dropping_off"), "dropping_off");
  assert.equal(normalizeBiteshipStatus("courier-not-found"), "courier_not_found");
});

test("Biteship status memajukan order tanpa menurunkan status", () => {
  assert.equal(mapBiteshipStatusToOrderStatus("paid", "confirmed"), "processing");
  assert.equal(mapBiteshipStatusToOrderStatus("processing", "picked"), "shipped");
  assert.equal(mapBiteshipStatusToOrderStatus("shipped", "delivered"), "delivered");
  assert.equal(mapBiteshipStatusToOrderStatus("shipped", "allocated"), "shipped");
  assert.equal(mapBiteshipStatusToOrderStatus("paid", "cancelled"), "paid");
});

test("Biteship webhook token dibandingkan secara aman", () => {
  assert.equal(timingSafeTokenEqual("secret-123", "secret-123"), true);
  assert.equal(timingSafeTokenEqual("secret-124", "secret-123"), false);
  assert.equal(timingSafeTokenEqual("", "secret-123"), false);
});

test("Biteship webhook payload divalidasi dan dinormalisasi", () => {
  const result = validateBiteshipWebhookPayload({
    event: "order.status",
    order_id: "biteship-123",
    status: "pickingUp",
    courier_waybill_id: "AWB-123",
  });
  assert.equal(result.ok, true);
  assert.equal(result.payload.status, "picking_up");
  assert.equal(result.payload.waybillId, "AWB-123");

  assert.equal(validateBiteshipWebhookPayload({ event: "unknown", order_id: "x" }).ok, false);
});
