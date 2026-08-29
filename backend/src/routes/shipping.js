// routes/shipping.js
// Biteship shipping integration: area search, rates, tracking, settings

import { Router } from "express";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { calculateShippingQuotes, getShippingSettings } from "../services/shipping.js";
import { verifyAdmin } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimiter.js";
import { log } from "../services/logger.js";

const router = Router();
const BITESHIP_BASE = "https://api.biteship.com";

router.get("/api/shipping/areas", rateLimit, async (req, res) => {
  try {
    const { input } = req.query;
    if (!input || input.trim().length < 3) return res.status(400).json({ error: "Minimal 3 karakter." });
    const apiKey = process.env.BITESHIP_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "Shipping belum dikonfigurasi." });

    const biteRes = await fetch(
      `${BITESHIP_BASE}/v1/maps/areas?countries=ID&input=${encodeURIComponent(input.trim())}&type=single`,
      { headers: { Authorization: apiKey } }
    );
    const data = await biteRes.json();
    if (!biteRes.ok) { log("error", "shipping", "Biteship maps error", { data }); return res.status(502).json({ error: "Gagal mencari area." }); }
    const areas = (data.areas || []).map((a) => ({
      id: a.id, name: a.name,
      city: a.administrative_division_level_2_name || "",
      district: a.administrative_division_level_3_name || "",
      province: a.administrative_division_level_1_name || "",
      postalCode: a.postal_code,
    }));
    return res.json({ areas });
  } catch (err) { log("error", "shipping", "shipping/areas error", { error: err.message }); return res.status(500).json({ error: "Gagal mencari area." }); }
});

router.post("/api/shipping/rates", rateLimit, async (req, res) => {
  try {
    const { destinationAreaId, destinationAreaName, items } = req.body;
    if (!destinationAreaId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Data pengiriman tidak lengkap." });
    }
    if (String(destinationAreaId).length > 200 || String(destinationAreaName || "").length > 300) {
      return res.status(400).json({ error: "Area tujuan tidak valid." });
    }

    const result = await calculateShippingQuotes({
      destinationAreaId: String(destinationAreaId),
      destinationAreaName: String(destinationAreaName || ""),
      items,
    });
    return res.json(result);
  } catch (err) {
    log("error", "shipping", "shipping/rates error", { error: err.message });
    const status = /belum dikonfigurasi|belum diset|Origin/.test(err.message) ? 503 : 502;
    return res.status(status).json({ error: err.message || "Gagal menghitung ongkir." });
  }
});

router.get("/api/shipping/track", rateLimit, async (req, res) => {
  try {
    const { waybill, courier } = req.query;
    if (!waybill || !courier) return res.status(400).json({ error: "Waybill dan kurir wajib diisi." });
    const apiKey = process.env.BITESHIP_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "Tracking belum dikonfigurasi." });

    const biteRes = await fetch(
      `${BITESHIP_BASE}/v1/trackings/${encodeURIComponent(waybill)}/couriers/${encodeURIComponent(courier)}`,
      { headers: { Authorization: apiKey } }
    );
    const data = await biteRes.json();
    if (!biteRes.ok) { log("error", "shipping", "Biteship tracking error", { data }); return res.status(502).json({ error: "Gagal mengambil data tracking." }); }

    return res.json({
      waybill: data.waybill_id || waybill, status: data.status || "unknown",
      courier: { company: data.courier?.company || courier, driverName: data.courier?.driver_name || null, driverPhone: data.courier?.driver_phone || null },
      origin: data.origin || null, destination: data.destination || null,
      history: (data.history || []).map((h) => ({ note: h.note, status: h.status, updatedAt: h.updated_at })),
    });
  } catch (err) { log("error", "shipping", "shipping/track error", { error: err.message }); return res.status(500).json({ error: "Gagal tracking pengiriman." }); }
});

router.patch("/api/shipping/settings", verifyAdmin, async (req, res) => {
  try {
    const { activeCity } = req.body;
    if (!activeCity) return res.status(400).json({ error: "activeCity wajib diisi." });
    const db = getAdminDb();
    const settingsRef = db.collection("settings").doc("shipping");
    const snap = await settingsRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Settings pengiriman belum dibuat." });
    const origins = snap.data().origins || {};
    if (!origins[activeCity]) return res.status(400).json({ error: `Origin "${activeCity}" tidak ditemukan di settings.` });
    await settingsRef.update({ activeCity });
    return res.json({ message: `Origin diubah ke ${activeCity}.`, activeCity });
  } catch (err) { log("error", "shipping", "shipping settings error", { error: err.message }); return res.status(500).json({ error: "Gagal update settings." }); }
});

router.get("/api/shipping/settings", verifyAdmin, async (req, res) => {
  try {
    const settings = await getShippingSettings();
    if (!settings) return res.status(404).json({ error: "Belum dikonfigurasi." });
    return res.json(settings);
  } catch (err) { log("error", "shipping", "get shipping settings error", { error: err.message }); return res.status(500).json({ error: "Gagal ambil settings." }); }
});

export default router;
