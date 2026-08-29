import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./apiClient.js", () => ({ apiFetch: vi.fn() }));

import { getHeroVariant, getMeasuredHeroVariant } from "./heroExperiment.js";

describe("hero experiment consent", () => {
  beforeEach(() => localStorage.clear());

  it("tidak mengukur pelanggan yang belum memberi consent", () => {
    expect(getHeroVariant()).toBe("A");
    expect(getMeasuredHeroVariant()).toBe("");
    expect(localStorage.getItem("mg_hero_variant")).toBeNull();
  });

  it("mengirim varian tersimpan hanya setelah consent", () => {
    localStorage.setItem("mg_analytics_consent", "accepted");
    localStorage.setItem("mg_hero_variant", "B");
    expect(getMeasuredHeroVariant()).toBe("B");
  });
});
