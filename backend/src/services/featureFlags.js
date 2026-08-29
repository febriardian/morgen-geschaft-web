import { getAdminDb } from "../config/firebaseAdmin.js";

const DEFAULT_FEATURE_FLAGS = Object.freeze({
  customerAccounts: true,
  loyalty: true,
  referral: true,
  heroExperiment: true,
  returns: true,
  flashSale: true,
});

let cached = null;
let cachedAt = 0;

function normalizeFeatureFlags(value = {}) {
  return Object.fromEntries(
    Object.keys(DEFAULT_FEATURE_FLAGS).map((key) => [
      key,
      typeof value[key] === "boolean" ? value[key] : DEFAULT_FEATURE_FLAGS[key],
    ])
  );
}

async function getFeatureFlags({ force = false } = {}) {
  if (!force && cached && Date.now() - cachedAt < 30_000) return cached;
  const snapshot = await getAdminDb().collection("settings").doc("featureFlags").get();
  cached = normalizeFeatureFlags(snapshot.exists ? snapshot.data() : {});
  cachedAt = Date.now();
  return cached;
}

async function updateFeatureFlags(changes) {
  const current = await getFeatureFlags({ force: true });
  const next = normalizeFeatureFlags({ ...current, ...changes });
  await getAdminDb().collection("settings").doc("featureFlags").set({
    ...next,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  cached = next;
  cachedAt = Date.now();
  return next;
}

export { DEFAULT_FEATURE_FLAGS, normalizeFeatureFlags, getFeatureFlags, updateFeatureFlags };
