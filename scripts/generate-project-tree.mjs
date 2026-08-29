import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const TREE_FILE = path.join(ROOT, "PROJECT_TREE.md");
const SNAPSHOT_FILE = path.join(ROOT, ".project-tree.json");
const isCheck = process.argv.includes("--check");

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".vercel",
  ".vite",
  "coverage",
  ".idea",
  ".vscode",
]);

const IGNORED_RUNTIME_PATHS = [
  /^backups(?:\/|$)/,
  /^storage(?:\/|$)/,
  /^backend\/logs(?:\/|$)/,
  /^backend\/uploads(?:\/|$)/,
  /^backend\/storage\/(?:logs|uploads)(?:\/|$)/,
  /^infra\/logs(?:\/|$)/,
  /^\.cookie-consent-fix-backup-/,
];

const COMPACT_TREE_DIRS = new Set([
  "frontend/photos",
]);

const IGNORED_FILES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "npm-debug.log",
  "yarn-error.log",
]);

const GENERATED_FILES = new Set([
  "PROJECT_TREE.md",
  ".project-tree.json",
]);

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function isEnvironmentFile(relativePath, name) {
  if (name === ".env.example") return false;
  return name === ".env" || name.startsWith(".env.");
}

function shouldIgnore(fullPath, entry) {
  const rel = relative(fullPath);
  if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) return true;
  if (IGNORED_RUNTIME_PATHS.some((pattern) => pattern.test(rel))) return true;
  if (entry.isFile() && IGNORED_FILES.has(entry.name)) return true;
  if (entry.isFile() && isEnvironmentFile(rel, entry.name)) return true;
  return false;
}

function readEntries(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => !shouldIgnore(path.join(dirPath, entry.name), entry))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" });
    });
}

function countFiles(dirPath) {
  let count = 0;
  for (const entry of readEntries(dirPath)) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) count += countFiles(fullPath);
    else count += 1;
  }
  return count;
}

function buildTree(dirPath, prefix = "") {
  const entries = readEntries(dirPath);
  const lines = [];

  entries.forEach((entry, index) => {
    const last = index === entries.length - 1;
    const connector = last ? "└── " : "├── ";
    const fullPath = path.join(dirPath, entry.name);
    const rel = relative(fullPath);

    if (entry.isDirectory() && COMPACT_TREE_DIRS.has(rel)) {
      lines.push(`${prefix}${connector}${entry.name}/ (${countFiles(fullPath)} files)`);
      return;
    }

    lines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? "/" : ""}`);

    if (entry.isDirectory()) {
      lines.push(...buildTree(fullPath, `${prefix}${last ? "    " : "│   "}`));
    }
  });

  return lines;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function collectManifest(dirPath = ROOT, result = {}) {
  for (const entry of readEntries(dirPath)) {
    const fullPath = path.join(dirPath, entry.name);
    const rel = relative(fullPath);
    if (entry.isDirectory()) {
      collectManifest(fullPath, result);
    } else if (!GENERATED_FILES.has(rel)) {
      const stat = fs.statSync(fullPath);
      result[rel] = {
        size: stat.size,
        sha256: sha256(fullPath),
      };
    }
  }
  return result;
}

function compareManifest(previous, current) {
  const previousFiles = new Set(Object.keys(previous));
  const currentFiles = new Set(Object.keys(current));

  const added = [...currentFiles].filter((file) => !previousFiles.has(file)).sort();
  const removed = [...previousFiles].filter((file) => !currentFiles.has(file)).sort();
  const changed = [...currentFiles]
    .filter((file) => previousFiles.has(file) && previous[file]?.sha256 !== current[file]?.sha256)
    .sort();

  return { added, removed, changed };
}

function printChanges({ added, removed, changed }) {
  if (!added.length && !removed.length && !changed.length) {
    console.log("Tidak ada perubahan struktur atau isi file sejak snapshot terakhir.");
    return false;
  }

  console.log("Perubahan project terdeteksi:\n");
  if (added.length) {
    console.log("File baru:");
    added.forEach((file) => console.log(`  + ${file}`));
  }
  if (removed.length) {
    console.log("\nFile dihapus:");
    removed.forEach((file) => console.log(`  - ${file}`));
  }
  if (changed.length) {
    console.log("\nIsi file berubah:");
    changed.forEach((file) => console.log(`  ~ ${file}`));
  }
  return true;
}

const currentManifest = collectManifest();

if (isCheck) {
  if (!fs.existsSync(SNAPSHOT_FILE)) {
    console.error("Snapshot belum ada. Jalankan `npm run tree` terlebih dahulu.");
    process.exit(1);
  }

  const previousManifest = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
  const hasChanges = printChanges(compareManifest(previousManifest, currentManifest));
  process.exit(hasChanges ? 1 : 0);
}

const treeLines = ["Morgen Geschaft Project/", ...buildTree(ROOT)];
const fileCount = Object.keys(currentManifest).length;
const directoryCount = treeLines.filter((line) => line.endsWith("/")).length;
const generatedAt = new Date().toISOString();

const markdown = `# Morgen Geschäft — Project Tree\n\n` +
  `Dokumen ini dibuat otomatis untuk membantu memantau perubahan struktur project.\n\n` +
  `- Terakhir diperbarui: \`${generatedAt}\`\n` +
  `- Jumlah file yang dipantau: **${fileCount}**\n` +
  `- Jumlah folder yang ditampilkan: **${directoryCount}**\n` +
  `- Folder runtime, dependency, build, backup, log, upload, cache, serta file rahasia \`.env\` tidak ditampilkan.\n` +
  `- Folder \`frontend/photos\` diringkas pada tree, tetapi seluruh file gambarnya tetap dipantau oleh snapshot.\n\n` +
  `## Struktur project\n\n` +
  `\`\`\`text\n${treeLines.join("\n")}\n\`\`\`\n\n` +
  `## Memperbarui tree\n\n` +
  `Jalankan dari folder utama project:\n\n` +
  `\`\`\`powershell\nnpm run tree\n\`\`\`\n\n` +
  `## Mengecek perubahan\n\n` +
  `\`\`\`powershell\nnpm run tree:check\n\`\`\`\n\n` +
  `Tanda hasil pengecekan:\n\n` +
  `- \`+\` file baru\n` +
  `- \`-\` file dihapus\n` +
  `- \`~\` isi file berubah\n\n` +
  `> Folder foto tetap berada di \`frontend/photos\` karena jalur tersebut masih digunakan oleh aplikasi dan proses build.\n`;

fs.writeFileSync(TREE_FILE, markdown, "utf8");
fs.writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(currentManifest, null, 2)}\n`, "utf8");

console.log(`PROJECT_TREE.md diperbarui (${fileCount} file dipantau).`);
