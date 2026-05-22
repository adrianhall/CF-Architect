import { z } from "zod";
import { User, Role } from "./user.js";
import { AdminAuditEntry } from "./audit.js";

// ---------------------------------------------------------------------------
// User list (GET /api/admin/users)
// ---------------------------------------------------------------------------

export const ListUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["name", "email", "role", "joined_at"]).default("joined_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().optional(),
});

export type ListUsersQuery = z.infer<typeof ListUsersQuery>;

/**
 * A user row as returned by the admin list endpoint.
 *
 * `diagramCount` and `shareCount` are included for completeness but return `0`
 * until Phase 05 wires in the real counts.
 */
export const AdminUserRow = User.extend({
  diagramCount: z.number().int(),
  shareCount: z.number().int(),
});

export type AdminUserRow = z.infer<typeof AdminUserRow>;

export const ListUsersResponse = z.object({
  users: z.array(AdminUserRow),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});

export type ListUsersResponse = z.infer<typeof ListUsersResponse>;

// ---------------------------------------------------------------------------
// Role update (PATCH /api/admin/users/:id/role)
// ---------------------------------------------------------------------------

export const UpdateRoleInput = z.object({
  role: Role,
});

export type UpdateRoleInput = z.infer<typeof UpdateRoleInput>;

// ---------------------------------------------------------------------------
// Audit log list (GET /api/admin/audit)
// ---------------------------------------------------------------------------

export const ListAuditQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAuditQuery = z.infer<typeof ListAuditQuery>;

export const ListAuditResponse = z.object({
  entries: z.array(AdminAuditEntry),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});

export type ListAuditResponse = z.infer<typeof ListAuditResponse>;
