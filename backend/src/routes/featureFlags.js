import { Router } from "express";
import { verifyAdmin } from "../middleware/auth.js";
import { getFeatureFlags, updateFeatureFlags } from "../services/featureFlags.js";

const router = Router();

router.get("/api/feature-flags", async (_req, res) => {
  const flags = await getFeatureFlags();
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  return res.status(200).json({ flags });
});

router.patch("/api/admin/feature-flags", verifyAdmin, async (req, res) => {
  const changes = Object.fromEntries(
    Object.entries(req.body || {}).filter(([, value]) => typeof value === "boolean")
  );
  if (Object.keys(changes).length === 0) {
    return res.status(400).json({ error: "Tidak ada feature flag yang valid." });
  }
  return res.status(200).json({ flags: await updateFeatureFlags(changes) });
});

export default router;
