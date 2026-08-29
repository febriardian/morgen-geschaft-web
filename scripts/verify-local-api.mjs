const directBase = "http://127.0.0.1:3002";
const proxyBase = "http://127.0.0.1:5173";
const paths = ["/api/_version", "/api/testimoni", "/api/promotions"];

async function check(url) {
  try {
    const response = await fetch(url, { redirect: "manual" });
    const text = await response.text();
    const preview = text.replace(/\s+/g, " ").slice(0, 120);
    console.log(`${response.ok ? "OK" : "FAIL"} ${response.status} ${url}${preview ? ` — ${preview}` : ""}`);
    return response.ok;
  } catch (error) {
    console.log(`FAIL CONNECT ${url} — ${error.message}`);
    return false;
  }
}

console.log("\nBackend PM2 langsung:");
const directResults = [];
for (const path of paths) directResults.push(await check(`${directBase}${path}`));

console.log("\nMelalui proxy Vite (hanya berhasil jika frontend sedang aktif):");
for (const path of paths) await check(`${proxyBase}${path}`);

if (directResults.some((ok) => !ok)) process.exitCode = 1;
