import { Router } from "express";
import { webhookRateLimit } from "../middleware/rateLimiter.js";
import { log } from "../services/logger.js";
import { processBiteshipWebhook } from "../services/biteshipWebhook.js";
import {
  validateBiteshipWebhookPayload,
  verifyBiteshipWebhookRequest,
} from "../services/biteshipWebhookUtils.js";

const router = Router();

router.post("/api/biteship-webhook", webhookRateLimit, async (req, res) => {
  const authentication = verifyBiteshipWebhookRequest(req);
  if (!authentication.ok) {
    if (authentication.reason === "missing_configuration") {
      log("error", "biteship-webhook", "BITESHIP_WEBHOOK_SECRET belum dikonfigurasi");
      return res.status(503).json({ error: "Webhook Biteship belum dikonfigurasi." });
    }
    log("warn", "biteship-webhook", "Token webhook Biteship tidak valid", {
      ip: req.ip,
      requestId: req.requestId,
    });
    return res.status(401).json({ error: "Token webhook tidak valid." });
  }

  // Saat webhook dibuat, Biteship mengirim request validasi dengan body JSON kosong.
  // Balas 200 setelah secret terverifikasi agar instalasi webhook dapat selesai.
  const isValidationProbe =
    !req.body ||
    (typeof req.body === "object" &&
      !Array.isArray(req.body) &&
      Object.keys(req.body).length === 0);

  if (isValidationProbe) {
    return res.status(200).json({ ok: true, message: "Webhook Biteship siap." });
  }

  const validation = validateBiteshipWebhookPayload(req.body);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  try {
    const result = await processBiteshipWebhook(validation.payload);
    if (!result.matched) {
      // Balas 200 agar event yang memang belum dapat dicocokkan tidak memicu
      // retry tanpa henti. Detail tetap tercatat pada log server.
      return res.status(200).json({ message: "Order lokal tidak ditemukan; event dicatat dan diabaikan." });
    }

    return res.status(200).json({
      message: result.duplicate ? "Event duplikat diabaikan." : "Webhook diproses.",
      orderId: result.orderId,
      status: result.nextStatus,
      shippingStatus: result.shippingStatus || "",
      trackingNumber: result.trackingNumber || "",
    });
  } catch (error) {
    log("error", "biteship-webhook", "Gagal memproses webhook Biteship", {
      error: error.message,
      requestId: req.requestId,
    });
    // 500 diperlukan agar Biteship dapat mencoba mengirim ulang kegagalan sementara.
    return res.status(500).json({ error: "Gagal memproses webhook." });
  }
});

export default router;
