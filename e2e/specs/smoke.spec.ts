import { test, expect } from "@playwright/test";

/**
 * Smoke tests — verify the application is reachable and renders correctly.
 * These tests require the dev server to be running: `npm start`
 */
test.describe("Smoke tests", () => {
  test("root page renders CF-Architect heading", async ({ page }) => {
    await page.goto("/");

    const heading = page.getByRole("heading", { name: /CF-Architect/i });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(/CF-Architect/);
  });

  test("/api/health returns ok status", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);

    const body = (await res.json()) as { ok: boolean; data: { status: string } };
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("ok");
  });

  test("root page shows a health status indicator", async ({ page }) => {
    await page.goto("/");

    // Wait for the status to load (TanStack Query fetches /api/health)
    const statusEl = page.getByLabel("System health status");
    await expect(statusEl).toBeVisible();
  });
});
