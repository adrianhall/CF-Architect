/**
 * apps/worker/src/routes/version.ts
 *
 * GET /api/version
 * Public endpoint — no authentication required.
 *
 * Response:
 *   200 OK { ok: true, data: { version: "0.1.0", environment: "production" }, meta: { … } }
 *
 * `APP_VERSION` is injected at build time by the Vite define plugin
 * (apps/worker/vite.config.ts or wrangler's `define` in wrangler.jsonc).
 * Falls back to "0.0.0-dev" if undefined (local dev without a build step).
 */

import { Hono } from "hono";
import { ok } from "../lib/envelope.js";

// Injected at build time via wrangler's `define` or vitest globals.
// Type declaration so TypeScript is happy; the runtime value is a string.
declare const APP_VERSION: string | undefined;

const app = new Hono<{
  Bindings: {
    ENVIRONMENT?: string;
  };
}>();

app.get("/api/version", (c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();
  const version = typeof APP_VERSION !== "undefined" ? APP_VERSION : "0.0.0-dev";
  const environment = c.env.ENVIRONMENT ?? "development";

  return c.json(ok({ version, environment }, { requestId }), 200);
});

export default app;
