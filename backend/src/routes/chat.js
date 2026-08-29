// routes/chat.js
// GESA chat proxy — Gemini API key stays server-side

import { Router } from "express";
import { log } from "../services/logger.js";
import { chatRateLimit } from "../middleware/rateLimiter.js";
import { buildSystemPrompt } from "../services/gesaPrompt.js";

const router = Router();

router.post("/api/chat", chatRateLimit, async (req, res) => {
  try {
    const { message, history, locale } = req.body;
    const responseLocale = locale === "en" ? "en" : "id";
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Pesan tidak boleh kosong." });
    }

    const cleanMessage = message.trim().slice(0, 500);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      log("error", "chat", "GEMINI_API_KEY belum diset di environment variables.");
      return res.status(503).json({ error: "AI assistant belum dikonfigurasi." });
    }

    const systemPrompt = await buildSystemPrompt(responseLocale);

    const rawHistory = Array.isArray(history) ? history.slice(-10) : [];
    const recentHistory = rawHistory
      .filter((m) => m && typeof m.text === "string" && m.text.trim().length > 0)
      .map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text.trim().slice(0, 500) }],
      }));

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000), // 30s timeout — prevent indefinite hang
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [
            ...recentHistory,
            { role: "user", parts: [{ text: cleanMessage }] },
          ],
          generationConfig: { temperature: 0.65, maxOutputTokens: 512 },
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      log("error", "chat", "Gemini API error", { detail: data?.error?.message || geminiRes.status });
      return res.status(502).json({ error: "Gagal menghubungi AI. Coba lagi nanti." });
    }

    const rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (!rawReply) {
      return res.status(200).json({ reply: responseLocale === "en" ? "Sorry, I cannot process that request right now." : "Maaf, saya tidak dapat memproses permintaan itu sekarang." });
    }

    const reply = rawReply
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/^[-•]\s+/gm, "• ")
      .replace(/^#+\s+/gm, "")
      .replace(/`([^`]+)`/g, "$1")
      .trim();

    return res.status(200).json({ reply });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      log("warn", "chat", "Gemini API timeout", { error: err.message });
      return res.status(504).json({ error: "AI assistant sedang sibuk. Coba lagi sebentar." });
    }
    log("error", "chat", "chat proxy error", { error: err.message });
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
});

export default router;
