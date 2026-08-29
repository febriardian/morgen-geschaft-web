import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const ignoredDirectories = new Set(["node_modules", ".git", "dist", ".vite", "coverage"]);
const findings = [];

const sensitivePathPatterns = [
  /(^|[\\/])storage[\\/]backups([\\/]|$)/i,
  /(^|[\\/])backups([\\/]|$)/i,
  /(^|[\\/])storage[\\/]logs[\\/].+\.log$/i,
  /(^|[\\/])infra[\\/]logs[\\/].+\.log$/i,
  /firebase-service-account.*\.json$/i,
  /service-account.*\.json$/i,
];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(projectRoot, fullPath);

    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    if (sensitivePathPatterns.some((pattern) => pattern.test(relative))) {
      findings.push(relative);
    }
  }
}

await walk(projectRoot);

const localEnvFiles = [
  "backend/.env",
  "frontend/.env.local",
  "frontend/.env.production",
];

console.log("Audit file sensitif sebelum ZIP/deploy\n");

if (findings.length === 0) {
  console.log("OK — backup, log runtime, dan service-account JSON tidak ditemukan di area project yang dibagikan.");
} else {
  console.log("GAGAL — file berikut harus dibersihkan sebelum project dibagikan:");
  for (const item of findings.sort()) console.log(`- ${item}`);
  console.log("\nJalankan: npm run privacy:cleanup");
  process.exitCode = 1;
}

for (const envPath of localEnvFiles) {
  try {
    await fs.access(path.join(projectRoot, envPath));
    console.log(`INFO — ${envPath} ada untuk penggunaan lokal. Pastikan tidak dimasukkan ke ZIP hosting.`);
  } catch {
    // Tidak ada, tidak perlu ditampilkan.
  }
}
