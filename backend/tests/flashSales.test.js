import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCurrentFlashSalesQuery,
  buildPotentialFlashSaleConflictsQuery,
  calculateFlashSalePrice,
  findFlashSaleConflict,
  getFlashSaleStatus,
  getProductFlashSalePrice,
  normalizeFlashSaleInput,
  resolveActiveFlashSale,
} from "../src/services/flashSales.js";

const now = new Date("2026-07-30T03:00:00.000Z").getTime();
const activeSale = {
  id: "sale-active",
  titleId: "Flash Sale Pagi",
  titleEn: "Morning Flash Sale",
  discountPercent: 20,
  productIds: ["p1", "p2"],
  startAt: "2026-07-30T02:00:00.000Z",
  endAt: "2026-07-30T04:00:00.000Z",
  status: "scheduled",
};

function createQueryRecorder() {
  const calls = [];
  const query = {
    where(...args) {
      calls.push(["where", ...args]);
      return query;
    },
    orderBy(...args) {
      calls.push(["orderBy", ...args]);
      return query;
    },
    limit(...args) {
      calls.push(["limit", ...args]);
      return query;
    },
  };
  const db = {
    collection(name) {
      calls.push(["collection", name]);
      return query;
    },
  };
  return { calls, db, query };
}

describe("flash sale Firestore queries", () => {
  it("mencari jadwal aktif lewat startAt tanpa query endAt", () => {
    const recorder = createQueryRecorder();
    const query = buildCurrentFlashSalesQuery(recorder.db, now, 20);

    assert.equal(query, recorder.query);
    assert.deepEqual(recorder.calls, [
      ["collection", "flashSales"],
      ["where", "startAt", "<=", "2026-07-30T03:00:00.000Z"],
      ["orderBy", "startAt", "desc"],
      ["limit", 20],
    ]);
  });

  it("mencari kandidat konflik dari jadwal yang mulai sebelum kandidat selesai", () => {
    const recorder = createQueryRecorder();
    buildPotentialFlashSaleConflictsQuery(recorder.db, "2026-07-30T05:00:00.000Z");

    assert.deepEqual(recorder.calls, [
      ["collection", "flashSales"],
      ["where", "startAt", "<", "2026-07-30T05:00:00.000Z"],
      ["orderBy", "startAt", "desc"],
      ["limit", 200],
    ]);
  });
});

describe("flash sale validation", () => {
  it("normalizes a valid schedule using ISO server time", () => {
    const result = normalizeFlashSaleInput({
      titleId: "  Flash Sale Pagi  ",
      titleEn: "Morning Flash Sale",
      discountPercent: 25,
      productIds: ["p1", "p1", "invalid id", "p2"],
      startAt: "2026-07-30T02:00:00.000Z",
      endAt: "2026-07-30T05:00:00.000Z",
    });

    assert.equal(result.titleId, "Flash Sale Pagi");
    assert.equal(result.discountPercent, 25);
    assert.deepEqual(result.productIds, ["p1", "p2"]);
    assert.equal(result.status, "scheduled");
  });

  it("rejects unsafe discounts, empty products, and invalid windows", () => {
    assert.throws(
      () => normalizeFlashSaleInput({ ...activeSale, discountPercent: 100 }),
      /antara 1 sampai 90/
    );
    assert.throws(
      () => normalizeFlashSaleInput({ ...activeSale, productIds: [] }),
      /minimal satu produk/
    );
    assert.throws(
      () =>
        normalizeFlashSaleInput({
          ...activeSale,
          startAt: activeSale.endAt,
          endAt: activeSale.startAt,
        }),
      /setelah waktu mulai/
    );
  });
});

describe("flash sale scheduling", () => {
  it("derives upcoming, active, ended, and stopped from server time", () => {
    assert.equal(getFlashSaleStatus(activeSale, new Date("2026-07-30T01:00:00Z")), "upcoming");
    assert.equal(getFlashSaleStatus(activeSale, now), "active");
    assert.equal(getFlashSaleStatus(activeSale, new Date("2026-07-30T04:00:00Z")), "ended");
    assert.equal(getFlashSaleStatus({ ...activeSale, status: "stopped" }, now), "stopped");
  });

  it("detects overlapping schedules and ignores stopped schedules", () => {
    const overlapping = {
      ...activeSale,
      id: "candidate",
      startAt: "2026-07-30T03:30:00.000Z",
      endAt: "2026-07-30T05:00:00.000Z",
    };
    assert.equal(findFlashSaleConflict([activeSale], overlapping)?.id, "sale-active");
    assert.equal(findFlashSaleConflict([{ ...activeSale, status: "stopped" }], overlapping), null);
  });

  it("selects only the sale active at the supplied server time", () => {
    const upcoming = {
      ...activeSale,
      id: "upcoming",
      startAt: "2026-07-31T02:00:00.000Z",
      endAt: "2026-07-31T04:00:00.000Z",
    };
    assert.equal(resolveActiveFlashSale([upcoming, activeSale], now)?.id, "sale-active");
  });
});

describe("flash sale pricing", () => {
  it("calculates and clamps sale prices", () => {
    assert.equal(calculateFlashSalePrice(26000, 20), 20800);
    assert.equal(calculateFlashSalePrice(26000, 0), 26000);
    assert.equal(calculateFlashSalePrice(10, 90), 1);
  });

  it("applies a discount only to selected products while active", () => {
    const discounted = getProductFlashSalePrice({ id: "p1", price: 26000 }, activeSale, now);
    const normal = getProductFlashSalePrice({ id: "p3", price: 26000 }, activeSale, now);
    const expired = getProductFlashSalePrice(
      { id: "p1", price: 26000 },
      activeSale,
      new Date("2026-07-30T05:00:00Z")
    );

    assert.deepEqual(discounted, {
      price: 20800,
      regularPrice: 26000,
      discountAmount: 5200,
      flashSaleId: "sale-active",
      discountPercent: 20,
    });
    assert.equal(normal.price, 26000);
    assert.equal(expired.price, 26000);
  });
});
