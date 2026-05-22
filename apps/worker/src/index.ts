/**
 * apps/worker/src/index.ts
 *
 * Hono Worker entry point.
 *
 * Routing strategy:
 *   - /api/* and /_auth/* are handled here (configured via `run_worker_first`
 *     in wrangler.*.jsonc). Every other path goes straight to ASSETS which
 *     serves the Vite SPA with `not_found_handling: "single-page-application"`.
 *   - Unmatched /api/* paths return a JSON 404 envelope — never HTML.
 */

import { Hono } from "hono";
import { loggingMiddleware } from "./middleware/logging.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { err } from "./lib/envelope.js";
import healthRoute from "./routes/health.js";
import versionRoute from "./routes/version.js";

// ---------------------------------------------------------------------------
// Cloudflare Worker bindings type
// ---------------------------------------------------------------------------
type Bindings = {
  ENVIRONMENT?: string;
  DB: D1Database;
  CF_ARCH_SHARES: KVNamespace;
  CF_ARCH_CATALOG: KVNamespace;
  ASSETS_BUCKET: R2Bucket;
  ASSETS: Fetcher;
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = new Hono<{ Bindings: Bindings }>();

// Global middleware — runs for every request the Worker sees
app.use("*", loggingMiddleware);
app.use("*", rateLimitMiddleware);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.route("/", healthRoute);
app.route("/", versionRoute);

// ---------------------------------------------------------------------------
// 404 handler — only reached for /api/* and /_auth/* mismatches.
// All other paths are handled by ASSETS before they reach the Worker.
// ---------------------------------------------------------------------------
app.notFound((c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();
  return c.json(err("NOT_FOUND", "Route not found", undefined, { requestId }), 404);
});

// ---------------------------------------------------------------------------
// Export as a Cloudflare Worker module
// ---------------------------------------------------------------------------
export default app;
