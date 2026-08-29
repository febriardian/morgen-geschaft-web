import { apiFetch } from "./apiClient.js";

const VARIANT_KEY = "mg_hero_variant";
const IMPRESSION_KEY = "mg_hero_impression_date";

function analyticsConsentAccepted() {
  try {
    return localStorage.getItem("mg_analytics_consent") === "accepted";
  } catch {
    return false;
  }
}

function secureRandomBit() {
  try {
    const values = new Uint8Array(1);
    crypto.getRandomValues(values);
    return values[0] & 1;
  } catch {
    return 0;
  }
}

function getHeroVariant() {
  if (!analyticsConsentAccepted()) return "A";
  try {
    const saved = localStorage.getItem(VARIANT_KEY);
    if (saved === "A" || saved === "B") return saved;
    const assigned = secureRandomBit() === 1 ? "B" : "A";
    localStorage.setItem(VARIANT_KEY, assigned);
    return assigned;
  } catch {
    return "A";
  }
}

function getMeasuredHeroVariant() {
  if (!analyticsConsentAccepted()) return "";
  try {
    const saved = localStorage.getItem(VARIANT_KEY);
    return saved === "A" || saved === "B" ? saved : "";
  } catch {
    return "";
  }
}

async function trackHeroImpression(variant) {
  if (!analyticsConsentAccepted() || !["A", "B"].includes(variant)) return;
  const date = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(IMPRESSION_KEY) === `${date}:${variant}`) return;
    localStorage.setItem(IMPRESSION_KEY, `${date}:${variant}`);
  } catch {
    return;
  }

  try {
    await apiFetch("/api/analytics/hero-impression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant }),
    }, { timeoutMs: 5000, expectJson: true });
  } catch {
    // Analytics tidak boleh mengganggu storefront.
  }
}

export { getHeroVariant, getMeasuredHeroVariant, trackHeroImpression };
