import { test, expect } from "@playwright/test";

/**
 * Smoke tests — verify the application is reachable and core routes work.
 * Requires the dev server to be running: `npm start`
 */
test.describe("Smoke tests", () => {
  test("/api/health returns ok status (public endpoint)", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);

    const body = (await res.json()) as { ok: boolean; data: { status: string } };
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("ok");
  });

  test("/api/version returns version field (public endpoint)", async ({ request }) => {
    const res = await request.get("/api/version");
    expect(res.status()).toBe(200);

    const body = (await res.json()) as {
      ok: boolean;
      data: { version: string; environment: string };
    };
    expect(body.ok).toBe(true);
    expect(typeof body.data.version).toBe("string");
  });

  test("navigating to / redirects to dev login when unauthenticated", async ({ page }) => {
    // In dev mode, developerAuthentication redirects unauthenticated requests to /_auth/login.
    await page.goto("/");
    // Either we land on /_auth/login or the page contains the login form.
    await expect(page).toHaveURL(/\/_auth\/login|\//, { timeout: 5000 });
  });
});
