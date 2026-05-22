/**
 * apps/worker/src/middleware/rate-limit.ts
 *
 * Rate-limit middleware factory using the native Cloudflare Workers
 * `ratelimit` binding (GA September 2025). Returns 429 RATE_LIMITED when
 * the per-location counter is exhausted.
 *
 * Usage:
 *   app.use("/api/shares", rateLimit("RL_SHARES", (c) => c.get("userId")));
 *
 * The `binding` name must correspond to an entry in the `ratelimits` array
 * in wrangler.template.jsonc / wrangler.test.jsonc.
 *
 * See D02 in docs/DECISION_LOG.md for the choice of this approach over a
 * KV-backed sliding-window counter.
 */

import type { Context, MiddlewareHandler } from "hono";
import { err } from "../lib/envelope.js";

// Cloudflare Workers `RateLimit` type (from @cloudflare/workers-types)
type RateLimitBinding = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

/**
 * Creates a Hono middleware that enforces the named rate-limit binding.
 *
 * @param bindingName  The `name` field from the wrangler `ratelimits` array
 *                     (e.g. "RL_SHARES").
 * @param keyFn        Function that derives the rate-limit key from the
 *                     request context.  Defaults to the authenticated user ID,
 *                     or the request ID as a fallback for unauthenticated
 *                     requests (keeps the middleware safe to apply before auth).
 */
export function rateLimit(
  bindingName: string,
  keyFn?: (c: Context) => string | undefined,
): MiddlewareHandler {
  return async (c, next) => {
    const binding = (c.env as Record<string, unknown>)[bindingName] as RateLimitBinding | undefined;

    if (!binding || typeof binding.limit !== "function") {
      // Binding absent (e.g. during local dev without rate-limit config) — pass through.
      return next();
    }

    const key = keyFn ? (keyFn(c) ?? c.get("requestId") ?? "anon") : (c.get("userId") ?? "anon");

    const { success } = await binding.limit({ key });

    if (!success) {
      const requestId = c.get("requestId") ?? crypto.randomUUID();
      return c.json(err("RATE_LIMITED", "Rate limit exceeded", undefined, { requestId }), 429);
    }

    return next();
  };
}
