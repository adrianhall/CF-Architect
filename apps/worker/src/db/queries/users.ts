/**
 * apps/worker/src/db/queries/users.ts
 *
 * Query helpers for the `users` table.
 */

import { eq, like, count, asc, desc, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "../schema.js";
import type { UserRow } from "../schema.js";

// Re-export so callers don't need to import schema separately.
export type { UserRow };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DB = ReturnType<typeof drizzle>;

function db(d1: D1Database): DB {
  return drizzle(d1);
}

// ---------------------------------------------------------------------------
// upsertUser
// ---------------------------------------------------------------------------

export interface UpsertUserParams {
  d1: D1Database;
  sub: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  /**
   * If provided, the user is promoted to `role = 'admin'` **only** when their
   * row is first inserted (i.e. `created_at` equals `last_login_at` after the
   * upsert). Re-logins update `last_login_at` only and never overwrite `role`.
   * See D05 in docs/DECISION_LOG.md.
   */
  seedAdminEmail?: string | null;
}

export async function upsertUser(params: UpsertUserParams): Promise<UserRow> {
  const { d1, sub, email, name = null, avatarUrl = null, seedAdminEmail } = params;
  const database = db(d1);
  const now = Date.now();

  // Attempt to INSERT; if the row already exists (by primary key = sub), update
  // only last_login_at, name, and avatar_url (not role).
  await database
    .insert(users)
    .values({
      id: sub,
      email,
      name,
      avatarUrl,
      role: "user",
      createdAt: now,
      lastLoginAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        lastLoginAt: now,
        name: name,
        avatarUrl: avatarUrl,
      },
    });

  // Fetch the (now-current) row.
  const row = await getUserById({ d1, id: sub });
  if (!row) throw new Error(`upsertUser: failed to fetch row for sub=${sub}`);

  // Promote to admin only on first insert (created_at === last_login_at means
  // the row was just created — the INSERT path ran, not the UPDATE path).
  if (
    seedAdminEmail &&
    email.toLowerCase() === seedAdminEmail.toLowerCase() &&
    row.createdAt === row.lastLoginAt &&
    row.role !== "admin"
  ) {
    await database.update(users).set({ role: "admin" }).where(eq(users.id, sub));
    return { ...row, role: "admin" };
  }

  return row;
}

// ---------------------------------------------------------------------------
// getUserById
// ---------------------------------------------------------------------------

export async function getUserById(params: { d1: D1Database; id: string }): Promise<UserRow | null> {
  const { d1, id } = params;
  const row = await db(d1).select().from(users).where(eq(users.id, id)).get();
  return row ?? null;
}

// ---------------------------------------------------------------------------
// setUserRole
// ---------------------------------------------------------------------------

export async function setUserRole(params: {
  d1: D1Database;
  targetId: string;
  role: "user" | "admin";
}): Promise<UserRow | null> {
  const { d1, targetId, role } = params;
  const database = db(d1);
  await database.update(users).set({ role }).where(eq(users.id, targetId));
  return getUserById({ d1, id: targetId });
}

// ---------------------------------------------------------------------------
// deleteUser
// ---------------------------------------------------------------------------

export async function deleteUser(params: { d1: D1Database; targetId: string }): Promise<void> {
  const { d1, targetId } = params;
  await db(d1).delete(users).where(eq(users.id, targetId));
}

// ---------------------------------------------------------------------------
// listUsers
// ---------------------------------------------------------------------------

export interface ListUsersParams {
  d1: D1Database;
  page: number;
  limit: number;
  sort: "name" | "email" | "role" | "joined_at";
  order: "asc" | "desc";
  q?: string;
}

export interface ListUsersResult {
  rows: UserRow[];
  total: number;
}

const SORT_COLUMN = {
  name: users.name,
  email: users.email,
  role: users.role,
  joined_at: users.createdAt,
} as const;

export async function listUsers(params: ListUsersParams): Promise<ListUsersResult> {
  const { d1, page, limit, sort, order, q } = params;
  const database = db(d1);
  const offset = (page - 1) * limit;

  const sortCol = SORT_COLUMN[sort];
  const orderFn = order === "asc" ? asc : desc;

  const whereClause = q ? or(like(users.email, `%${q}%`), like(users.name, `%${q}%`)) : undefined;

  const [rows, totalResult] = await Promise.all([
    database
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset)
      .all(),
    database.select({ value: count() }).from(users).where(whereClause).get(),
  ]);

  return {
    rows,
    total: totalResult?.value ?? 0,
  };
}
