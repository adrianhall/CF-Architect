import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { csrfMiddleware } from "./csrf.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApp() {
  const app = new Hono();
  app.use("*", csrfMiddleware);
  app.post("/api/mutate", (c) => c.json({ ok: true }, 200));
  app.put("/api/mutate", (c) => c.json({ ok: true }, 200));
  app.get("/api/read", (c) => c.json({ ok: true }, 200));
  app.post("/_auth/callback", (c) => c.json({ ok: true }, 200));
  return app;
}

const HOST = "localhost";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CSRF middleware", () => {
  it("passes a GET request without any CSRF token", async () => {
    const app = makeApp();
    const res = await app.request("http://localhost/api/read", { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("passes a mutating request with a matching Origin header", async () => {
    const app = makeApp();
    const res = await app.request("http://localhost/api/mutate", {
      method: "POST",
      headers: { Origin: `http://${HOST}` },
    });
    expect(res.status).toBe(200);
  });

  it("rejects a mutating request with a mismatched Origin header", async () => {
    const app = makeApp();
    const res = await app.request("http://localhost/api/mutate", {
      method: "POST",
      headers: { Origin: "https://attacker.example.com" },
    });
    expect(res.status).toBe(403);
    const body = await res.json<{ ok: boolean; error: { code: string } }>();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("passes a mutating request with matching X-CSRF-Token and CF_CSRF cookie", async () => {
    const app = makeApp();
    const token = "test-csrf-token-abc123";
    const res = await app.request("http://localhost/api/mutate", {
      method: "POST",
      headers: {
        Cookie: `CF_CSRF=${token}`,
        "X-CSRF-Token": token,
      },
    });
    expect(res.status).toBe(200);
  });

  it("rejects a mutating request with mismatched X-CSRF-Token and cookie", async () => {
    const app = makeApp();
    const res = await app.request("http://localhost/api/mutate", {
      method: "POST",
      headers: {
        Cookie: "CF_CSRF=real-token",
        "X-CSRF-Token": "wrong-token",
      },
    });
    expect(res.status).toBe(403);
  });

  it("rejects a mutating request with no Origin and no CSRF token", async () => {
    const app = makeApp();
    const res = await app.request("http://localhost/api/mutate", {
      method: "POST",
    });
    expect(res.status).toBe(403);
  });

  it("bypasses CSRF check for public /_auth/* paths", async () => {
    const app = makeApp();
    // /_auth/callback is POST but is a public path — must not be blocked
    const res = await app.request("http://localhost/_auth/callback", {
      method: "POST",
    });
    expect(res.status).toBe(200);
  });

  it("sets CF_CSRF cookie on GET response when no cookie is present", async () => {
    const app = makeApp();
    const res = await app.request("http://localhost/api/read", { method: "GET" });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("CF_CSRF=");
    expect(setCookie).toContain("SameSite=Strict");
    // Must NOT be HttpOnly so JS can read it
    expect(setCookie).not.toContain("HttpOnly");
  });

  it("does NOT set CF_CSRF cookie when it is already present", async () => {
    const app = makeApp();
    const res = await app.request("http://localhost/api/read", {
      method: "GET",
      headers: { Cookie: "CF_CSRF=existing" },
    });
    const setCookie = res.headers.get("set-cookie") ?? "";
    // Should not override an existing token
    expect(setCookie).toBe("");
  });
});
