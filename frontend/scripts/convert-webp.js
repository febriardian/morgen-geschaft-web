#!/usr/bin/env node
/**
 * convert-webp.js
 * 
 * Converts all .png and .jpg images in /public/photos/ to .webp format.
 * Run this before build: node scripts/convert-webp.js
 * 
 * Requires: npm install sharp --save-dev
 * 
 * Output: creates .webp files alongside originals (e.g., foto.png → foto.webp)
 * The OptimizedImage component in App.jsx will then serve WebP via <picture><source>.
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHOTO_DIR = path.resolve(__dirname, "../photos");
const QUALITY = 80;

async function convertAll() {
  if (!fs.existsSync(PHOTO_DIR)) {
    console.log(`Folder ${PHOTO_DIR} tidak ditemukan. Skip.`);
    return;
  }

  const files = fs.readdirSync(PHOTO_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f));
  console.log(`Ditemukan ${files.length} gambar untuk dikonversi ke WebP...\n`);

  let converted = 0;
  let skipped = 0;

  for (const file of files) {
    const inputPath = path.join(PHOTO_DIR, file);
    const outputPath = path.join(PHOTO_DIR, file.replace(/\.(png|jpe?g)$/i, ".webp"));

    // Skip if WebP already exists and is newer than source
    if (fs.existsSync(outputPath)) {
      const srcStat = fs.statSync(inputPath);
      const webpStat = fs.statSync(outputPath);
      if (webpStat.mtimeMs >= srcStat.mtimeMs) {
        skipped++;
        continue;
      }
    }

    try {
      const info = await sharp(inputPath)
        .webp({ quality: QUALITY })
        .toFile(outputPath);

      const srcSize = fs.statSync(inputPath).size;
      const savings = ((1 - info.size / srcSize) * 100).toFixed(1);
      console.log(`  ✓ ${file} → ${path.basename(outputPath)} (${savings}% smaller)`);
      converted++;
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  console.log(`\nSelesai: ${converted} dikonversi, ${skipped} sudah up-to-date.`);
}

convertAll();