import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

describe("GET /api/version", () => {
  it("returns 200 with ok: true and a version string", async () => {
    const res = await SELF.fetch("http://localhost/api/version");
    expect(res.status).toBe(200);

    const body = await res.json<{
      ok: boolean;
      data: { version: string; environment: string };
      meta: { requestId: string };
    }>();

    expect(body.ok).toBe(true);
    expect(typeof body.data.version).toBe("string");
    expect(body.data.version.length).toBeGreaterThan(0);
  });

  it("returns an environment field", async () => {
    const res = await SELF.fetch("http://localhost/api/version");
    const body = await res.json<{ data: { environment: string } }>();
    expect(typeof body.data.environment).toBe("string");
  });

  it("returns a requestId in meta", async () => {
    const res = await SELF.fetch("http://localhost/api/version");
    const body = await res.json<{ meta: { requestId: string } }>();
    expect(body.meta.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
