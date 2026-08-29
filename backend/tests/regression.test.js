// backend/tests/regression.test.js
// Test tambahan untuk edge case yang rawan disalahgunakan: matematika harga,
// transisi status terminal, dan cap kuantitas. Semua fungsi murni (tanpa Firebase).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeRequestedItems,
  calculateCouponDiscount,
  calculateOrderTotal,
} from "../src/services/pricing.js";
import { resolveOrderStatusTransition } from "../src/utils/security.js";

describe("calculateCouponDiscount — anti-abuse", () => {
  it("kupon persen di atas 100% dibatasi maksimum subtotal", () => {
    assert.equal(calculateCouponDiscount({ type: "percent", value: 150 }, 100000), 100000);
  });

  it("kupon fixed lebih besar dari subtotal dibatasi subtotal", () => {
    assert.equal(calculateCouponDiscount({ type: "fixed", value: 999999 }, 50000), 50000);
  });

  it("kupon nonaktif menghasilkan 0", () => {
    assert.equal(calculateCouponDiscount({ type: "fixed", value: 10000, active: false }, 50000), 0);
  });

  it("di bawah minimum order menghasilkan 0", () => {
    assert.equal(calculateCouponDiscount({ type: "fixed", value: 10000, minOrder: 100000 }, 50000), 0);
  });

  it("nilai negatif tidak pernah menambah total (>= 0)", () => {
    assert.equal(calculateCouponDiscount({ type: "fixed", value: -5000 }, 50000), 0);
    assert.equal(calculateCouponDiscount({ type: "percent", value: -20 }, 50000), 0);
  });
});

describe("calculateOrderTotal — tidak pernah negatif", () => {
  it("diskon melebihi subtotal tetap membuat total >= 0", () => {
    const items = [{ price: 20000, qty: 2 }]; // subtotal 40000
    const result = calculateOrderTotal(items, 999999, 0);
    assert.equal(result.discountAmount, 40000);
    assert.equal(result.total, 0);
  });

  it("ongkir ditambahkan dengan benar", () => {
    const items = [{ price: 10000, qty: 3 }]; // subtotal 30000
    const result = calculateOrderTotal(items, 5000, 12000);
    assert.equal(result.subtotal, 30000);
    assert.equal(result.total, 30000 - 5000 + 12000);
  });

  it("item tanpa harga/qty valid dihitung 0", () => {
    const result = calculateOrderTotal([{ price: "abc", qty: null }], 0, 0);
    assert.equal(result.subtotal, 0);
    assert.equal(result.total, 0);
  });
});

describe("normalizeRequestedItems — cap kuantitas & item", () => {
  it("kuantitas dibatasi maksimum 50 per item", () => {
    const [item] = normalizeRequestedItems([{ id: "p1", qty: 9999 }]);
    assert.equal(item.qty, 50);
  });

  it("qty dari item duplikat dijumlahkan lalu di-cap 50", () => {
    const [item] = normalizeRequestedItems([{ id: "p1", qty: 30 }, { id: "p1", qty: 40 }]);
    assert.equal(item.qty, 50);
  });

  it("item tidak valid (tanpa id / qty < 1) dibuang", () => {
    const result = normalizeRequestedItems([{ id: "", qty: 5 }, { id: "p1", qty: 0 }, { id: "p2", qty: 2 }]);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "p2");
  });

  it("jumlah item unik dibatasi maxUniqueItems", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ id: `p${i}`, qty: 1 }));
    const result = normalizeRequestedItems(many, { maxUniqueItems: 50 });
    assert.equal(result.length, 50);
  });
});

describe("resolveOrderStatusTransition — status terminal tak bisa jadi paid", () => {
  it("order expired tidak bisa transisi ke paid", () => {
    const next = resolveOrderStatusTransition("expired", "settlement");
    assert.notEqual(next, "paid");
  });

  it("order cancelled tidak bisa transisi ke paid", () => {
    const next = resolveOrderStatusTransition("cancelled", "capture");
    assert.notEqual(next, "paid");
  });

  it("order pending bisa jadi paid saat settlement", () => {
    const next = resolveOrderStatusTransition("pending", "settlement");
    assert.equal(next, "paid");
  });
});
