import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

const directoriesToRemove = [
  path.join(projectRoot, "storage", "backups"),
  path.join(projectRoot, "backups"),
  path.join(projectRoot, "backend", "storage", "backups"),
];

const runtimeLogDirectories = [
  path.join(projectRoot, "backend", "storage", "logs"),
  path.join(projectRoot, "infra", "logs"),
];

for (const target of directoriesToRemove) {
  await fs.rm(target, { recursive: true, force: true });
}

for (const directory of runtimeLogDirectories) {
  await fs.mkdir(directory, { recursive: true });
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || entry.name === ".gitkeep") continue;
    await fs.rm(path.join(directory, entry.name), { force: true });
  }
  await fs.writeFile(path.join(directory, ".gitkeep"), "", { flag: "a" });
}

console.log("Backup pelanggan dan log runtime sudah dibersihkan dari folder project.");
console.log("File .env lokal tidak dihapus. Pastikan .env tidak dimasukkan ke ZIP hosting.");
