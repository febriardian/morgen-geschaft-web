import { describe, expect, it } from "vitest";
import {
  applyFlashSalePrices,
  countdownParts,
  flashSaleRemainingMs,
  isPublicFlashSaleActive,
} from "./flashSaleUtils.js";

const now = new Date("2026-07-30T03:00:00.000Z").getTime();
const sale = {
  id: "sale-1",
  titleId: "Flash Sale Pagi",
  titleEn: "Morning Flash Sale",
  discountPercent: 20,
  productIds: ["p1"],
  startAt: "2026-07-30T02:00:00.000Z",
  endAt: "2026-07-30T04:00:00.000Z",
  status: "scheduled",
  prices: [
    {
      productId: "p1",
      regularPrice: 26000,
      salePrice: 20800,
      discountAmount: 5200,
    },
  ],
};

describe("flash sale storefront pricing", () => {
  it("uses only server-provided prices while the schedule is active", () => {
    const products = [
      { id: "p1", name: "Face Wash", price: 26000 },
      { id: "p2", name: "Serum", price: 30000 },
    ];
    const result = applyFlashSalePrices(products, sale, now);

    expect(result[0].price).toBe(20800);
    expect(result[0].originalPrice).toBe(26000);
    expect(result[0].flashSale.id).toBe("sale-1");
    expect(result[1]).toBe(products[1]);
  });

  it("returns normal prices at the exact end time", () => {
    const end = new Date(sale.endAt).getTime();
    const products = [{ id: "p1", price: 26000 }];
    expect(isPublicFlashSaleActive(sale, end)).toBe(false);
    expect(applyFlashSalePrices(products, sale, end)).toBe(products);
    expect(flashSaleRemainingMs(sale, end)).toBe(0);
  });

  it("formats a stable countdown", () => {
    expect(countdownParts(90061000)).toEqual({
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
    });
  });
});
