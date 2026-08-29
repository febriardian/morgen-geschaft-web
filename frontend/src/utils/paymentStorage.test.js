import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPaymentSession,
  getLocalOrderAccessProofs,
  getOrderAccessToken,
  saveCustomerData,
  saveOrderToLocalHistory,
  savePaymentSession,
} from "./paymentStorage.js";

describe("persistent order ownership proof", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the access token after the payment session is cleared", () => {
    saveCustomerData({ email: "buyer@example.com", phone: "08123456789" });
    saveOrderToLocalHistory("MG-ABC", { email: "buyer@example.com", phone: "08123456789" });
    savePaymentSession({
      orderId: "MG-ABC",
      token: "snap-token",
      customerAccessToken: "ownership-token",
    });

    clearPaymentSession("MG-ABC");

    expect(getOrderAccessToken("MG-ABC")).toBe("ownership-token");
    expect(getLocalOrderAccessProofs()).toEqual([
      { orderId: "MG-ABC", customerAccessToken: "ownership-token" },
    ]);
  });

  it("does not expose one customer's proof through another customer's history", () => {
    saveOrderToLocalHistory("MG-ONE", { phone: "0811111111" });
    savePaymentSession({ orderId: "MG-ONE", token: "snap", customerAccessToken: "proof" });
    expect(getLocalOrderAccessProofs({ phone: "0822222222" })).toEqual([]);
  });
});
