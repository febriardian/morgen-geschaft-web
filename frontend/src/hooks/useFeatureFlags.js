import { useEffect, useState } from "react";
import { apiFetch, readJsonResponse } from "../services/apiClient.js";

const DEFAULTS = {
  customerAccounts: true,
  loyalty: true,
  referral: true,
  heroExperiment: true,
  returns: true,
  flashSale: true,
};

let cachedFlags = null;
let pendingRequest = null;

async function loadFeatureFlags() {
  if (cachedFlags) return cachedFlags;
  if (!pendingRequest) {
    pendingRequest = apiFetch("/api/feature-flags", {}, { timeoutMs: 5000, expectJson: true })
      .then(async (response) => {
        if (!response.ok) throw new Error("Feature flags unavailable");
        const data = await readJsonResponse(response);
        cachedFlags = { ...DEFAULTS, ...(data.flags || {}) };
        return cachedFlags;
      })
      .catch(() => DEFAULTS)
      .finally(() => { pendingRequest = null; });
  }
  return pendingRequest;
}

function useFeatureFlags() {
  const [flags, setFlags] = useState(cachedFlags || DEFAULTS);
  useEffect(() => {
    let active = true;
    loadFeatureFlags().then((value) => { if (active) setFlags(value); });
    return () => { active = false; };
  }, []);
  return flags;
}

export { DEFAULTS as DEFAULT_FEATURE_FLAGS, loadFeatureFlags, useFeatureFlags };
