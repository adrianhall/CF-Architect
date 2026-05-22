/**
 * apps/worker/src/middleware/require-admin.ts
 *
 * Hono middleware that aborts with 403 FORBIDDEN if the current user's role
 * is not 'admin'. Must be mounted after `attachUserContext`.
 */

import type { MiddlewareHandler } from "hono";
import { err } from "../lib/envelope.js";

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();

  if (c.get("userRole") !== "admin") {
    return c.json(err("FORBIDDEN", "Admin access required", undefined, { requestId }), 403);
  }

  return next();
};
