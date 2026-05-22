/**
 * apps/worker/src/routes/catalog.test.ts
 *
 * Integration tests for GET /api/catalog.
 *
 * Verifies:
 *   - 200 response with correct envelope shape and ≥30 services
 *   - ETag header present and stable across repeated requests
 *   - If-None-Match with correct ETag → 304 with no body
 *   - Public endpoint (no auth header required)
 *   - KV write: CF_ARCH_CATALOG.get("catalog:v1") is non-null after a request
 *
 * Test environment: @cloudflare/vitest-pool-workers with Miniflare
 * KV binding CF_ARCH_CATALOG is available via `env` from cloudflare:workers.
 */

import { describe, it, expect } from "vitest";
import { SELF, env } from "cloudflare:test";

describe("GET /api/catalog", () => {
  it("returns 200 with a valid envelope", async () => {
    const res = await SELF.fetch("http://localhost/api/catalog");
    expect(res.status).toBe(200);

    const body = await res.json<{ ok: boolean; data: unknown; meta: { requestId: string } }>();
    expect(body.ok).toBe(true);
    expect(body.meta.requestId).toBeTruthy();
  });

  it("data.services contains at least 30 entries", async () => {
    const res = await SELF.fetch("http://localhost/api/catalog");
    const body = await res.json<{
      ok: boolean;
      data: { services: unknown[] };
    }>();
    expect(body.data.services.length).toBeGreaterThanOrEqual(30);
  });

  it("data.categories is non-empty", async () => {
    const res = await SELF.fetch("http://localhost/api/catalog");
    const body = await res.json<{
      data: { categories: unknown[] };
    }>();
    expect(body.data.categories.length).toBeGreaterThan(0);
  });

  it("data.edgeTypes contains data-flow, binding, dependency, logical", async () => {
    const res = await SELF.fetch("http://localhost/api/catalog");
    const body = await res.json<{
      data: { edgeTypes: Array<{ id: string }> };
    }>();
    const ids = body.data.edgeTypes.map((e) => e.id);
    expect(ids).toContain("data-flow");
    expect(ids).toContain("binding");
    expect(ids).toContain("dependency");
    expect(ids).toContain("logical");
  });

  it("includes an ETag header", async () => {
    const res = await SELF.fetch("http://localhost/api/catalog");
    expect(res.headers.get("etag")).toBeTruthy();
  });

  it("returns the same ETag on repeated requests", async () => {
    const res1 = await SELF.fetch("http://localhost/api/catalog");
    const res2 = await SELF.fetch("http://localhost/api/catalog");
    expect(res1.headers.get("etag")).toBe(res2.headers.get("etag"));
  });

  it("includes Cache-Control header", async () => {
    const res = await SELF.fetch("http://localhost/api/catalog");
    const cc = res.headers.get("cache-control");
    expect(cc).toBeTruthy();
    expect(cc).toContain("max-age=3600");
  });

  it("is public — no auth header required, no redirect", async () => {
    // Fetch without any auth headers; expect 200, not 302/401
    const res = await SELF.fetch("http://localhost/api/catalog");
    expect(res.status).toBe(200);
    expect(res.redirected).toBe(false);
  });

  it("returns 304 when If-None-Match matches the current ETag", async () => {
    // First request to capture the ETag
    const first = await SELF.fetch("http://localhost/api/catalog");
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();

    // Second request with the ETag
    const second = await SELF.fetch("http://localhost/api/catalog", {
      headers: { "if-none-match": etag! },
    });
    expect(second.status).toBe(304);

    // 304 must have no body
    const text = await second.text();
    expect(text).toBe("");
  });

  it("does NOT return 304 when If-None-Match is stale / wrong value", async () => {
    const res = await SELF.fetch("http://localhost/api/catalog", {
      headers: { "if-none-match": '"stale-etag-value"' },
    });
    expect(res.status).toBe(200);
  });

  it("writes the catalog to CF_ARCH_CATALOG KV after a request", async () => {
    // Fetch the catalog to trigger the KV write
    await SELF.fetch("http://localhost/api/catalog");

    // waitUntil is synchronous in the test environment; the KV write should
    // be completed by the time SELF.fetch resolves.
    const kvEnv = env as { CF_ARCH_CATALOG: KVNamespace };
    const stored = await kvEnv.CF_ARCH_CATALOG.get("catalog:v1");
    expect(stored).not.toBeNull();

    // The stored value should be valid JSON with a services array
    const parsed = JSON.parse(stored!) as { services: unknown[] };
    expect(Array.isArray(parsed.services)).toBe(true);
    expect(parsed.services.length).toBeGreaterThanOrEqual(30);
  });
});
