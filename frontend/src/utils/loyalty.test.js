import { describe, expect, it } from "vitest";
import {
  estimatedPointsEarned,
  maximumRedeemablePoints,
  pointRedemptionValue,
} from "./loyalty.js";

describe("customer loyalty calculations", () => {
  it("values each point at Rp100 with a 10-point minimum", () => {
    expect(pointRedemptionValue(10)).toBe(1_000);
    expect(pointRedemptionValue(12)).toBe(1_200);
    expect(pointRedemptionValue(9)).toBe(0);
  });

  it("caps redemptions at 20% of product subtotal and the available balance", () => {
    expect(maximumRedeemablePoints(135_000, 999)).toBe(270);
    expect(maximumRedeemablePoints(135_000, 12)).toBe(12);
  });

  it("earns points only from net product spend after every discount", () => {
    expect(estimatedPointsEarned({
      subtotal: 135_000,
      couponDiscount: 15_000,
      pointDiscount: 1_200,
      referralDiscount: 10_000,
    })).toBe(10);
  });
});
