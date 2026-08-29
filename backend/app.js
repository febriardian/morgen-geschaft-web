// Entry point untuk PM2, cPanel, dan proses Node.js biasa.
// Selalu muat backend/.env dari lokasi file ini, bukan dari current working directory.
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const backendRoot = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(backendRoot, ".env") });

await import("./src/server.js");
