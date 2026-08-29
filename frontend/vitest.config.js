import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Config Vitest terpisah dari vite.config.js (yang khusus build produksi).
// Plugin react() mengaktifkan automatic JSX runtime agar tak perlu impor React.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    css: false,
  },
});
