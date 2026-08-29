import { describe, expect, it } from "vitest";
import {
  buildQuizResult,
  clearSavedQuizResult,
  evaluateSkinQuiz,
  isQuizComplete,
  readSavedQuizResult,
  recommendAvailableProducts,
  sanitizeQuizAnswers,
  saveQuizResult,
} from "./skinQuizEngine.js";
import { SKIN_QUIZ_STORAGE_KEY } from "./skinQuizData.js";

const completeAnswers = {
  afterCleansing: "oily",
  duringDay: "oily",
  productComfort: "rarelyReactive",
  mainConcern: "acne",
  routinePriority: "oilControl",
};

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const products = [
  {
    id: "p1",
    name: "Oil and Acne Face Wash",
    tag: "SALICYLIC ACID · OILY/ACNE",
    blurb: "Pembersih untuk kulit berminyak dan rentan jerawat.",
    category: "facewash",
    ingredients: ["Salicylic Acid", "Zinc"],
    stock: 8,
    price: 26000,
  },
  {
    id: "p5",
    name: "Low pH Gentle Jelly Cleanser",
    tag: "GENTLE · SENSITIVE",
    blurb: "Pembersih lembut dengan centella dan panthenol.",
    category: "facewash",
    ingredients: ["Centella", "Panthenol"],
    stock: 5,
    price: 30000,
  },
  {
    id: "p8",
    name: "Perfect Shield Sunscreen SPF 40",
    tag: "SPF 40 · ALL TYPES",
    blurb: "Perlindungan UVA dan UVB harian.",
    category: "sunscreen",
    ingredients: ["Hyaluronic Acid", "Aloe"],
    stock: 3,
    price: 26000,
  },
  {
    id: "p9",
    name: "Acne B5 Serum",
    tag: "PANTHENOL · ACNE",
    blurb: "Serum untuk kulit rentan jerawat.",
    category: "serum",
    ingredients: ["Panthenol", "Salicylic Acid"],
    stock: 6,
    price: 30000,
  },
  {
    id: "p7",
    name: "Body Wash",
    tag: "BODY",
    category: "bodywash",
    stock: 10,
    price: 30000,
  },
  {
    id: "sold-out",
    name: "Sold Out Acne Cleanser",
    tag: "ACNE · OILY",
    category: "facewash",
    stock: 0,
    price: 20000,
  },
  {
    id: "archived",
    name: "Archived Acne Serum",
    tag: "ACNE",
    category: "serum",
    stock: 10,
    isArchived: true,
    price: 20000,
  },
];

describe("skin quiz profile", () => {
  it("menghasilkan tipe dominan, prioritas, dan penanda sensitif", () => {
    const result = evaluateSkinQuiz({
      ...completeAnswers,
      productComfort: "oftenReactive",
      routinePriority: "gentle",
    });

    expect(result.skinType).toBe("oily");
    expect(result.sensitive).toBe(true);
    expect(result.concern).toBe("acne");
    expect(result.priority).toBe("gentle");
    expect(result.complete).toBe(true);
  });

  it("menghapus jawaban tak dikenal dan mendeteksi kuis yang belum lengkap", () => {
    const safe = sanitizeQuizAnswers({
      ...completeAnswers,
      duringDay: "jawaban-palsu",
      injected: "<script>",
    });

    expect(safe.injected).toBeUndefined();
    expect(safe.duringDay).toBeUndefined();
    expect(isQuizComplete(safe)).toBe(false);
  });
});

describe("skin quiz recommendations", () => {
  it("hanya memakai stok aktif, maksimal tiga produk, dan satu per langkah", () => {
    const profile = evaluateSkinQuiz(completeAnswers);
    const recommendations = recommendAvailableProducts(products, profile, "id");

    expect(recommendations.length).toBeLessThanOrEqual(3);
    expect(recommendations.map((item) => item.product.id)).toEqual(["p1", "p9", "p8"]);
    expect(recommendations.every((item) => item.product.stock > 0)).toBe(true);
    expect(recommendations.some((item) => item.product.id === "sold-out")).toBe(false);
    expect(recommendations.some((item) => item.product.id === "archived")).toBe(false);
    expect(recommendations.some((item) => item.product.category === "bodywash")).toBe(false);
  });

  it("memprioritaskan opsi lembut untuk jawaban yang mudah tidak nyaman", () => {
    const result = buildQuizResult(
      {
        ...completeAnswers,
        productComfort: "oftenReactive",
        routinePriority: "gentle",
      },
      products,
      "en"
    );

    expect(result.recommendations[0].product.id).toBe("p5");
    expect(result.recommendations[0].reason).toMatch(/gentler|skin comfort/i);
    expect(result.recommendations.every((item) => typeof item.reason === "string")).toBe(true);
  });
});

describe("skin quiz optional storage", () => {
  it("tidak menyimpan tanpa persetujuan dan menghapus data lama", () => {
    const storage = memoryStorage();
    storage.setItem(SKIN_QUIZ_STORAGE_KEY, "old");

    expect(saveQuizResult(completeAnswers, false, storage)).toBe(false);
    expect(storage.getItem(SKIN_QUIZ_STORAGE_KEY)).toBeNull();
  });

  it("menyimpan dan membaca hanya hasil lengkap setelah persetujuan", () => {
    const storage = memoryStorage();

    expect(saveQuizResult(completeAnswers, true, storage)).toBe(true);
    expect(readSavedQuizResult(storage)?.answers).toEqual(completeAnswers);

    clearSavedQuizResult(storage);
    expect(readSavedQuizResult(storage)).toBeNull();
  });

  it("menolak data tersimpan yang rusak atau belum lengkap", () => {
    const storage = memoryStorage();
    storage.setItem(
      SKIN_QUIZ_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        consent: true,
        answers: { afterCleansing: "oily" },
      })
    );

    expect(readSavedQuizResult(storage)).toBeNull();
  });
});
