/**
 * apps/worker/src/routes/catalog.ts
 *
 * GET /api/catalog — Public endpoint; no authentication required.
 *
 * Returns the complete Cloudflare service catalog with ETag caching.
 * The catalog is bundled TypeScript; no D1 tables are used.
 *
 * Caching strategy:
 *   - ETag is sha256(catalogJson).slice(0, 16), computed once per isolate.
 *   - If-None-Match matching returns 304 with no body.
 *   - On every cache miss the catalog is written to CF_ARCH_CATALOG KV with
 *     a 24-hour TTL (best-effort via waitUntil — does not block the response).
 *   - Cache-Control: public, max-age=3600, s-maxage=86400
 *
 * Phase 03 — see docs/plan/phase-03.md.
 */

import { Hono } from "hono";
import { getCatalog } from "@cf-architect/shared";
import { ok } from "../lib/envelope.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Bindings = { CF_ARCH_CATALOG: KVNamespace };
type Variables = { requestId: string };

// ---------------------------------------------------------------------------
// Catalog data — computed once per isolate lifetime
// ---------------------------------------------------------------------------

const catalogData = getCatalog();
const catalogJson = JSON.stringify(catalogData);

// We compute the ETag asynchronously at module load using the Workers
// crypto.subtle API. A top-level await is valid in Workers module format.
const etag = await (async () => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(catalogJson));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Quoted ETag per RFC 9110
  return `"${hex.slice(0, 16)}"`;
})();

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const catalog = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * GET /api/catalog
 *
 * Public endpoint — no authentication required.
 * Returns the full service catalog with ETag and cache headers.
 */
catalog.get("/api/catalog", (c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();

  // ETag match → 304 Not Modified
  const ifNoneMatch = c.req.header("if-none-match");
  if (ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
      },
    });
  }

  // Write catalog to KV cache (best-effort — failure does not affect the response).
  // waitUntil keeps the Worker alive until the write completes without blocking
  // the response.
  c.executionCtx.waitUntil(
    c.env.CF_ARCH_CATALOG.put("catalog:v1", catalogJson, {
      expirationTtl: 86400,
    }).catch(() => {
      // Silently ignore KV errors — the catalog is always served from memory.
    }),
  );

  return new Response(JSON.stringify(ok(catalogData, { requestId })), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ETag: etag,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
});

export default catalog;
