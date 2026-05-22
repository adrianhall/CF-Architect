/**
 * apps/worker/src/middleware/logging.ts
 *
 * Structured JSON logging middleware.
 *
 * Attaches a `requestId` (UUIDv4) to the Hono context and emits a JSON log
 * line on every request containing:
 *   { timestamp, method, path, status, duration_ms, requestId }
 *
 * The requestId is also included in every response envelope so clients and
 * operators can correlate log entries with API responses.
 */

import type { MiddlewareHandler } from "hono";

// Extend the Hono context variable map so TypeScript knows about `requestId`
declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

export const loggingMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);

  const start = Date.now();

  await next();

  const duration = Date.now() - start;

  const logEntry = {
    timestamp: new Date().toISOString(),
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    duration_ms: duration,
    requestId,
  };

  // Workers runtime: console.log output appears in `wrangler tail` and the
  // Cloudflare dashboard — use JSON.stringify to emit structured logs.
  console.log(JSON.stringify(logEntry));
};
