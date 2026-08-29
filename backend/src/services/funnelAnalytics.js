// services/funnelAnalytics.js
// Conversion funnel tracking: pageView → addToCart → checkout → paid.
// Menggunakan Firestore atomic counters (murah, tidak butuh analytics service).
// Data disimpan per hari di collection `_analytics` dengan format doc ID: YYYY-MM-DD.

import { getAdminDb } from "../config/firebaseAdmin.js";
import { FieldValue } from "firebase-admin/firestore";
import { log } from "./logger.js";

const COLLECTION = "_analytics";

function todayDocId() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Increment funnel counter. Fire-and-forget — never throws.
 * @param {"pageView"|"addToCart"|"checkout"|"paid"} event
 * @param {number} [value=1]
 */
export async function trackFunnelEvent(event, value = 1) {
  try {
    const db = getAdminDb();
    const docRef = db.collection(COLLECTION).doc(todayDocId());
    await docRef.set(
      {
        [event]: FieldValue.increment(value),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    log("warn", "analytics", "Failed to track funnel event", { event, error: err.message });
  }
}

/**
 * Track revenue (paid event with amount).
 * @param {number} amount
 */
export async function trackRevenue(amount, { heroVariant = "" } = {}) {
  try {
    const db = getAdminDb();
    const docRef = db.collection(COLLECTION).doc(todayDocId());
    const update = {
        paid: FieldValue.increment(1),
        revenue: FieldValue.increment(Number(amount) || 0),
        updatedAt: new Date().toISOString(),
    };
    if (["A", "B"].includes(heroVariant)) {
      update[`hero${heroVariant}Paid`] = FieldValue.increment(1);
      update[`hero${heroVariant}Revenue`] = FieldValue.increment(Number(amount) || 0);
    }
    await docRef.set(update, { merge: true });
  } catch (err) {
    log("warn", "analytics", "Failed to track revenue", { error: err.message });
  }
}

/**
 * Get funnel data for admin dashboard.
 * @param {number} days — number of days to look back
 * @returns {Promise<Array<{date, pageView, addToCart, checkout, paid, revenue}>>}
 */
export async function getFunnelData(days = 30) {
  const db = getAdminDb();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startId = startDate.toISOString().split("T")[0];

  const snap = await db
    .collection(COLLECTION)
    .where("__name__", ">=", startId)
    .orderBy("__name__", "asc")
    .get();

  return snap.docs.map((doc) => ({
    date: doc.id,
    pageView: doc.data().pageView || 0,
    addToCart: doc.data().addToCart || 0,
    checkout: doc.data().checkout || 0,
    paid: doc.data().paid || 0,
    revenue: doc.data().revenue || 0,
    heroAView: doc.data().heroAView || 0,
    heroBView: doc.data().heroBView || 0,
    heroAPaid: doc.data().heroAPaid || 0,
    heroBPaid: doc.data().heroBPaid || 0,
    heroARevenue: doc.data().heroARevenue || 0,
    heroBRevenue: doc.data().heroBRevenue || 0,
  }));
}
