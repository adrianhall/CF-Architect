/**
 * apps/worker/src/routes/health.ts
 *
 * GET /api/health
 * Public endpoint — no authentication required.
 *
 * Response:
 *   200 OK { ok: true, data: { status: "ok", timestamp: "…" }, meta: { requestId: "…" } }
 */

import { Hono } from "hono";
import { ok } from "../lib/envelope.js";

const app = new Hono();

app.get("/api/health", (c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();
  return c.json(ok({ status: "ok", timestamp: new Date().toISOString() }, { requestId }), 200);
});

export default app;
