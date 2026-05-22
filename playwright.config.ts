import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration.
 *
 * Targets the running wrangler dev server (or production URL via BASE_URL).
 * Accessibility tests require @axe-core/playwright (see e2e/helpers/axe.ts).
 *
 * Run all E2E tests:    npm run test:e2e
 * Run a11y tests only:  npm run test:a11y
 */
export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  // exactOptionalPropertyTypes: pass a number always; CI uses 1 serial worker
  workers: process.env["CI"] ? 1 : 2,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env["BASE_URL"] ?? "http://localhost:8787",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Do not automatically start a dev server — run `npm start` separately.
  // webServer is intentionally omitted so tests can run against any target.
});
