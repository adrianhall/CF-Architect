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
 *
 * Middleware order (Phase 02):
 *   1. loggingMiddleware       — attaches requestId; emits structured log on response
 *   2. developerAuthentication — no-op when real CF Access headers present; dev login otherwise
 *   3. cloudflareAccess        — validates JWT (HMAC for dev, JWKS for real Access)
 *   4. attachUserContext       — upserts user row; sets userId/userRole/userExp on context
 *   5. csrfMiddleware          — Origin or double-submit cookie check on mutating requests
 *
 * Rate limiting is applied per-route via rateLimit("RL_*") in the route files.
 */

import { Hono } from "hono";
import { developerAuthentication, cloudflareAccess } from "@adrianhall/cloudflare-auth";
import type { AuthVariables } from "@adrianhall/cloudflare-auth";
import { loggingMiddleware } from "./middleware/logging.js";
import { AUTH_POLICIES, CF_ACCESS_POLICIES, attachUserContext } from "./middleware/auth.js";
import { csrfMiddleware } from "./middleware/csrf.js";
import { err } from "./lib/envelope.js";
import healthRoute from "./routes/health.js";
import versionRoute from "./routes/version.js";
import meRoute from "./routes/me.js";
import adminRoute from "./routes/admin.js";
import catalogRoute from "./routes/catalog.js";

// ---------------------------------------------------------------------------
// Bindings type
// ---------------------------------------------------------------------------

type Bindings = {
  ENVIRONMENT?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
  SEED_ADMIN_EMAIL?: string;
  DB: D1Database;
  CF_ARCH_SHARES: KVNamespace;
  CF_ARCH_CATALOG: KVNamespace;
  ASSETS_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  RL_SHARES: RateLimit;
  RL_ADMIN: RateLimit;
  RL_AUTOSAVE: RateLimit;
};

type Variables = AuthVariables & {
  requestId: string;
  userId: string;
  userRole: "user" | "admin";
  userExp: number;
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

// 1. Structured JSON logging — attaches requestId to context
app.use("*", loggingMiddleware);

// 2. Developer authentication — serves /_auth/login in local dev;
//    transparently no-ops when real Cloudflare Access headers are present.
app.use("*", developerAuthentication({ policies: AUTH_POLICIES }));

// 3. Cloudflare Access — validates JWT (HMAC for dev tokens, JWKS for real).
//    Uses CF_ACCESS_POLICIES which extends AUTH_POLICIES with /_auth/* as
//    public, so cloudflareAccess never blocks the login/callback endpoints.
app.use(
  "*",
  cloudflareAccess({
    policies: CF_ACCESS_POLICIES,
    // teamDomain is read from c.env.CLOUDFLARE_TEAM_DOMAIN at request time
    // when not provided here — so both production and test configs work.
  }),
);

// 4. First-login hook — upserts user row; promotes to admin on first INSERT
//    if email matches SEED_ADMIN_EMAIL; sets userId/userRole/userExp.
app.use("*", attachUserContext);

// 5. CSRF protection — Origin check or double-submit cookie on all mutations.
app.use("*", csrfMiddleware);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.route("/", healthRoute);
app.route("/", versionRoute);
app.route("/", meRoute);
app.route("/", adminRoute);
app.route("/", catalogRoute);

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
