import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const args = process.argv.slice(2);
const fileIndex = args.findIndex((value) => value === "--file");
const logPath = path.resolve(
  process.cwd(),
  fileIndex >= 0 && args[fileIndex + 1]
    ? args[fileIndex + 1]
    : path.join(projectRoot, "backend", "storage", "logs", "pm2-error.log"),
);

const categories = [
  ["process_crash", /uncaught|unhandled rejection|process exited|fatal/i],
  ["http_5xx", /\b50[0-9]\b|service unavailable|internal server error/i],
  ["firestore", /firestore|permission.?denied|failed.?precondition/i],
  ["midtrans_webhook", /midtrans|webhook|signature/i],
  ["smtp_email", /smtp|nodemailer|invoice.?email/i],
  ["redis", /redis|upstash|rate.?limiter/i],
  ["timeout", /timeout|timed out|econnreset|econnrefused/i],
];

function redact(line) {
  return line
    .replace(/(authorization|token|password|secret|api[_-]?key)\s*[:=]\s*[^\s,}]+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .slice(0, 360);
}

let content;
try {
  content = await fs.readFile(logPath, "utf8");
} catch (error) {
  console.error(`Log tidak dapat dibaca: ${logPath}`);
  console.error(error.message);
  process.exit(1);
}

const lines = content.split(/\r?\n/).filter(Boolean);
console.log(`Audit log: ${logPath}`);
console.log(`Jumlah baris: ${lines.length}\n`);

let issueCount = 0;
for (const [name, pattern] of categories) {
  const matches = lines.filter((line) => pattern.test(line));
  console.log(`${name.padEnd(18)} ${matches.length}`);
  issueCount += matches.length;
  for (const line of matches.slice(-2)) console.log(`  ${redact(line)}`);
}

console.log("\nCatatan: hitungan dapat tumpang tindih karena satu baris bisa masuk beberapa kategori.");
process.exitCode = issueCount > 0 ? 1 : 0;
