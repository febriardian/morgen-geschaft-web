import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const moved = [];
const updated = [];
const removed = [];
const warnings = [];

const p = (relativePath) => path.join(ROOT, relativePath);
const rel = (absolutePath) => path.relative(ROOT, absolutePath).split(path.sep).join("/") || ".";

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function hashFile(target) {
  return crypto.createHash("sha256").update(await fs.readFile(target)).digest("hex");
}

async function removeWithRetry(target, recursive = false) {
  if (!(await exists(target))) return true;

  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      await fs.rm(target, {
        recursive,
        force: true,
        maxRetries: 3,
        retryDelay: 120,
      });
      return true;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    }
  }

  warnings.push(`${rel(target)} belum dapat dihapus (${lastError?.code || lastError?.message || "file sedang dipakai"}).`);
  return false;
}

async function moveFile(sourceRelative, destinationRelative) {
  const source = p(sourceRelative);
  const destination = p(destinationRelative);
  if (!(await exists(source))) return false;

  const sourceStat = await fs.stat(source);
  if (!sourceStat.isFile()) return false;

  await ensureDir(path.dirname(destination));

  if (await exists(destination)) {
    const destinationStat = await fs.stat(destination);
    if (!destinationStat.isFile()) {
      throw new Error(`Tujuan ${destinationRelative} bukan file.`);
    }

    const [sourceHash, destinationHash] = await Promise.all([
      hashFile(source),
      hashFile(destination),
    ]);

    if (sourceHash !== destinationHash) {
      throw new Error(
        `Tidak aman menimpa ${destinationRelative} karena isinya berbeda dari ${sourceRelative}.`,
      );
    }
  } else {
    await fs.copyFile(source, destination);
    const [sourceHash, destinationHash] = await Promise.all([
      hashFile(source),
      hashFile(destination),
    ]);
    if (sourceHash !== destinationHash) {
      await removeWithRetry(destination);
      throw new Error(`Verifikasi pemindahan ${sourceRelative} gagal.`);
    }
  }

  if (await removeWithRetry(source)) {
    moved.push(`${sourceRelative} -> ${destinationRelative}`);
  }
  return true;
}

async function moveFirstAvailable(candidates, destinationRelative) {
  for (const candidate of candidates) {
    if (await exists(p(candidate))) {
      await moveFile(candidate, destinationRelative);
      return candidate;
    }
  }
  return null;
}

async function moveDirectoryContents(sourceRelative, destinationRelative) {
  const source = p(sourceRelative);
  const destination = p(destinationRelative);
  if (!(await exists(source))) return false;

  const stat = await fs.stat(source);
  if (!stat.isDirectory()) return false;

  await ensureDir(destination);
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourceChild = path.posix.join(sourceRelative.replaceAll("\\", "/"), entry.name);
    const destinationChild = path.posix.join(destinationRelative.replaceAll("\\", "/"), entry.name);

    if (entry.isDirectory()) {
      await moveDirectoryContents(sourceChild, destinationChild);
    } else if (entry.isFile()) {
      await moveFile(sourceChild, destinationChild);
    }
  }

  const remaining = await fs.readdir(source).catch(() => []);
  if (remaining.length === 0 && await removeWithRetry(source, true)) {
    removed.push(sourceRelative);
  }
  return true;
}

async function removeEmptyDirectory(relativePath) {
  const target = p(relativePath);
  if (!(await exists(target))) return;
  const stat = await fs.stat(target);
  if (!stat.isDirectory()) return;
  const entries = await fs.readdir(target);
  if (entries.length === 0 && await removeWithRetry(target, true)) {
    removed.push(relativePath);
  }
}

async function readText(relativePath) {
  return fs.readFile(p(relativePath), "utf8");
}

async function writeText(relativePath, content) {
  const target = p(relativePath);
  await ensureDir(path.dirname(target));
  const previous = await exists(target) ? await fs.readFile(target, "utf8") : "";
  if (previous === content) return false;
  await fs.writeFile(target, content, "utf8");
  updated.push(relativePath);
  return true;
}

async function replaceText(relativePath, replacements) {
  if (!(await exists(p(relativePath)))) return false;
  const original = await readText(relativePath);
  let next = original;
  for (const [search, replacement] of replacements) {
    next = next.split(search).join(replacement);
  }
  return writeText(relativePath, next);
}

async function transformText(relativePath, transformer) {
  if (!(await exists(p(relativePath)))) return false;
  const original = await readText(relativePath);
  return writeText(relativePath, transformer(original));
}

async function updateJson(relativePath, updater) {
  if (!(await exists(p(relativePath)))) return false;
  const original = await readText(relativePath);
  const data = JSON.parse(original);
  const result = updater(data) || data;
  return writeText(relativePath, `${JSON.stringify(result, null, 2)}\n`);
}

async function ensureGitkeep(relativeDirectory) {
  await ensureDir(p(relativeDirectory));
  const gitkeep = path.posix.join(relativeDirectory, ".gitkeep");
  if (!(await exists(p(gitkeep)))) {
    await writeText(gitkeep, "");
  }
}

async function mergeAccidentalPhotoFolder() {
  const accidental = "frontend/assets/photos";
  const canonical = "frontend/photos";
  if (!(await exists(p(accidental)))) return;

  await ensureDir(p(canonical));

  async function merge(currentRelative, destinationRelative) {
    const entries = await fs.readdir(p(currentRelative), { withFileTypes: true });
    for (const entry of entries) {
      const sourceChild = path.posix.join(currentRelative, entry.name);
      const destinationChild = path.posix.join(destinationRelative, entry.name);

      if (entry.isDirectory()) {
        await ensureDir(p(destinationChild));
        await merge(sourceChild, destinationChild);
        await removeEmptyDirectory(sourceChild);
        continue;
      }

      if (!entry.isFile()) continue;

      if (!(await exists(p(destinationChild)))) {
        await moveFile(sourceChild, destinationChild);
        continue;
      }

      const [sourceHash, destinationHash] = await Promise.all([
        hashFile(p(sourceChild)),
        hashFile(p(destinationChild)),
      ]);

      if (sourceHash === destinationHash) {
        if (await removeWithRetry(p(sourceChild))) {
          removed.push(sourceChild);
        }
        continue;
      }

      const extension = path.extname(entry.name);
      const base = path.basename(entry.name, extension);
      let index = 1;
      let recoveredRelative;
      do {
        recoveredRelative = path.posix.join(
          destinationRelative,
          `${base}-recovered-${index}${extension}`,
        );
        index += 1;
      } while (await exists(p(recoveredRelative)));

      await moveFile(sourceChild, recoveredRelative);
      warnings.push(`${sourceChild} berbeda dari file utama dan disimpan sebagai ${recoveredRelative}.`);
    }
  }

  await merge(accidental, canonical);
  await removeEmptyDirectory(accidental);
  await removeEmptyDirectory("frontend/assets");
}

async function migrateBackend() {
  console.log("[1/4] Merapikan backend...");

  await moveDirectoryContents("backend/middleware", "backend/src/middleware");
  await moveDirectoryContents("backend/routes", "backend/src/routes");
  await moveDirectoryContents("backend/services", "backend/src/services");

  await moveFirstAvailable(
    ["backend/server.js"],
    "backend/src/server.js",
  );
  await moveFirstAvailable(
    ["backend/_firebaseAdmin.js", "backend/config/firebaseAdmin.js"],
    "backend/src/config/firebaseAdmin.js",
  );
  await moveFirstAvailable(
    ["backend/utils.js", "backend/utils/index.js"],
    "backend/src/utils/index.js",
  );
  await moveFirstAvailable(
    ["backend/invoiceEmail.js", "backend/src/services/invoiceEmail.js"],
    "backend/src/services/email/invoiceEmail.js",
  );
  await moveFirstAvailable(
    ["backend/invoicePdf.js", "backend/src/services/invoicePdf.js"],
    "backend/src/services/email/invoicePdf.js",
  );

  await moveDirectoryContents("backend/__tests__", "backend/tests");
  await moveFirstAvailable(
    ["backend/biteship-setup.js"],
    "backend/scripts/biteship-setup.js",
  );
  await moveFirstAvailable(
    ["backend/ecosystem.config.cjs"],
    "backend/config/ecosystem.config.cjs",
  );

  await moveDirectoryContents("backend/logs", "backend/storage/logs");
  await moveDirectoryContents("backend/uploads", "backend/storage/uploads");
  await ensureGitkeep("backend/storage/logs");
  await ensureGitkeep("backend/storage/uploads");

  await removeEmptyDirectory("backend/middleware");
  await removeEmptyDirectory("backend/routes");
  await removeEmptyDirectory("backend/services");
  await removeEmptyDirectory("backend/utils");
  await removeEmptyDirectory("backend/__tests__");

  await replaceText("backend/src/server.js", [
    ['from "./_firebaseAdmin.js"', 'from "./config/firebaseAdmin.js"'],
    ["node server.js", "node src/server.js"],
  ]);

  const middlewareFiles = ["auth.js", "rateLimiter.js"];
  for (const file of middlewareFiles) {
    await replaceText(`backend/src/middleware/${file}`, [
      ['from "../_firebaseAdmin.js"', 'from "../config/firebaseAdmin.js"'],
    ]);
  }

  const routeFiles = [
    "admin.js",
    "checkout.js",
    "health.js",
    "orders.js",
    "products.js",
    "seo.js",
    "shipping.js",
  ];
  for (const file of routeFiles) {
    await replaceText(`backend/src/routes/${file}`, [
      ['from "../_firebaseAdmin.js"', 'from "../config/firebaseAdmin.js"'],
      ['from "../utils.js"', 'from "../utils/index.js"'],
      ['from "../invoicePdf.js"', 'from "../services/email/invoicePdf.js"'],
    ]);
  }

  const serviceFiles = [
    "email.js",
    "gesaPrompt.js",
    "notifications.js",
    "orders.js",
  ];
  for (const file of serviceFiles) {
    await replaceText(`backend/src/services/${file}`, [
      ['from "../_firebaseAdmin.js"', 'from "../config/firebaseAdmin.js"'],
    ]);
  }

  await replaceText("backend/src/services/email.js", [
    ['from "../invoicePdf.js"', 'from "./email/invoicePdf.js"'],
    ['from "../invoiceEmail.js"', 'from "./email/invoiceEmail.js"'],
    ['from "./invoicePdf.js"', 'from "./email/invoicePdf.js"'],
    ['from "./invoiceEmail.js"', 'from "./email/invoiceEmail.js"'],
  ]);

  await replaceText("backend/src/services/email/invoicePdf.js", [
    ['from "./services/logger.js"', 'from "../logger.js"'],
    ['from "./logger.js"', 'from "../logger.js"'],
  ]);

  await replaceText("backend/src/routes/admin.js", [
    ['path.join(process.cwd(), "uploads")', 'path.join(process.cwd(), "storage", "uploads")'],
  ]);

  await replaceText("backend/tests/security.test.js", [
    ['from "../utils.js"', 'from "../src/utils/index.js"'],
    ['from "../utils/index.js"', 'from "../src/utils/index.js"'],
  ]);

  await replaceText("backend/.env.example", [
    ["UPLOAD_DIR=./uploads", "UPLOAD_DIR=./storage/uploads"],
    ["# Default: ./uploads di working directory.", "# Default: ./storage/uploads di working directory."],
  ]);

  await updateJson("backend/package.json", (data) => {
    data.main = "src/server.js";
    data.scripts ||= {};
    data.scripts.start = "node src/server.js";
    data.scripts.dev = "node --watch src/server.js";
    data.scripts.test = "node --test";
    data.scripts["setup:biteship"] = "node scripts/biteship-setup.js";
    data.scripts["backup:firestore"] = "node scripts/firestore-backup-json.js";
    data.scripts["pm2:start"] = "pm2 start config/ecosystem.config.cjs";
    return data;
  });

  await transformText("backend/config/ecosystem.config.cjs", (original) => {
    let next = original;
    if (!next.includes('require("node:path")')) {
      next = `const path = require("node:path");\n\n${next}`;
    }
    next = next
      .replaceAll("pm2 start ecosystem.config.cjs", "pm2 start config/ecosystem.config.cjs")
      .replace('script: "server.js",', 'script: "src/server.js",')
      .replace('error_file: "./logs/pm2-error.log",', 'error_file: "./storage/logs/pm2-error.log",')
      .replace('out_file: "./logs/pm2-out.log",', 'out_file: "./storage/logs/pm2-out.log",');

    if (!next.includes('cwd: path.resolve(__dirname, "..")')) {
      next = next.replace(
        'name: "morgen-backend",',
        'name: "morgen-backend",\n      cwd: path.resolve(__dirname, ".."),',
      );
    }
    return next;
  });

  await transformText("backend/scripts/biteship-setup.js", (original) => {
    let next = original.replaceAll("node biteship-setup.js", "npm run setup:biteship");
    if (!next.includes('fileURLToPath(import.meta.url)')) {
      next = next
        .replace(
          'import dotenv from "dotenv";\ndotenv.config();',
          'import dotenv from "dotenv";\nimport path from "node:path";\nimport { fileURLToPath } from "node:url";\n\nconst __dirname = path.dirname(fileURLToPath(import.meta.url));\ndotenv.config({ path: path.resolve(__dirname, "../.env") });',
        );
    }
    return next;
  });

  await replaceText("backend/scripts/firestore-backup-json.js", [
    ['path.join(projectRoot, "backups", "firestore")', 'path.join(projectRoot, "storage", "backups", "firestore")'],
  ]);

  await transformText("backend/.gitignore", (original) => {
    const additions = [
      "storage/logs/*",
      "!storage/logs/.gitkeep",
      "storage/uploads/*",
      "!storage/uploads/.gitkeep",
    ];
    const filtered = original
      .split(/\r?\n/)
      .filter((line) => line !== "uploads/" && line !== "logs/");
    for (const line of additions) {
      if (!filtered.includes(line)) filtered.push(line);
    }
    return `${filtered.filter(Boolean).join("\n")}\n`;
  });
}

async function migrateFrontend() {
  console.log("[2/4] Merapikan frontend...");

  await mergeAccidentalPhotoFolder();

  await moveFirstAvailable(
    ["frontend/convert-webp.js"],
    "frontend/scripts/convert-webp.js",
  );
  await moveFirstAvailable(
    ["frontend/generate-favicons.js"],
    "frontend/scripts/generate-favicons.js",
  );
  await moveFirstAvailable(
    ["frontend/vite.config.js"],
    "frontend/config/vite.config.js",
  );
  await moveFirstAvailable(
    ["frontend/postcss.config.js"],
    "frontend/config/postcss.config.js",
  );
  await moveFirstAvailable(
    ["frontend/tailwind.config.js"],
    "frontend/config/tailwind.config.js",
  );

  await updateJson("frontend/package.json", (data) => {
    data.scripts ||= {};
    data.scripts.dev = "vite --config config/vite.config.js";
    data.scripts["build:webp"] = "node scripts/convert-webp.js";
    data.scripts.build = "node scripts/convert-webp.js && vite build --config config/vite.config.js";
    data.scripts.preview = "vite preview --config config/vite.config.js";
    data.scripts["favicons:generate"] = "node scripts/generate-favicons.js";
    return data;
  });

  await replaceText("frontend/scripts/convert-webp.js", [
    ['path.resolve(__dirname, "./photos")', 'path.resolve(__dirname, "../photos")'],
    ["node convert-webp.js", "node scripts/convert-webp.js"],
  ]);

  await transformText("frontend/scripts/generate-favicons.js", (original) => {
    let next = original.replaceAll("node generate-favicons.js", "npm run favicons:generate");
    if (!next.includes('fileURLToPath(import.meta.url)')) {
      next = next.replace(
        'import path from "path";',
        'import path from "path";\nimport { fileURLToPath } from "url";',
      );
    }

    if (!next.includes("const FRONTEND_ROOT")) {
      next = next.replace(
        'const SRC_ORIGINAL = "photos/logo 512.png";\nconst SRC_RENAMED = "photos/logo-512.png";\nconst OUT = "public";',
        'const __dirname = path.dirname(fileURLToPath(import.meta.url));\nconst FRONTEND_ROOT = path.resolve(__dirname, "..");\nconst SRC_ORIGINAL = path.join(FRONTEND_ROOT, "photos", "logo 512.png");\nconst SRC_RENAMED = path.join(FRONTEND_ROOT, "photos", "logo-512.png");\nconst OUT = path.join(FRONTEND_ROOT, "public");',
      );
    }
    return next;
  });

  await transformText("frontend/config/postcss.config.js", () => `import path from "node:path";\nimport { fileURLToPath } from "node:url";\nimport autoprefixer from "autoprefixer";\nimport tailwindcss from "tailwindcss";\n\nconst CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));\n\nexport default {\n  plugins: [\n    tailwindcss({\n      config: path.join(CONFIG_DIR, "tailwind.config.js"),\n    }),\n    autoprefixer(),\n  ],\n};\n`);

  await transformText("frontend/config/tailwind.config.js", (original) => {
    let next = original;
    if (!next.includes('fileURLToPath(import.meta.url)')) {
      next = next.replace(
        '/** @type {import(\'tailwindcss\').Config} */',
        'import path from "node:path";\nimport { fileURLToPath } from "node:url";\n\nconst CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));\nconst FRONTEND_ROOT = path.resolve(CONFIG_DIR, "..");\n\n/** @type {import(\'tailwindcss\').Config} */',
      );
    }
    next = next.replace(
      'content: ["./index.html", "./src/**/*.{js,jsx}"],',
      'content: [\n    path.join(FRONTEND_ROOT, "index.html"),\n    path.join(FRONTEND_ROOT, "src/**/*.{js,jsx}"),\n  ],',
    );
    return next;
  });

  await transformText("frontend/config/vite.config.js", (original) => {
    let next = original;

    if (!next.includes('import { fileURLToPath } from "node:url";')) {
      next = next.replace(
        'import path from "node:path";',
        'import path from "node:path";\nimport { fileURLToPath } from "node:url";',
      );
    }

    // PostCSS config must be passed to Vite as its directory. Importing the
    // config object directly makes Vite expect an inline plugin array and can
    // trigger `postcssConfig.plugins.slice is not a function`.
    next = next.replace(/\n?import postcssConfig from "\.\/postcss\.config\.js";\n?/, "\n");

    if (!next.includes('const FRONTEND_ROOT = path.resolve(CONFIG_DIR, "..");')) {
      const marker = 'import { imagetools } from "vite-imagetools";';
      next = next.replace(
        marker,
        `${marker}\n\nconst CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));\nconst FRONTEND_ROOT = path.resolve(CONFIG_DIR, "..");`,
      );
    }

    next = next
      .replaceAll('path.resolve(process.cwd(), "photos")', 'path.join(FRONTEND_ROOT, "photos")')
      .replaceAll('path.resolve(process.cwd(), "dist/photos")', 'path.join(FRONTEND_ROOT, "dist", "photos")')
      .replaceAll('path.resolve(process.cwd(), "dist/service-worker.js")', 'path.join(FRONTEND_ROOT, "dist", "service-worker.js")')
      .replace(/postcss:\s*postcssConfig/g, "postcss: CONFIG_DIR");

    if (!/export default defineConfig\(\{\s*root: FRONTEND_ROOT,/.test(next)) {
      next = next.replace(
        'export default defineConfig({',
        'export default defineConfig({\n  root: FRONTEND_ROOT,',
      );
    }

    if (!/\n\s*css:\s*\{\s*postcss:\s*CONFIG_DIR/.test(next)) {
      next = next.replace(
        /\n\s*server:\s*\{/,
        '\n  css: {\n    postcss: CONFIG_DIR,\n  },\n  server: {',
      );
    }
    return next;
  });

  await removeEmptyDirectory("frontend/assets");
}

async function updateReferencesAndIgnores() {
  console.log("[3/4] Memperbarui jalur konfigurasi...");

  await transformText(".gitignore", (original) => {
    let next = original
      .replaceAll("backend/logs/*", "backend/storage/logs/*")
      .replaceAll("!backend/logs/.gitkeep", "!backend/storage/logs/.gitkeep")
      .replaceAll("backend/uploads/*", "backend/storage/uploads/*")
      .replaceAll("!backend/uploads/.gitkeep", "!backend/storage/uploads/.gitkeep");
    return next;
  });

  await replaceText("docs/README.md", [
    ["pm2 start ecosystem.config.cjs", "pm2 start config/ecosystem.config.cjs"],
    ["ExecStart=/usr/bin/node server.js", "ExecStart=/usr/bin/node src/server.js"],
  ]);

  await transformText("scripts/generate-project-tree.mjs", (original) => original
    .replaceAll("frontend/assets/photos", "frontend/photos")
    .replaceAll("backend/logs", "backend/storage/logs")
    .replaceAll("backend/uploads", "backend/storage/uploads"));
}

function runNodeCheck(relativePath) {
  if (!existsSync(p(relativePath))) return;
  const result = spawnSync(process.execPath, ["--check", p(relativePath)], {
    cwd: ROOT,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`Pemeriksaan sintaks gagal: ${relativePath}`);
  }
}

async function validate() {
  console.log("[4/4] Memeriksa hasil...");

  const required = [
    "backend/src/server.js",
    "backend/src/config/firebaseAdmin.js",
    "backend/src/services/email/invoiceEmail.js",
    "backend/src/services/email/invoicePdf.js",
    "backend/src/utils/index.js",
    "backend/config/ecosystem.config.cjs",
    "frontend/config/vite.config.js",
    "frontend/config/postcss.config.js",
    "frontend/config/tailwind.config.js",
    "frontend/scripts/convert-webp.js",
    "frontend/scripts/generate-favicons.js",
  ];

  const missing = [];
  for (const item of required) {
    if (!(await exists(p(item)))) missing.push(item);
  }
  if (missing.length > 0) {
    throw new Error(`File hasil yang belum ditemukan: ${missing.join(", ")}`);
  }

  const checks = [
    "backend/src/server.js",
    "backend/src/config/firebaseAdmin.js",
    "backend/src/services/email/invoiceEmail.js",
    "backend/src/services/email/invoicePdf.js",
    "backend/src/utils/index.js",
    "backend/config/ecosystem.config.cjs",
    "frontend/config/vite.config.js",
    "frontend/config/postcss.config.js",
    "frontend/config/tailwind.config.js",
    "frontend/scripts/convert-webp.js",
    "frontend/scripts/generate-favicons.js",
  ];

  for (const item of checks) runNodeCheck(item);

  const generator = p("scripts/generate-project-tree.mjs");
  if (await exists(generator)) {
    const result = spawnSync(process.execPath, [generator], {
      cwd: ROOT,
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.status !== 0) warnings.push("PROJECT_TREE tidak dapat diperbarui otomatis.");
  }
}

async function validateProjectRoot() {
  const required = ["package.json", "backend/package.json", "frontend/package.json"];
  const missing = [];
  for (const item of required) {
    if (!(await exists(p(item)))) missing.push(item);
  }
  if (missing.length > 0) {
    throw new Error(`Script harus berada di folder scripts pada root project. Tidak ditemukan: ${missing.join(", ")}`);
  }
}

async function main() {
  await validateProjectRoot();
  console.log("\nMerapikan jalur backend dan frontend Morgen Geschäft...\n");

  await migrateBackend();
  await migrateFrontend();
  await updateReferencesAndIgnores();
  await validate();

  console.log("\nStruktur selesai dirapikan.\n");
  console.log("Backend:");
  console.log("  source      backend/src");
  console.log("  config      backend/config");
  console.log("  scripts     backend/scripts");
  console.log("  tests       backend/tests");
  console.log("  runtime     backend/storage\n");
  console.log("Frontend:");
  console.log("  source      frontend/src");
  console.log("  config      frontend/config");
  console.log("  scripts     frontend/scripts");
  console.log("  photos      frontend/photos\n");

  if (moved.length) {
    console.log(`Dipindahkan: ${moved.length} file`);
  }
  if (updated.length) {
    console.log(`Diperbarui: ${updated.length} file konfigurasi/jalur`);
  }
  if (removed.length) {
    console.log(`Dibersihkan: ${removed.length} file/folder lama`);
  }
  if (warnings.length) {
    console.log("\nPeringatan:");
    warnings.forEach((message) => console.log(`  - ${message}`));
  }

  console.log("\nJalankan ulang project dengan: npm run dev\n");
}

main().catch((error) => {
  console.error(`\nGagal merapikan struktur: ${error.message}\n`);
  process.exitCode = 1;
});
