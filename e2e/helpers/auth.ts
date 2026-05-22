/**
 * e2e/helpers/auth.ts
 *
 * Playwright helper for dev-mode authentication.
 * Uses the /_auth/login form provided by @adrianhall/cloudflare-auth.
 */

import type { Page } from "@playwright/test";

/**
 * Log in via the dev-mode email-login form.
 * After calling this, the page is on the originally requested URL
 * (or "/" if no redirect was set).
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  // Navigate to login directly if not already there
  const url = new URL(page.url());
  if (!url.pathname.startsWith("/_auth/login")) {
    await page.goto("/_auth/login");
  }

  await page.getByLabel(/email/i).fill(email);
  await page.getByRole("button", { name: /sign in|login|submit|continue/i }).click();

  // Wait for redirect back to the app (away from /_auth/*)
  await page.waitForURL((u) => !u.pathname.startsWith("/_auth/"));
}
