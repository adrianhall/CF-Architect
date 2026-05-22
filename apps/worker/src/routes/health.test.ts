import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

describe("GET /api/health", () => {
  it("returns 200 with ok: true and status: ok", async () => {
    const res = await SELF.fetch("http://localhost/api/health");
    expect(res.status).toBe(200);

    const body = await res.json<{
      ok: boolean;
      data: { status: string; timestamp: string };
      meta: { requestId: string };
    }>();

    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(typeof body.data.timestamp).toBe("string");
    expect(new Date(body.data.timestamp).getTime()).not.toBeNaN();
    expect(typeof body.meta.requestId).toBe("string");
    expect(body.meta.requestId.length).toBeGreaterThan(0);
  });

  it("includes a requestId in the meta field", async () => {
    const res = await SELF.fetch("http://localhost/api/health");
    const body = await res.json<{ meta: { requestId: string } }>();
    // Should be a UUID-like string (32+ hex chars with hyphens)
    expect(body.meta.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("GET /api/unknown — 404 envelope", () => {
  it("returns 404 with ok: false and NOT_FOUND code", async () => {
    const res = await SELF.fetch("http://localhost/api/does-not-exist");
    expect(res.status).toBe(404);

    const body = await res.json<{
      ok: boolean;
      error: { code: string; message: string };
    }>();

    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(typeof body.error.message).toBe("string");
  });
});

describe("Rate-limit stub — X-Rate-Limit-Bypass header", () => {
  it("returns 429 envelope when bypass header is set to trigger", async () => {
    const res = await SELF.fetch("http://localhost/api/health", {
      headers: { "X-Rate-Limit-Bypass": "trigger" },
    });
    expect(res.status).toBe(429);

    const body = await res.json<{
      ok: boolean;
      error: { code: string };
    }>();

    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
