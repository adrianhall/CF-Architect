import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth.js";

/**
 * Auth flow E2E tests — require `npm start` with a running dev server.
 */
test.describe("Dev-mode authentication", () => {
  test("dev login flow — enter email, land on protected home with profile widget", async ({
    page,
  }) => {
    await page.goto("/");
    // Should redirect to login
    await page.waitForURL(/\/_auth\/login/);

    // Fill email and submit
    await loginAs(page, "dev-test@example.com");

    // After login, the ProfileWidget in the header should show the user's email.
    // Use the aria-label rather than getByText to avoid matching the home-page
    // duplicate that also renders the email.
    await expect(page.locator('[aria-label*="Signed in as dev-test"]')).toBeVisible({
      timeout: 5000,
    });
  });
});
