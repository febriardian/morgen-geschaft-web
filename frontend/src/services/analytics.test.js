import { describe, expect, it } from "vitest";
import {
  browserLikelyBlocksTracking,
  browserRequestsNoTracking,
  getAnalyticsConfig,
  isValidGoogleAnalyticsId,
  isValidMetaPixelId,
} from "./analytics.js";

describe("analytics privacy signals", () => {
  it("menghormati Global Privacy Control", () => {
    expect(
      browserRequestsNoTracking({
        globalPrivacyControl: true,
        doNotTrack: "0",
      })
    ).toBe(true);
  });

  it("menghormati Do Not Track", () => {
    expect(browserRequestsNoTracking({ doNotTrack: "1" })).toBe(true);
    expect(browserRequestsNoTracking({ msDoNotTrack: "yes" })).toBe(true);
  });

  it("mengizinkan analytics ketika tidak ada sinyal privasi browser", () => {
    expect(
      browserRequestsNoTracking({
        globalPrivacyControl: false,
        doNotTrack: "0",
      })
    ).toBe(false);
  });
});

describe("analytics blocker detection", () => {
  it("tidak menandai browser normal sebagai pemblokir", () => {
    expect(browserLikelyBlocksTracking(document)).toBe(false);
  });

  it("melewati tracker ketika elemen iklan disembunyikan", () => {
    const original = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({ display: "none", visibility: "visible" });
    expect(browserLikelyBlocksTracking(document)).toBe(true);
    globalThis.getComputedStyle = original;
  });
});

describe("analytics configuration", () => {
  it("menolak ID contoh agar tracker tidak dimuat di production", () => {
    expect(isValidGoogleAnalyticsId("G-XXXXXXXXXX")).toBe(false);
    expect(isValidMetaPixelId("XXXXXXXXXX")).toBe(false);
    expect(
      getAnalyticsConfig({
        VITE_GA_ID: "G-XXXXXXXXXX",
        VITE_META_PIXEL_ID: "XXXXXXXXXX",
      })
    ).toEqual({ gaId: "", metaPixelId: "" });
  });

  it("menerima ID analytics yang formatnya valid", () => {
    expect(isValidGoogleAnalyticsId("G-ABC123DEF4")).toBe(true);
    expect(isValidMetaPixelId("123456789012345")).toBe(true);
    expect(
      getAnalyticsConfig({
        VITE_GA_ID: " G-ABC123DEF4 ",
        VITE_META_PIXEL_ID: " 123456789012345 ",
      })
    ).toEqual({
      gaId: "G-ABC123DEF4",
      metaPixelId: "123456789012345",
    });
  });
});
