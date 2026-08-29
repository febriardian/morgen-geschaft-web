import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { imagetools } from "vite-imagetools";
import { sentryVitePlugin } from "@sentry/vite-plugin";

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(CONFIG_DIR, "..");

function copyRootPhotos() {
  return {
    name: "copy-root-photos",
    closeBundle() {
      const source = path.join(FRONTEND_ROOT, "photos");
      const destination = path.join(FRONTEND_ROOT, "dist", "photos");

      if (!fs.existsSync(source)) return;
      fs.mkdirSync(destination, { recursive: true });

      // Product images use WebP in production. Keep one canonical PNG logo
      // because social crawlers and Open Graph previews are more reliable with PNG.
      const files = fs.readdirSync(source);
      const allowedPngFiles = new Set(["logo-512.png"]);
      let copied = 0;
      for (const file of files) {
        const lower = file.toLowerCase();
        if (!lower.endsWith(".webp") && !allowedPngFiles.has(lower)) continue;
        fs.copyFileSync(path.join(source, file), path.join(destination, file));
        copied += 1;
      }
      console.log(`✓ ${copied} aset production disalin ke dist/photos`);
    },
  };
}

// Gagalkan build produksi bila environment variable Firebase wajib belum diisi,
// supaya tidak ada deploy yang boot dengan Firebase setengah-jadi (error runtime).
// Hanya aktif saat `vite build`, tidak mengganggu `vite dev`.
function firebaseEnvGuard() {
  return {
    name: "firebase-env-guard",
    apply: "build",
    configResolved(config) {
      const required = [
        "VITE_FIREBASE_API_KEY",
        "VITE_FIREBASE_AUTH_DOMAIN",
        "VITE_FIREBASE_PROJECT_ID",
        "VITE_FIREBASE_APP_ID",
      ];
      const missing = required.filter((key) => !config.env[key]);
      if (missing.length > 0) {
        throw new Error(
          `Build dibatalkan — environment variable Firebase belum diset: ${missing.join(", ")}. ` +
          "Isi frontend/.env sebelum build. Lihat frontend/.env.example."
        );
      }
    },
  };
}

// Auto-bump service worker version setiap build — agar user tidak stuck di versi lama
function autoVersionServiceWorker() {
  return {
    name: "auto-version-sw",
    closeBundle() {
      const swPath = path.join(FRONTEND_ROOT, "dist", "service-worker.js");
      if (!fs.existsSync(swPath)) return;
      const buildHash = crypto.randomBytes(4).toString("hex");
      let content = fs.readFileSync(swPath, "utf-8");
      content = content.replace(
        /const CACHE_NAME = "[^"]+";/,
        `const CACHE_NAME = "morgen-geschäft-${buildHash}";`
      );
      fs.writeFileSync(swPath, content);
      console.log(`✓ Service worker version updated: morgen-geschäft-${buildHash}`);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, FRONTEND_ROOT, "");
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN?.trim();
  const sentryOrg = env.SENTRY_ORG?.trim();
  const sentryProject = env.SENTRY_PROJECT?.trim();
  const sentrySourceMapsEnabled =
    command === "build" &&
    Boolean(sentryAuthToken && sentryOrg && sentryProject);

  return {
    root: FRONTEND_ROOT,
    plugins: [
      react(),
      imagetools({
        defaultDirectives: (url) => {
          if (url.pathname.match(/\.(jpe?g|png)$/i)) {
            return new URLSearchParams({
              format: "webp",
              quality: "80",
            });
          }
          return new URLSearchParams();
        },
      }),
      firebaseEnvGuard(),
      copyRootPhotos(),
      autoVersionServiceWorker(),
      ...(sentrySourceMapsEnabled
        ? [
            // Harus menjadi plugin terakhir agar seluruh chunk dan source map
            // sudah selesai sebelum diunggah ke Sentry.
            sentryVitePlugin({
              authToken: sentryAuthToken,
              org: sentryOrg,
              project: sentryProject,
              telemetry: false,
              sourcemaps: {
                assets: path.join(FRONTEND_ROOT, "dist", "assets", "**"),
                filesToDeleteAfterUpload: path.join(
                  FRONTEND_ROOT,
                  "dist",
                  "assets",
                  "**",
                  "*.map",
                ),
              },
            }),
          ]
        : []),
    ],
    css: {
      // Vite expects a config directory here. Passing the imported object makes
      // Vite treat `plugins` like an inline array and causes plugins.slice errors.
      postcss: CONFIG_DIR,
    },
    server: {
      // Bind ke IPv4 127.0.0.1 agar cocok dengan upstream nginx lokal
      // (nginx.local.conf memakai 127.0.0.1:5173). Tanpa ini Vite bisa listen
      // hanya di IPv6 [::1] → nginx 502 Bad Gateway.
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3002",
          changeOrigin: true,
        },
        "/uploads": {
          target: "http://127.0.0.1:3002",
          changeOrigin: true,
        },
      },
    },
    build: {
      // Source map hanya dibuat untuk build yang memiliki kredensial upload.
      // Setelah berhasil diunggah, file .map dihapus sebelum deployment.
      sourcemap: sentrySourceMapsEnabled ? "hidden" : false,
      // Strip console.log/warn di production build (console.error tetap dipertahankan untuk debugging)
      esbuild: {
        drop: ["debugger"],
        pure: ["console.log", "console.warn"],
      },
      rollupOptions: {
        output: {
          // Firebase Auth sudah dimuat melalui dynamic import dari
          // services/firebaseAuth.js. Biarkan Rollup membuat chunk dinamisnya
          // sendiri; memaksa submodul Firebase ke beberapa manual chunk dapat
          // membentuk graph silang yang tidak stabil pada Rollup native Windows.
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            icons: ["lucide-react"],
          },
        },
      },
    },
  };
});
