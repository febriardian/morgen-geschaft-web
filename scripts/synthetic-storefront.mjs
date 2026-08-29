const baseUrl = String(process.env.SYNTHETIC_BASE_URL || "https://morgengeschaft.com").replace(/\/$/, "");
const timeoutMs = Math.max(2_000, Number(process.env.SYNTHETIC_TIMEOUT_MS || 15_000));

async function check(pathname, { expectedStatus = 200, json = false, crawler = false } = {}) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: crawler ? { "User-Agent": "Googlebot/2.1 synthetic-monitor" } : {},
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "manual",
  });
  const durationMs = Date.now() - startedAt;
  if (response.status !== expectedStatus) {
    throw new Error(`${pathname}: expected ${expectedStatus}, received ${response.status}`);
  }
  if (json) await response.json();
  return { pathname, status: response.status, durationMs };
}

const results = [];
results.push(await check("/api/health", { json: true }));
results.push(await check("/api/_version", { json: true }));
results.push(await check("/api/feature-flags", { json: true }));
results.push(await check("/api/products", { json: true }));
results.push(await check("/id", { crawler: true }));
results.push(await check("/__synthetic_not_found__", { expectedStatus: 404 }));

for (const result of results) {
  process.stdout.write(`${result.status} ${result.pathname} ${result.durationMs}ms\n`);
}

const slow = results.filter((result) => result.durationMs > 3_000);
if (slow.length > 0) {
  process.stderr.write(`WARNING: ${slow.length} endpoint lebih lambat dari 3000ms.\n`);
  process.exitCode = 2;
}
