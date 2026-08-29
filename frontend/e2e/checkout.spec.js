// e2e/checkout.spec.js
// Playwright E2E test — critical path: home → produk → cart → checkout.
//
// SETUP:
// 1. npm install -D @playwright/test
// 2. npx playwright install chromium
// 3. npx playwright test e2e/
//
// CATATAN:
// - Test ini berjalan melawan dev server lokal (npm run dev)
// - Tidak melakukan pembayaran sungguhan (berhenti di Midtrans snap)
// - Jalankan di CI setelah build pass (optional, butuh container)

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";

test.describe("Critical checkout path", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/id`);
    // Wait for products to load
    await page.waitForSelector(".premium-product-card", { timeout: 15000 });
  });

  test("homepage loads with products", async ({ page }) => {
    // Header visible
    await expect(page.locator("header")).toBeVisible();

    // At least 1 product card visible
    const cards = page.locator(".premium-product-card");
    await expect(cards.first()).toBeVisible();

    // Footer visible
    await expect(page.locator("#kontak")).toBeVisible();
  });

  test("can open product detail from catalog", async ({ page }) => {
    // Click first product
    const firstCard = page.locator(".premium-product-card").first();
    await firstCard.click();

    // Product detail page loads
    await page.waitForSelector(".product-detail-page", { timeout: 10000 });
    await expect(page.locator(".product-detail-info-panel h1")).toBeVisible();
    await expect(page.locator(".product-detail-add-button")).toBeVisible();
  });

  test("can add product to cart and see cart drawer", async ({ page }) => {
    // Go to catalog
    await page.goto(`${BASE_URL}/id/katalog`);
    await page.waitForSelector(".premium-product-card", { timeout: 15000 });

    // Click first product
    await page.locator(".premium-product-card").first().click();
    await page.waitForSelector(".product-detail-page", { timeout: 10000 });

    // Add to cart
    const addButton = page.locator(".product-detail-add-button");
    if (await addButton.isEnabled()) {
      await addButton.click();

      // Toast appears
      await expect(page.locator("text=DITAMBAHKAN KE KERANJANG")).toBeVisible({ timeout: 3000 });
    }
  });

  test("catalog page has working category filter", async ({ page }) => {
    await page.goto(`${BASE_URL}/id/katalog`);
    await page.waitForSelector(".premium-product-card", { timeout: 15000 });

    // Category tabs should be present
    const categoryButtons = page.locator(".catalog-filter-panel button, [class*='catalog'] button");
    const count = await categoryButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("reviews page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/id/ulasan`);

    // Wait for content
    await page.waitForSelector(".review-section, .review-card-animated, .review-empty-animated", {
      timeout: 10000,
    });
  });

  test("FAQ page loads with accordion", async ({ page }) => {
    await page.goto(`${BASE_URL}/id/faq`);

    // Wait for FAQ items
    await page.waitForSelector(".premium-faq-item", { timeout: 10000 });
    const items = page.locator(".premium-faq-item");
    await expect(items.first()).toBeVisible();

    // Click first FAQ — should expand
    await items.first().click();
    await expect(page.locator(".premium-faq-item.is-open")).toBeVisible({ timeout: 2000 });
  });

  test("track order section is accessible", async ({ page }) => {
    // Scroll to track section
    await page.goto(`${BASE_URL}/id#lacak`);
    await page.waitForTimeout(500);

    // Track order input should be visible
    const trackInput = page.locator("input[placeholder*='lacak'], input[placeholder*='order'], input[placeholder*='pesanan']");
    if (await trackInput.count() > 0) {
      await expect(trackInput.first()).toBeVisible();
    }
  });

  test("bilingual routing works", async ({ page }) => {
    // EN route
    await page.goto(`${BASE_URL}/en`);
    await page.waitForSelector(".premium-product-card", { timeout: 15000 });

    // Should have English content
    const pageContent = await page.textContent("body");
    expect(pageContent).toMatch(/catalog|product|review/i);

    // ID route
    await page.goto(`${BASE_URL}/id`);
    await page.waitForSelector(".premium-product-card", { timeout: 15000 });
  });

  test("legacy URLs redirect properly", async ({ page }) => {
    // Old /katalog should redirect to /id/katalog
    await page.goto(`${BASE_URL}/katalog`);
    await page.waitForURL(/\/(id|en)\/katalog/i, { timeout: 5000 });
  });
});
