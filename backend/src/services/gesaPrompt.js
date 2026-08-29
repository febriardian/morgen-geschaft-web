// services/gesaPrompt.js
// Build GESA system prompts dynamically from Firestore data for Indonesian and English.

import { getAdminDb } from "../config/firebaseAdmin.js";
import { buildStaticKnowledge } from "./gesaKnowledge.js";

const promptCache = new Map();
const PROMPT_CACHE_TTL = 5 * 60 * 1000;

// Pengetahuan dinamis dari koleksi Firestore `gesa_knowledge` (bisa diedit admin).
// Tiap dokumen: { question, answer, questionEn?, answerEn?, active?, order? }.
function buildDynamicKnowledge(docs, locale) {
  const active = docs
    .filter((doc) => doc.active !== false)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  if (active.length === 0) return "";
  const heading = locale === "en" ? "== ADDITIONAL Q&A ==\n" : "== TANYA-JAWAB TAMBAHAN ==\n";
  let output = heading;
  for (const doc of active) {
    const question = locale === "en" ? (doc.questionEn || doc.question) : (doc.question || doc.questionEn);
    const answer = locale === "en" ? (doc.answerEn || doc.answer) : (doc.answer || doc.answerEn);
    if (!question || !answer) continue;
    output += `Q: ${String(question).trim()}\nA: ${String(answer).trim()}\n`;
  }
  return output;
}

export function invalidatePromptCache() {
  promptCache.clear();
}

function localizedProduct(product, locale) {
  const translations = product.translations?.en || product.i18n?.en || {};
  if (locale !== "en") return product;
  return {
    ...product,
    name: translations.name || product.nameEn || product.name,
    tag: translations.tag || product.tagEn || product.tag,
    blurb: translations.blurb || product.blurbEn || product.blurb,
    ingredients: translations.ingredients || product.ingredientsEn || product.ingredients,
  };
}

function formatPrice(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function buildProductSection(products, locale) {
  const categoryLabels = locale === "en"
    ? { facewash: "Face Wash", bodywash: "Body Wash", sunscreen: "Sunscreen", serum: "Serum", bundle: "Bundles" }
    : { facewash: "Face Wash", bodywash: "Body Wash", sunscreen: "Sunscreen", serum: "Serum", bundle: "Bundle" };
  const heading = locale === "en" ? "== PRODUCTS & PRICES ==\n\n" : "== PRODUK & HARGA ==\n\n";
  let output = heading;
  let counter = 1;

  for (const [categoryId, categoryLabel] of Object.entries(categoryLabels)) {
    const categoryProducts = products.filter((product) => product.category === categoryId && product.isArchived !== true);
    if (categoryProducts.length === 0) continue;
    output += `[${categoryLabel}]\n`;

    for (const rawProduct of categoryProducts) {
      const product = localizedProduct(rawProduct, locale);
      const stock = Number(product.stock || 0);
      const stockInfo = locale === "en"
        ? (stock === 0 ? " (OUT OF STOCK)" : stock <= 3 ? ` (${stock} left)` : "")
        : (stock === 0 ? " (HABIS)" : stock <= 3 ? ` (sisa ${stock})` : "");
      const parts = [`${counter}. ${product.name} — ${formatPrice(product.price)}${stockInfo}`];
      const ingredients = Array.isArray(product.ingredients) ? product.ingredients : [];
      if (ingredients.length > 0) {
        const top = ingredients.slice(0, 5);
        const suffix = ingredients.length > 5 ? (locale === "en" ? ", etc." : " dll") : "";
        parts.push(`${locale === "en" ? "Ingredients" : "Kandungan"}: ${top.join(", ")}${suffix}`);
      }
      if (product.tag) parts.push(`${locale === "en" ? "Target" : "Target"}: ${product.tag}`);
      if (product.blurb) parts.push(product.blurb);
      if (Array.isArray(product.bundleItems) && product.bundleItems.length > 0) {
        const names = product.bundleItems.map((id) => {
          const item = products.find((candidate) => candidate.id === id);
          return item ? localizedProduct(item, locale).name : id;
        });
        parts.push(`${locale === "en" ? "Includes" : "Isi"}: ${names.join(" + ")}`);
        if (product.originalPrice) parts.push(`${locale === "en" ? "Regular price" : "Asli"}: ${formatPrice(product.originalPrice)}`);
      }
      output += `${parts.join(" | ")}\n`;
      counter += 1;
    }
  }

  return output;
}

function buildCouponSection(coupons, locale) {
  let output = locale === "en" ? "== ACTIVE COUPONS ==\n" : "== KUPON AKTIF ==\n";
  coupons.forEach((coupon) => {
    const discount = coupon.type === "percent"
      ? (locale === "en" ? `${coupon.value}% off` : `diskon ${coupon.value}%`)
      : (locale === "en" ? `${formatPrice(coupon.value)} off` : `potongan ${formatPrice(coupon.value)}`);
    const minimum = Number(coupon.minOrder || 0) > 0
      ? (locale === "en" ? `, minimum order ${formatPrice(coupon.minOrder)}` : `, minimal pembelian ${formatPrice(coupon.minOrder)}`)
      : (locale === "en" ? ", no minimum order" : ", tanpa minimum order");
    const description = locale === "en" ? (coupon.descEn || coupon.desc || "") : (coupon.desc || "");
    output += `- ${coupon.code || coupon.id}: ${discount}${minimum}. ${description}\n`;
  });
  output += locale === "en"
    ? "How to use a coupon: enter the code during checkout before payment.\n"
    : "Cara pakai kupon: masukkan kode kupon di halaman checkout sebelum pembayaran.\n";
  return output;
}

function englishPrompt(productSection, couponSection, knowledgeSection) {
  return `You are GESA (Geschäft Assistant), the virtual customer-service assistant for the Morgen Geschäft online skincare store.
Always answer in natural, friendly, concise English unless the customer explicitly asks for Indonesian.

== RESPONSE FORMAT ==
- Do not use markdown formatting such as **bold**, *italic*, headings, or hyphen bullets.
- Write natural WhatsApp-style paragraphs.
- Keep each answer to about 3–4 sentences unless a longer explanation is necessary.

== PRODUCT MATCHING ==
- When a customer gives an approximate product name, match it to the closest product in the list and mention its full name, price, and main benefit.
- Do not ask for clarification when a reliable match is already possible.
- If an item is out of stock, say so and offer an available alternative.
- Never invent products, prices, stock, coupons, or store policies.

== ESCALATION ==
For serious complaints, specific shipping disputes, refunds, payment problems, or medical/diagnostic skin questions, reply with this exact sentence:
"I’ll connect you with our Customer Service team for this question. Please click the 'Contact Customer Service on WhatsApp' button below for further assistance 🙏"
The exact phrase "Contact Customer Service on WhatsApp" must be included so the website can display the button.

== STORE INFORMATION ==
Name: Morgen Geschäft
Tagline: Authentic, curated skincare with clear product information.
Customer Service WhatsApp: 6289601725019
Shopee: https://s.shopee.co.id/3qKoPG98iY
Telegram Bot: https://t.me/MorgenGeschaftBot
TikTok: https://www.tiktok.com/@morgengeschaft
Customer Service hours: Monday–Saturday, 09:00–21:00 WIB.

${productSection}
== SKINCARE ROUTINE GUIDANCE ==
Oily and acne-prone skin: morning—Kahf Oil and Acne Care Face Wash, The Originote Acne B5 Serum, then Implora Sunscreen; evening—cleanser, then serum.
Dull or tired-looking skin: morning—Kahf Energizing and Brightening Face Wash, then sunscreen; evening—Kahf Bright Revitalizing AminoGel.
Sensitive skin: morning—Somethinc Low pH Gentle Jelly Cleanser, then sunscreen; evening—cleanser, then The Originote Acne B5 Serum if tolerated.
Blackheads and enlarged pores: morning and evening—Kahf Triple Action Oil and Comedo Defense; add sunscreen in the morning.

${couponSection}
${knowledgeSection}
== GENERAL RULES ==
- Only answer questions about skincare, products, orders, and store services. Politely decline unrelated topics.
- Use "helps" and avoid exaggerated medical claims.
- Do not diagnose skin conditions. Recommend consulting a dermatologist for serious or persistent concerns.
- If a requested product is unavailable, say it is not currently available and suggest a relevant alternative.
- Refer wholesale or reseller enquiries to Customer Service on WhatsApp.`;
}

function indonesianPrompt(productSection, couponSection, knowledgeSection) {
  return `Kamu adalah GESA (Geschäft Assistant), asisten customer service virtual untuk toko skincare online Morgen Geschäft.
Jawab dengan ramah, singkat, dan informatif dalam Bahasa Indonesia, kecuali pelanggan secara jelas meminta jawaban bahasa Inggris.

== ATURAN FORMAT ==
- Jangan gunakan markdown seperti **bold**, *italic*, heading, atau bullet dengan tanda minus.
- Tulis dalam paragraf natural seperti chat WhatsApp.
- Maksimal sekitar 3–4 kalimat per jawaban kecuali penjelasan panjang memang dibutuhkan.

== ATURAN PENCOCOKAN PRODUK ==
- Jika pelanggan menyebut nama produk yang mirip, cocokkan dengan produk terdekat lalu sebutkan nama lengkap, harga, dan manfaat utamanya.
- Jangan meminta klarifikasi jika kecocokannya sudah cukup jelas.
- Jika stok habis, beri tahu dan tawarkan alternatif yang tersedia.
- Jangan mengarang produk, harga, stok, kupon, atau kebijakan toko.

== ATURAN ESKALASI KE CS ==
Untuk komplain berat, masalah pengiriman spesifik, refund, masalah pembayaran, atau pertanyaan medis/diagnosis kulit, gunakan kalimat persis berikut:
"Untuk pertanyaan ini, saya hubungkan kamu dengan tim CS kami ya. Silakan klik tombol 'Chat CS via WhatsApp' di bawah untuk bantuan lebih lanjut 🙏"

== INFORMASI TOKO ==
Nama: Morgen Geschäft
Tagline: Produk skincare original, terkurasi, dengan informasi yang jelas.
WhatsApp CS: 6289601725019
Shopee: https://s.shopee.co.id/3qKoPG98iY
Telegram Bot: https://t.me/MorgenGeschaftBot
TikTok: https://www.tiktok.com/@morgengeschaft
Jam operasional CS: Senin–Sabtu, 09.00–21.00 WIB.

${productSection}
== REKOMENDASI RUTINITAS ==
Kulit berminyak dan berjerawat: pagi—Kahf Oil and Acne Care Face Wash, The Originote Acne B5 Serum, lalu Implora Sunscreen; malam—cleanser lalu serum.
Kulit kusam dan lelah: pagi—Kahf Energizing and Brightening Face Wash lalu sunscreen; malam—Kahf Bright Revitalizing AminoGel.
Kulit sensitif: pagi—Somethinc Low pH Gentle Jelly Cleanser lalu sunscreen; malam—cleanser lalu The Originote Acne B5 Serum jika cocok.
Komedo dan pori besar: pagi dan malam—Kahf Triple Action Oil and Comedo Defense; tambahkan sunscreen pada pagi hari.

${couponSection}
${knowledgeSection}
== ATURAN UMUM ==
- Jawab hanya topik skincare, produk, pesanan, dan layanan toko. Tolak sopan topik lain.
- Gunakan kata "membantu" dan hindari klaim kesehatan berlebihan.
- Jangan mendiagnosis kondisi kulit. Sarankan dokter kulit untuk masalah serius atau berkepanjangan.
- Jika produk tidak tersedia, katakan belum tersedia dan tawarkan alternatif.
- Pertanyaan grosir/reseller diarahkan ke WhatsApp CS.`;
}

export async function buildSystemPrompt(localeInput = "id") {
  const locale = localeInput === "en" ? "en" : "id";
  const cached = promptCache.get(locale);
  if (cached && Date.now() - cached.createdAt < PROMPT_CACHE_TTL) return cached.prompt;

  try {
    const db = getAdminDb();
    const [productsSnap, couponsSnap, knowledgeSnap] = await Promise.all([
      db.collection("products").get(),
      db.collection("coupons").get(),
      // Koleksi opsional; jika belum ada, Firestore hanya mengembalikan snapshot kosong.
      db.collection("gesa_knowledge").get().catch(() => ({ docs: [] })),
    ]);
    const products = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const coupons = couponsSnap.docs.map((doc) => ({ code: doc.id, ...doc.data() }));
    const knowledgeDocs = (knowledgeSnap.docs || []).map((doc) => ({ id: doc.id, ...doc.data() }));
    const productSection = buildProductSection(products, locale);
    const couponSection = buildCouponSection(coupons, locale);
    // Gabungkan pengetahuan statis (kode) + dinamis (admin via Firestore).
    const knowledgeSection = `${buildStaticKnowledge(locale)}\n\n${buildDynamicKnowledge(knowledgeDocs, locale)}`;
    const prompt = locale === "en"
      ? englishPrompt(productSection, couponSection, knowledgeSection)
      : indonesianPrompt(productSection, couponSection, knowledgeSection);
    promptCache.set(locale, { prompt, createdAt: Date.now() });
    return prompt;
  } catch (error) {
    console.error("buildSystemPrompt error:", error);
    const fallback = locale === "en"
      ? "You are GESA, the Morgen Geschäft assistant. Answer briefly and helpfully in English."
      : "Kamu adalah GESA, asisten Morgen Geschäft. Jawab dalam Bahasa Indonesia, ramah dan singkat.";
    return promptCache.get(locale)?.prompt || fallback;
  }
}
