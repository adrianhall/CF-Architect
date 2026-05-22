import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration.
 *
 * `webServer` starts `npm start` (build:web → migrate:local → wrangler dev)
 * before the test run and waits for the health endpoint to respond.
 *
 * - Local dev: if a server is already running at 8787, it is reused
 *   (reuseExistingServer: true) so repeated test runs are fast.
 * - CI: always starts a fresh server (reuseExistingServer: false).
 *
 * Override the target with BASE_URL to run against staging or production:
 *   BASE_URL=https://my-deploy.workers.dev npm run test:e2e
 *
 * Run all E2E tests:    npm run test:e2e
 * Run a11y tests only:  npm run test:a11y
 */
export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
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

  // Start the dev server automatically when no BASE_URL is provided.
  // Skipped when BASE_URL is set (targeting a remote environment).
  ...(process.env["BASE_URL"]
    ? {}
    : {
        webServer: {
          command: "npm start",
          url: "http://localhost:8787/api/health",
          // Allow 2 min: Vite build (~15 s) + migrate:local + wrangler dev startup
          timeout: 120_000,
          // Reuse an already-running server locally; always start fresh in CI
          reuseExistingServer: !process.env["CI"],
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
});
