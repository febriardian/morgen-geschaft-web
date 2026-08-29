#!/usr/bin/env node
// =============================================================================
// biteship-setup.js
// Jalankan: npm run setup:biteship
//
// Script ini melakukan 3 hal:
// 1. Cari area_id untuk Kab. Semarang, Kab. Cirebon, Kota Cirebon
// 2. Buat 2 test order (untuk simulasi Delivered & Cancelled di dashboard)
// 3. Seed Firestore doc settings/shipping dengan data yang benar
//
// Sebelum jalankan:
//   - Pastikan .env ada FIREBASE_SERVICE_ACCOUNT_BASE64 dan BITESHIP_API_KEY
// =============================================================================

import dotenv from "dotenv";
dotenv.config();

// FIX #1: Ambil API key dari environment variable, bukan hardcode
const BITESHIP_API_KEY = process.env.BITESHIP_API_KEY;
if (!BITESHIP_API_KEY) {
  console.error("❌ BITESHIP_API_KEY belum diset di .env");
  process.exit(1);
}

const BITESHIP_BASE = "https://api.biteship.com";

async function searchArea(input) {
  const res = await fetch(
    `${BITESHIP_BASE}/v1/maps/areas?countries=ID&input=${encodeURIComponent(input)}&type=single`,
    { headers: { Authorization: BITESHIP_API_KEY } }
  );
  const data = await res.json();
  if (!res.ok) { console.error("Biteship error:", data); return []; }
  return data.areas || [];
}

async function main() {
  console.log("🔍 Mencari area...\n");

  const queries = ["Kab Semarang", "Kab Cirebon", "Kota Cirebon"];
  for (const q of queries) {
    const areas = await searchArea(q);
    console.log(`\n📍 ${q}:`);
    for (const a of areas.slice(0, 3)) {
      console.log(`  ${a.id} — ${a.name}`);
    }
  }

  console.log("\n✅ Selesai. Gunakan area_id di atas untuk seed Firestore settings/shipping.");
}

main().catch(console.error);
