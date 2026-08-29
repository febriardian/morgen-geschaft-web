// generate-favicons.js
// Menghasilkan file favicon dari logo asli.
// Cara pakai: npm run favicons:generate

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const SRC_ORIGINAL = path.join(FRONTEND_ROOT, "photos", "logo 512.png");
const SRC_RENAMED = path.join(FRONTEND_ROOT, "photos", "logo-512.png");
const OUT = path.join(FRONTEND_ROOT, "public");

// Step 1: Salin logo tanpa spasi (fix OG image URL)
if (fs.existsSync(SRC_ORIGINAL) && !fs.existsSync(SRC_RENAMED)) {
  fs.copyFileSync(SRC_ORIGINAL, SRC_RENAMED);
  console.log("✅ Disalin: logo 512.png → logo-512.png");
}

const logo = fs.existsSync(SRC_RENAMED) ? SRC_RENAMED : SRC_ORIGINAL;

if (!fs.existsSync(logo)) {
  console.error(`❌ File ${logo} tidak ditemukan.`);
  process.exit(1);
}

// Step 2: Generate semua ukuran
const sizes = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
];

for (const { name, size } of sizes) {
  const output = path.join(OUT, name);
  await sharp(logo).resize(size, size).png().toFile(output);
  console.log(`✅ ${name} (${size}x${size})`);
}

console.log("\n🎉 Semua favicon berhasil di-generate di public/");
console.log("\nJangan lupa update manifest.json icons juga.");