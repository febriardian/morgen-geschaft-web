// services/photoModeration.js
// Auto-moderation untuk review photos menggunakan Gemini Vision.
// Gemini API key sudah ada di env (dipakai untuk GESA chat). Reuse.
// Jika GEMINI_API_KEY tidak ada atau error, default ke "approve" (graceful).

import { log } from "./logger.js";

const GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Cek apakah foto review aman untuk ditampilkan.
 * @param {string} imageDataUrl — base64 data URL (data:image/jpeg;base64,...)
 * @returns {Promise<{safe: boolean, reason: string}>}
 */
export async function moderateReviewPhoto(imageDataUrl) {
  if (!process.env.GEMINI_API_KEY || !imageDataUrl) {
    return { safe: true, reason: "moderation_skipped" };
  }

  try {
    // Extract base64 and mime from data URL
    const match = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return { safe: true, reason: "invalid_format_skipped" };

    const [, mimeType, base64Data] = match;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data
                  },
                },
                {
                  text: `You are a content moderation system for a skincare e-commerce product review section.
Analyze this image and determine if it's appropriate for a public product review.

REJECT if the image contains:
- Nudity, sexually suggestive content
- Violence, gore, or disturbing imagery
- Hate speech, offensive text/symbols
- Spam, advertisements, or unrelated promotional content
- Screenshots of private conversations or personal data

APPROVE if the image shows:
- Skincare products, packaging, or labels
- Before/after skin photos (face, hands, etc.)
- Product application or usage
- Selfies showing skin condition
- Neutral/harmless images

Respond with ONLY a JSON object (no markdown):
{"safe": true} or {"safe": false, "reason": "brief reason"}`,
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 100, temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      log("warn", "moderation", "Gemini API error", { status: response.status });
      return { safe: true, reason: "api_error_approved" };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();

    try {
      const result = JSON.parse(clean);
      log("info", "moderation", "Photo moderated", { safe: result.safe, reason: result.reason || "" });
      return { safe: Boolean(result.safe), reason: result.reason || "" };
    } catch {
      log("warn", "moderation", "Failed to parse Gemini response", { text: text.slice(0, 200) });
      return { safe: true, reason: "parse_error_approved" };
    }
  } catch (err) {
    log("error", "moderation", "Moderation failed", { error: err.message });
    return { safe: true, reason: "error_approved" };
  }
}
