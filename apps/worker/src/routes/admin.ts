/**
 * apps/worker/src/routes/admin.ts
 *
 * Admin-only endpoints.
 *
 *   GET    /api/admin/users              — paginated user list
 *   PATCH  /api/admin/users/:id/role     — promote / demote
 *   DELETE /api/admin/users/:id          — delete user
 *   GET    /api/admin/audit              — paginated audit log
 */

import { Hono } from "hono";
import type { AuthVariables } from "@adrianhall/cloudflare-auth";
import { zValidator } from "@hono/zod-validator";
import { ok, err } from "../lib/envelope.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { rateLimit } from "../middleware/rate-limit.js";
import {
  listUsers,
  setUserRole,
  deleteUser,
  insertAuditEntry,
  listAuditEntries,
} from "../db/queries/index.js";
import { ListUsersQuery, ListAuditQuery, UpdateRoleInput } from "@cf-architect/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Bindings = { DB: D1Database; RL_ADMIN: RateLimit };
type Variables = AuthVariables & {
  requestId: string;
  userId: string;
  userRole: "user" | "admin";
  userExp: number;
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply admin gate + rate limit to all routes in this group
admin.use("/api/admin/*", requireAdmin);
admin.use(
  "/api/admin/*",
  rateLimit("RL_ADMIN", (c) => c.get("userId")),
);

// ---------------------------------------------------------------------------
// GET /api/admin/users
// ---------------------------------------------------------------------------

admin.get(
  "/api/admin/users",
  zValidator("query", ListUsersQuery, (result, c) => {
    if (!result.success) {
      const requestId = c.get("requestId") ?? crypto.randomUUID();
      return c.json(
        err("UNPROCESSABLE", "Invalid query parameters", result.error.flatten(), { requestId }),
        422,
      );
    }
  }),
  async (c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    const { page, limit, sort, order, q } = c.req.valid("query");

    const result = await listUsers({
      d1: c.env.DB,
      page,
      limit,
      sort,
      order,
      ...(q !== undefined && { q }),
    });

    // diagramCount and shareCount are wired in Phase 05.
    const users = result.rows.map((u) => ({
      ...u,
      diagramCount: 0,
      shareCount: 0,
    }));

    return c.json(ok({ users, total: result.total, page, limit }, { requestId }), 200);
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/role
// ---------------------------------------------------------------------------

admin.patch(
  "/api/admin/users/:id/role",
  zValidator("json", UpdateRoleInput, (result, c) => {
    if (!result.success) {
      const requestId = c.get("requestId") ?? crypto.randomUUID();
      return c.json(
        err("UNPROCESSABLE", "Invalid role value", result.error.flatten(), { requestId }),
        422,
      );
    }
  }),
  async (c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    const actorId = c.get("userId");
    const targetId = c.req.param("id");
    const { role } = c.req.valid("json");

    // Prevent self-mutation
    if (targetId === actorId) {
      return c.json(err("FORBIDDEN", "Cannot change your own role", undefined, { requestId }), 403);
    }

    const updated = await setUserRole({ d1: c.env.DB, targetId, role });
    if (!updated) {
      return c.json(err("NOT_FOUND", "User not found", undefined, { requestId }), 404);
    }

    const action = role === "admin" ? "promote" : "demote";
    await insertAuditEntry({
      d1: c.env.DB,
      actorId,
      action,
      targetId,
      payload: { newRole: role },
    });

    return c.json(ok(updated, { requestId }), 200);
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id
// ---------------------------------------------------------------------------

admin.delete("/api/admin/users/:id", async (c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();
  const actorId = c.get("userId");
  const targetId = c.req.param("id");

  // Prevent self-deletion
  if (targetId === actorId) {
    return c.json(
      err("FORBIDDEN", "Cannot delete your own account", undefined, { requestId }),
      403,
    );
  }

  await insertAuditEntry({
    d1: c.env.DB,
    actorId,
    action: "delete",
    targetId,
  });

  await deleteUser({ d1: c.env.DB, targetId });

  return new Response(null, { status: 204 });
});

// ---------------------------------------------------------------------------
// GET /api/admin/audit
// ---------------------------------------------------------------------------

admin.get(
  "/api/admin/audit",
  zValidator("query", ListAuditQuery, (result, c) => {
    if (!result.success) {
      const requestId = c.get("requestId") ?? crypto.randomUUID();
      return c.json(
        err("UNPROCESSABLE", "Invalid query parameters", result.error.flatten(), { requestId }),
        422,
      );
    }
  }),
  async (c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    const { page, limit } = c.req.valid("query");

    const result = await listAuditEntries({ d1: c.env.DB, page, limit });

    return c.json(
      ok({ entries: result.entries, total: result.total, page, limit }, { requestId }),
      200,
    );
  },
);

export default admin;
