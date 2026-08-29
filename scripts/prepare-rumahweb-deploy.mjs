import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const FRONTEND_DIST = path.join(PROJECT_ROOT, "frontend", "dist");
const BACKEND_PUBLIC = path.join(PROJECT_ROOT, "backend", "public");

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

if (!(await pathExists(path.join(FRONTEND_DIST, "index.html")))) {
  throw new Error("frontend/dist belum tersedia. Jalankan build frontend terlebih dahulu.");
}

await fs.rm(BACKEND_PUBLIC, { recursive: true, force: true });
await fs.mkdir(BACKEND_PUBLIC, { recursive: true });
await fs.cp(FRONTEND_DIST, BACKEND_PUBLIC, { recursive: true });

console.log("Frontend production disalin ke backend/public untuk deployment satu domain.");
