import { describe, it, expect } from "vitest";
import {
  normalizeLocale,
  getLocaleFromPath,
  categoryIdFromSlug,
  internalSectionId,
  parseLocalizedPath,
  routePath,
  switchLocalePath,
} from "./locale.js";

describe("normalizeLocale", () => {
  it("menerima locale yang didukung (case-insensitive)", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("ID")).toBe("id");
  });

  it("locale tidak valid jatuh ke default yang didukung", () => {
    expect(["id", "en"]).toContain(normalizeLocale("xx"));
    expect(["id", "en"]).toContain(normalizeLocale(null));
  });
});

describe("getLocaleFromPath", () => {
  it("mengambil locale dari segmen pertama path", () => {
    expect(getLocaleFromPath("/en/catalog")).toBe("en");
    expect(getLocaleFromPath("/id/katalog")).toBe("id");
  });

  it("mengembalikan null jika tidak ada prefix locale", () => {
    expect(getLocaleFromPath("/")).toBeNull();
    expect(getLocaleFromPath("/produk/p1")).toBeNull();
  });
});

describe("fallback slug/section", () => {
  it("slug kategori tak dikenal jatuh ke 'semua'", () => {
    expect(categoryIdFromSlug("id", "slug-yang-tidak-ada")).toBe("semua");
  });

  it("internalSectionId kosong mengembalikan string kosong", () => {
    expect(internalSectionId("id", "")).toBe("");
  });
});

describe("skin quiz routes", () => {
  it("membuat dan membaca path kuis yang dilokalkan", () => {
    expect(routePath("id", "skinQuiz")).toBe("/id/kuis-tipe-kulit");
    expect(routePath("en", "skinQuiz")).toBe("/en/skin-type-quiz");
    expect(parseLocalizedPath("/id/kuis-tipe-kulit").key).toBe("skinQuiz");
    expect(parseLocalizedPath("/en/skin-type-quiz").key).toBe("skinQuiz");
  });

  it("mempertahankan halaman kuis saat bahasa diganti", () => {
    expect(switchLocalePath("/id/kuis-tipe-kulit", "en")).toBe("/en/skin-type-quiz");
    expect(switchLocalePath("/en/skin-type-quiz", "id")).toBe("/id/kuis-tipe-kulit");
  });
});
