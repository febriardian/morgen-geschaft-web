import { describe, it, expect } from "vitest";
import { toSlug, formatIDR, escapeAdminHtml, adminDate } from "./general.js";

describe("toSlug", () => {
  it("mengubah teks jadi slug lowercase ber-dash", () => {
    expect(toSlug("Kahf Bright Aminogel")).toBe("kahf-bright-aminogel");
  });

  it("menormalkan huruf beraksen", () => {
    expect(toSlug("Café Über")).toBe("cafe-uber");
  });

  it("membuang karakter non-alfanumerik & dash tepi", () => {
    expect(toSlug("  Produk #1!! ")).toBe("produk-1");
  });

  it("membatasi panjang maksimum 80 karakter", () => {
    expect(toSlug("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe("formatIDR", () => {
  it("memformat ribuan gaya Indonesia", () => {
    expect(formatIDR(26000)).toBe("Rp26.000");
    expect(formatIDR(0)).toBe("Rp0");
    expect(formatIDR(1500000)).toBe("Rp1.500.000");
  });
});

describe("escapeAdminHtml", () => {
  it("meng-escape karakter HTML berbahaya", () => {
    expect(escapeAdminHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(escapeAdminHtml('a"b\'c&d')).toBe("a&quot;b&#039;c&amp;d");
  });

  it("nilai null/undefined jadi string kosong", () => {
    expect(escapeAdminHtml(null)).toBe("");
    expect(escapeAdminHtml(undefined)).toBe("");
  });
});

describe("adminDate", () => {
  it("mengembalikan null untuk nilai kosong/invalid", () => {
    expect(adminDate(null)).toBeNull();
    expect(adminDate("bukan-tanggal")).toBeNull();
  });

  it("parse string ISO jadi Date", () => {
    const d = adminDate("2026-07-26T10:00:00.000Z");
    expect(d).toBeInstanceOf(Date);
    expect(d.getUTCFullYear()).toBe(2026);
  });

  it("mendukung Firestore timestamp {seconds}", () => {
    const d = adminDate({ seconds: 1700000000 });
    expect(d).toBeInstanceOf(Date);
  });
});
