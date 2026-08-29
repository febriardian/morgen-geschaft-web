import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const serverPath = path.join(root, "backend", "src", "server.js");
const publicRoutePath = path.join(root, "backend", "src", "routes", "publicContent.js");

const failures = [];
for (const file of [serverPath, publicRoutePath]) {
  if (!fs.existsSync(file)) failures.push(`File tidak ditemukan: ${path.relative(root, file)}`);
}

if (!failures.length) {
  const server = fs.readFileSync(serverPath, "utf8");
  const route = fs.readFileSync(publicRoutePath, "utf8");
  if (!server.includes('import publicContentRoutes from "./routes/publicContent.js"')) {
    failures.push("server.js belum mengimpor publicContentRoutes");
  }
  if (!server.includes("app.use(publicContentRoutes)")) {
    failures.push("server.js belum memasang publicContentRoutes");
  }
  if (!route.includes('router.get("/api/testimoni"')) {
    failures.push("Route GET /api/testimoni belum tersedia");
  }
  if (!route.includes('router.get("/api/promotions"')) {
    failures.push("Route GET /api/promotions belum tersedia");
  }
}

if (failures.length) {
  console.error("Verifikasi gagal:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Route ulasan dan promo sudah terpasang di source backend.");
