import { describe, expect, it } from "vitest";
import {
  buildReferralUrl,
  getReferralCodeFromSearch,
  isValidReferralCode,
  normalizeReferralCode,
} from "./referral.js";

describe("referral links", () => {
  it("normalizes only the supported Morgen referral format", () => {
    expect(normalizeReferralCode(" mg4ef1cf80 ")).toBe("MG4EF1CF80");
    expect(isValidReferralCode("MG4EF1CF80")).toBe(true);
    expect(isValidReferralCode("MG-4EF1CF80")).toBe(true);
    expect(isValidReferralCode("MG4EF1CF8Z")).toBe(false);
  });

  it("reads a valid referral code from a localized URL", () => {
    expect(getReferralCodeFromSearch("?utm_source=share&ref=mg4ef1cf80")).toBe("MG4EF1CF80");
    expect(getReferralCodeFromSearch("?ref=invalid")).toBe("");
  });

  it("creates a shareable link without dropping the locale path", () => {
    expect(buildReferralUrl("https://morgengeschaft.com", "/en", "MG4EF1CF80"))
      .toBe("https://morgengeschaft.com/en?ref=MG4EF1CF80");
  });
});
