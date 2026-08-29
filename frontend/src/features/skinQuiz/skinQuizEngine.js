import {
  CONCERN_CONTENT,
  SKIN_QUIZ_QUESTIONS,
  SKIN_QUIZ_STORAGE_KEY,
  SKIN_QUIZ_VERSION,
  SKIN_TYPE_CONTENT,
  quizText,
} from "./skinQuizData.js";

const TYPE_ORDER = ["combination", "oily", "dry", "normal"];
const RECOMMENDABLE_CATEGORIES = new Set(["facewash", "serum", "sunscreen"]);

const CURATED_PRODUCT_SIGNALS = {
  p1: {
    types: ["oily", "combination"],
    concerns: ["acne", "comedones"],
    priorities: ["oilControl"],
    cautionSensitive: true,
  },
  p2: {
    types: ["oily", "combination", "normal"],
    concerns: ["dullness", "hydration"],
    priorities: ["brightening"],
    cautionSensitive: true,
  },
  p3: {
    types: ["dry", "combination", "normal"],
    concerns: ["dullness", "hydration"],
    priorities: ["gentle", "brightening", "simple"],
    sensitiveFriendly: true,
  },
  p4: {
    types: ["oily", "combination"],
    concerns: ["comedones", "acne"],
    priorities: ["oilControl"],
    cautionSensitive: true,
  },
  p5: {
    types: ["dry", "combination", "normal", "oily"],
    concerns: ["hydration"],
    priorities: ["gentle", "simple"],
    sensitiveFriendly: true,
  },
  p6: {
    types: ["normal", "combination", "oily"],
    concerns: ["dullness"],
    priorities: ["brightening"],
    cautionSensitive: true,
  },
  p8: {
    types: ["dry", "combination", "normal", "oily"],
    concerns: ["protection", "hydration"],
    priorities: ["simple", "gentle"],
    sensitiveFriendly: true,
  },
  p9: {
    types: ["oily", "combination"],
    concerns: ["acne"],
    priorities: ["gentle", "oilControl"],
  },
  p1782544937735: {
    types: ["oily", "combination"],
    concerns: ["acne", "comedones"],
    priorities: ["oilControl"],
    cautionSensitive: true,
  },
};

function optionFor(questionId, optionId) {
  return SKIN_QUIZ_QUESTIONS.find((question) => question.id === questionId)?.options.find(
    (option) => option.id === optionId
  );
}

export function sanitizeQuizAnswers(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return {};

  return SKIN_QUIZ_QUESTIONS.reduce((safeAnswers, question) => {
    const value = String(candidate[question.id] || "");
    if (question.options.some((option) => option.id === value)) {
      safeAnswers[question.id] = value;
    }
    return safeAnswers;
  }, {});
}

export function isQuizComplete(answers) {
  const safeAnswers = sanitizeQuizAnswers(answers);
  return SKIN_QUIZ_QUESTIONS.every((question) => Boolean(safeAnswers[question.id]));
}

export function evaluateSkinQuiz(answers) {
  const safeAnswers = sanitizeQuizAnswers(answers);
  const typeScores = { oily: 0, dry: 0, combination: 0, normal: 0 };
  let sensitivityScore = 0;
  let concern = "protection";
  let priority = "simple";

  SKIN_QUIZ_QUESTIONS.forEach((question) => {
    const option = optionFor(question.id, safeAnswers[question.id]);
    if (!option) return;

    Object.entries(option.typeScores || {}).forEach(([type, score]) => {
      if (Object.hasOwn(typeScores, type)) typeScores[type] += Number(score || 0);
    });
    sensitivityScore += Number(option.sensitivityScore || 0);
    if (option.concern) concern = option.concern;
    if (option.priority) priority = option.priority;
  });

  const strongestScore = Math.max(...Object.values(typeScores));
  const firstAnswer = safeAnswers.afterCleansing;
  const tiedTypes = TYPE_ORDER.filter((type) => typeScores[type] === strongestScore);
  const skinType = tiedTypes.includes(firstAnswer) ? firstAnswer : tiedTypes[0] || "normal";

  return {
    skinType,
    sensitive: sensitivityScore >= 3,
    sensitivityScore,
    concern,
    priority,
    typeScores,
    complete: isQuizComplete(safeAnswers),
  };
}

function productSearchText(product) {
  return [
    product?.id,
    product?.name,
    product?.tag,
    product?.blurb,
    product?.category,
    ...(Array.isArray(product?.ingredients) ? product.ingredients : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function inferProductSignals(product) {
  const curated = CURATED_PRODUCT_SIGNALS[String(product?.id || "")] || {};
  const text = productSearchText(product);
  const types = new Set(curated.types || []);
  const concerns = new Set(curated.concerns || []);
  const priorities = new Set(curated.priorities || []);
  let sensitiveFriendly = Boolean(curated.sensitiveFriendly);
  let cautionSensitive = Boolean(curated.cautionSensitive);

  if (hasAny(text, ["oily", "oil control", "minyak", "zinc", "charcoal"])) {
    types.add("oily");
    types.add("combination");
    priorities.add("oilControl");
  }
  if (hasAny(text, ["gentle", "low ph", "centella", "cica", "panthenol", "allantoin", "aloe"])) {
    sensitiveFriendly = true;
    priorities.add("gentle");
  }
  if (hasAny(text, ["hyaluronic", "glycerin", "hydration", "hydrating", "lembap", "kelembapan"])) {
    concerns.add("hydration");
  }
  if (hasAny(text, ["acne", "jerawat", "salicylic", "tea tree"])) {
    concerns.add("acne");
  }
  if (hasAny(text, ["comedo", "komedo", "clogged", "pore", "pori", "charcoal"])) {
    concerns.add("comedones");
  }
  if (
    hasAny(text, ["bright", "cerah", "dull", "kusam", "vitamin c", "niacinamide", "aha", "pha"])
  ) {
    concerns.add("dullness");
    priorities.add("brightening");
  }
  if (hasAny(text, ["sunscreen", "spf", "uva", "uvb"])) {
    concerns.add("protection");
    priorities.add("simple");
    ["oily", "dry", "combination", "normal"].forEach((type) => types.add(type));
  }
  if (hasAny(text, ["scrub", "charcoal", "menthol", "salicylic", "glycolic", "aha", "pha"])) {
    cautionSensitive = true;
  }

  return {
    types,
    concerns,
    priorities,
    sensitiveFriendly,
    cautionSensitive,
  };
}

function categorySlot(product) {
  if (product.category === "facewash") return "cleanser";
  if (product.category === "serum") return "treatment";
  if (product.category === "sunscreen") return "protection";
  return String(product.category || "other");
}

function scoreProduct(product, profile) {
  const signals = inferProductSignals(product);
  let score = 0;

  if (signals.types.has(profile.skinType)) score += 4;
  if (signals.concerns.has(profile.concern)) score += 6;
  if (signals.priorities.has(profile.priority)) score += 3;

  if (profile.sensitive) {
    if (signals.sensitiveFriendly) score += 5;
    if (signals.cautionSensitive) score -= 7;
  } else if (signals.sensitiveFriendly) {
    score += 1;
  }

  if (product.category === "sunscreen") score += 3;
  if (product.category === "facewash") score += 1;

  return { score, signals };
}

const REASON_TEXT = {
  acne: {
    id: "Informasi produk paling selaras dengan prioritas minyak berlebih dan kulit rentan berjerawat.",
    en: "The product information most closely matches the priority of excess oil and acne-prone skin.",
  },
  comedones: {
    id: "Informasi produk paling selaras dengan kebutuhan membersihkan pori dan merawat komedo.",
    en: "The product information most closely matches pore cleansing and comedone care.",
  },
  dullness: {
    id: "Bahan aktif dan manfaat yang tercantum paling selaras dengan prioritas kulit tampak kusam.",
    en: "The listed ingredients and benefits most closely match the priority of dull-looking skin.",
  },
  hydration: {
    id: "Informasi produk menonjolkan bahan atau manfaat yang membantu menjaga kelembapan dan kenyamanan kulit.",
    en: "The product information highlights ingredients or benefits that support hydration and skin comfort.",
  },
  protection: {
    id: "Produk ini melengkapi langkah perlindungan harian dalam rutinitas dasar.",
    en: "This product supports the daily protection step in a basic routine.",
  },
  sensitive: {
    id: "Informasi produk lebih menonjolkan pendekatan yang lembut dan menjaga kenyamanan kulit.",
    en: "The product information emphasizes a gentler approach focused on skin comfort.",
  },
  type: {
    id: "Karakter produk paling selaras dengan kecenderungan tipe kulit dari jawabanmu.",
    en: "The product profile most closely matches the skin-type tendency shown by your answers.",
  },
  general: {
    id: "Produk ini menjadi pilihan dasar yang relevan dari katalog yang sedang tersedia.",
    en: "This is a relevant basic option from the products currently available in the catalog.",
  },
};

function recommendationReason(signals, profile, locale) {
  if (signals.concerns.has(profile.concern)) return quizText(REASON_TEXT[profile.concern], locale);
  if (profile.sensitive && signals.sensitiveFriendly)
    return quizText(REASON_TEXT.sensitive, locale);
  if (signals.types.has(profile.skinType)) return quizText(REASON_TEXT.type, locale);
  return quizText(REASON_TEXT.general, locale);
}

export function recommendAvailableProducts(products, profile, locale = "id", limit = 3) {
  if (!profile || !Array.isArray(products)) return [];

  const scored = products
    .filter(
      (product) =>
        product &&
        product.isArchived !== true &&
        Number(product.stock || 0) > 0 &&
        RECOMMENDABLE_CATEGORIES.has(product.category)
    )
    .map((product, index) => {
      const { score, signals } = scoreProduct(product, profile);
      return {
        product,
        score,
        signals,
        originalIndex: index,
        slot: categorySlot(product),
        reason: recommendationReason(signals, profile, locale),
      };
    })
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);

  const bestPerSlot = new Map();
  scored.forEach((item) => {
    if (!bestPerSlot.has(item.slot)) bestPerSlot.set(item.slot, item);
  });

  const slotOrder = ["cleanser", "treatment", "protection"];
  return slotOrder
    .map((slot) => bestPerSlot.get(slot))
    .filter(Boolean)
    .slice(0, Math.max(0, Math.min(Number(limit) || 3, 3)))
    .map(({ product, reason, score }) => ({ product, reason, score }));
}

export function buildQuizResult(answers, products, locale = "id") {
  const safeAnswers = sanitizeQuizAnswers(answers);
  const profile = evaluateSkinQuiz(safeAnswers);
  return {
    profile,
    profileContent: SKIN_TYPE_CONTENT[profile.skinType] || SKIN_TYPE_CONTENT.normal,
    concernContent: CONCERN_CONTENT[profile.concern] || CONCERN_CONTENT.protection,
    recommendations: recommendAvailableProducts(products, profile, locale, 3),
  };
}

function browserStorage(storage) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function saveQuizResult(answers, consent, storage) {
  const target = browserStorage(storage);
  if (!target) return false;

  if (!consent) {
    try {
      target.removeItem(SKIN_QUIZ_STORAGE_KEY);
    } catch {}
    return false;
  }

  const safeAnswers = sanitizeQuizAnswers(answers);
  if (!isQuizComplete(safeAnswers)) return false;

  try {
    target.setItem(
      SKIN_QUIZ_STORAGE_KEY,
      JSON.stringify({
        version: SKIN_QUIZ_VERSION,
        consent: true,
        answers: safeAnswers,
        savedAt: new Date().toISOString(),
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function readSavedQuizResult(storage) {
  const target = browserStorage(storage);
  if (!target) return null;

  try {
    const saved = JSON.parse(target.getItem(SKIN_QUIZ_STORAGE_KEY) || "null");
    if (
      saved?.version !== SKIN_QUIZ_VERSION ||
      saved?.consent !== true ||
      !isQuizComplete(saved.answers)
    ) {
      return null;
    }
    return {
      answers: sanitizeQuizAnswers(saved.answers),
      savedAt: String(saved.savedAt || ""),
    };
  } catch {
    return null;
  }
}

export function clearSavedQuizResult(storage) {
  const target = browserStorage(storage);
  if (!target) return;
  try {
    target.removeItem(SKIN_QUIZ_STORAGE_KEY);
  } catch {}
}
