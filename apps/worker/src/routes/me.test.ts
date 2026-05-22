import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";
import { devAuthHeaders, seedUser } from "../../test/auth-helper.js";

describe("GET /api/me", () => {
  it("returns 200 with profile when authenticated", async () => {
    const email = `me-test-${crypto.randomUUID().slice(0, 8)}@example.com`;
    await seedUser({ email });
    const headers = await devAuthHeaders(email);

    const res = await SELF.fetch("http://localhost/api/me", { headers });
    expect(res.status).toBe(200);

    const body = await res.json<{
      ok: boolean;
      data: { id: string; email: string; role: string; exp: number };
    }>();
    expect(body.ok).toBe(true);
    expect(body.data.email).toBe(email);
    expect(body.data.role).toBe("user");
    expect(typeof body.data.exp).toBe("number");
    expect(body.data.exp).toBeGreaterThan(0);
  });

  it("returns 401 with an invalid (non-dev) JWT token", async () => {
    // developerAuthentication no-ops when Cf-Access-Jwt-Assertion is present,
    // so cloudflareAccess handles validation and returns 401 on bad tokens.
    const res = await SELF.fetch("http://localhost/api/me", {
      headers: { "cf-access-jwt-assertion": "bad.token.value" },
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/me/preferences", () => {
  it("returns default preferences when none have been set", async () => {
    const email = `prefs-test-${crypto.randomUUID().slice(0, 8)}@example.com`;
    await seedUser({ email });
    const headers = await devAuthHeaders(email);

    const res = await SELF.fetch("http://localhost/api/me/preferences", { headers });
    expect(res.status).toBe(200);

    const body = await res.json<{
      ok: boolean;
      data: { theme: string; aiPanelEnabled: boolean };
    }>();
    expect(body.ok).toBe(true);
    expect(body.data.theme).toBe("system");
    expect(body.data.aiPanelEnabled).toBe(true);
  });
});

describe("PUT /api/me/preferences", () => {
  it("updates preferences and returns the updated values", async () => {
    const email = `put-prefs-${crypto.randomUUID().slice(0, 8)}@example.com`;
    await seedUser({ email });
    const headers = await devAuthHeaders(email);

    const res = await SELF.fetch("http://localhost/api/me/preferences", {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "dark", aiPanelEnabled: false }),
    });
    expect(res.status).toBe(200);

    const body = await res.json<{
      ok: boolean;
      data: { theme: string; aiPanelEnabled: boolean };
    }>();
    expect(body.data.theme).toBe("dark");
    expect(body.data.aiPanelEnabled).toBe(false);
  });

  it("returns 422 for an invalid theme value", async () => {
    const email = `invalid-prefs-${crypto.randomUUID().slice(0, 8)}@example.com`;
    await seedUser({ email });
    const headers = await devAuthHeaders(email);

    const res = await SELF.fetch("http://localhost/api/me/preferences", {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "neon" }),
    });
    expect(res.status).toBe(422);

    const body = await res.json<{ ok: boolean; error: { code: string } }>();
    expect(body.error.code).toBe("UNPROCESSABLE");
  });
});
