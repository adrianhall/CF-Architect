/**
 * apps/worker/src/middleware/rate-limit.ts
 *
 * Rate-limit middleware stub (Phase 01).
 *
 * Real per-endpoint counters backed by KV are deferred to Phase 02.
 * This stub:
 *   - In development/test, triggers a 429 response when the request carries
 *     the `X-Rate-Limit-Bypass` header set to "trigger". This allows unit
 *     tests to exercise the 429 code path without a live KV namespace.
 *   - In production it is a no-op until Phase 02 wires in the real counters.
 */

import type { MiddlewareHandler } from "hono";
import { err } from "../lib/envelope.js";

export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const bypassHeader = c.req.header("X-Rate-Limit-Bypass");

  if (bypassHeader === "trigger") {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    return c.json(err("RATE_LIMITED", "Rate limit exceeded", undefined, { requestId }), 429);
  }

  await next();
};
