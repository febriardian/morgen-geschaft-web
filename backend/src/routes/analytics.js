// routes/analytics.js
// Admin-only endpoints untuk funnel analytics data.

import { Router } from "express";
import { verifyAdmin } from "../middleware/auth.js";
import { getFunnelData, trackFunnelEvent } from "../services/funnelAnalytics.js";
import { rateLimit } from "../middleware/rateLimiter.js";
import { getFeatureFlags } from "../services/featureFlags.js";

const router = Router();

router.post("/api/analytics/hero-impression", rateLimit, async (req, res) => {
  if (!(await getFeatureFlags()).heroExperiment) return res.status(204).end();
  const variant = req.body?.variant === "B" ? "B" : req.body?.variant === "A" ? "A" : "";
  if (!variant) return res.status(400).json({ error: "Varian hero tidak valid." });
  await trackFunnelEvent(`hero${variant}View`);
  return res.status(202).json({ ok: true });
});

// GET /api/admin/analytics/funnel?days=30
router.get("/api/admin/analytics/funnel", verifyAdmin, async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
  const data = await getFunnelData(days);

  // Compute totals
  const totals = data.reduce(
    (acc, d) => ({
      pageView: acc.pageView + d.pageView,
      addToCart: acc.addToCart + d.addToCart,
      checkout: acc.checkout + d.checkout,
      paid: acc.paid + d.paid,
      revenue: acc.revenue + d.revenue,
      heroAView: acc.heroAView + d.heroAView,
      heroBView: acc.heroBView + d.heroBView,
      heroAPaid: acc.heroAPaid + d.heroAPaid,
      heroBPaid: acc.heroBPaid + d.heroBPaid,
      heroARevenue: acc.heroARevenue + d.heroARevenue,
      heroBRevenue: acc.heroBRevenue + d.heroBRevenue,
    }),
    { pageView: 0, addToCart: 0, checkout: 0, paid: 0, revenue: 0, heroAView: 0, heroBView: 0, heroAPaid: 0, heroBPaid: 0, heroARevenue: 0, heroBRevenue: 0 },
  );

  // Conversion rates
  const rates = {
    viewToCart: totals.pageView > 0 ? Math.round((totals.addToCart / totals.pageView) * 10000) / 100 : 0,
    cartToCheckout: totals.addToCart > 0 ? Math.round((totals.checkout / totals.addToCart) * 10000) / 100 : 0,
    checkoutToPaid: totals.checkout > 0 ? Math.round((totals.paid / totals.checkout) * 10000) / 100 : 0,
    overallConversion: totals.pageView > 0 ? Math.round((totals.paid / totals.pageView) * 10000) / 100 : 0,
    heroAToPaid: totals.heroAView > 0 ? Math.round((totals.heroAPaid / totals.heroAView) * 10000) / 100 : 0,
    heroBToPaid: totals.heroBView > 0 ? Math.round((totals.heroBPaid / totals.heroBView) * 10000) / 100 : 0,
  };

  return res.json({ days, totals, rates, daily: data });
});

export default router;
