import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth.js";

/**
 * Admin E2E tests.
 *
 * These require a running dev server (npm start) and a user seeded as admin.
 * Set SEED_ADMIN_EMAIL=admin@example.com in .dev.vars to run these tests.
 */
test.describe("Admin panel", () => {
  test.skip(
    !process.env["SEED_ADMIN_EMAIL"],
    "Set SEED_ADMIN_EMAIL in .dev.vars to run admin E2E tests",
  );

  const adminEmail = process.env["SEED_ADMIN_EMAIL"] ?? "admin@example.com";

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/_auth\/login/);
    await loginAs(page, adminEmail);
  });

  test("admin user list renders with columns and sort", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /users/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /role/i })).toBeVisible();

    // Clicking Email column header should re-sort
    await page.getByRole("button", { name: /^email/i }).click();
    // Just verify the table is still rendered after sort
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("cannot delete own account — delete button is disabled on own row", async ({ page }) => {
    await page.goto("/admin");
    // Find the row for the admin's own email
    const ownRow = page.getByRole("row").filter({ hasText: adminEmail });
    const deleteBtn = ownRow.getByRole("button", { name: /delete/i });
    await expect(deleteBtn).toBeDisabled();
  });

  test("audit log page renders entries", async ({ page }) => {
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: /audit log/i })).toBeVisible();
    // Table should be present (may be empty if no actions have occurred)
    await expect(page.getByRole("table")).toBeVisible();
  });
});
