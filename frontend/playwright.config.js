// playwright.config.js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "Desktop Chrome", use: { browserName: "chromium" } },
    { name: "Mobile Safari", use: { browserName: "webkit", viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run dev --workspace frontend",
    port: 5173,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
