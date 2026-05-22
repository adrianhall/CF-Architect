import { test } from "@playwright/test";
import { checkPageA11y } from "../helpers/axe.js";

/**
 * Accessibility tests (@a11y tag).
 *
 * Run with: npm run test:a11y
 *
 * Zero serious or critical axe violations are required to pass.
 * These tests require the dev server to be running: `npm start`
 */
test.describe("Accessibility @a11y", () => {
  test("root page has no serious/critical axe violations", async ({ page }) => {
    await page.goto("/");
    // Wait for the health status to load so the page is fully rendered
    await page.waitForSelector("[aria-label='System health status']");
    await checkPageA11y(page);
  });
});
