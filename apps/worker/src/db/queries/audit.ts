/**
 * apps/worker/src/db/queries/audit.ts
 *
 * Query helpers for the `admin_audit` table.
 */

import { desc, count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { adminAudit, users } from "../schema.js";
import type { AdminAuditRow } from "../schema.js";

export type { AdminAuditRow };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DB = ReturnType<typeof drizzle>;

function db(d1: D1Database): DB {
  return drizzle(d1);
}

// ---------------------------------------------------------------------------
// insertAuditEntry
// ---------------------------------------------------------------------------

export interface InsertAuditEntryParams {
  d1: D1Database;
  actorId: string;
  action: "promote" | "demote" | "delete";
  targetId: string;
  payload?: Record<string, unknown> | null;
}

export async function insertAuditEntry(params: InsertAuditEntryParams): Promise<void> {
  const { d1, actorId, action, targetId, payload } = params;
  await db(d1)
    .insert(adminAudit)
    .values({
      id: crypto.randomUUID(),
      actorId,
      action,
      targetId,
      payloadJson: payload != null ? JSON.stringify(payload) : null,
      at: Date.now(),
    });
}

// ---------------------------------------------------------------------------
// listAuditEntries
// ---------------------------------------------------------------------------

export interface ListAuditEntriesParams {
  d1: D1Database;
  page: number;
  limit: number;
}

export interface AuditEntryWithActor extends AdminAuditRow {
  actorEmail: string;
}

export interface ListAuditEntriesResult {
  entries: AuditEntryWithActor[];
  total: number;
}

export async function listAuditEntries(
  params: ListAuditEntriesParams,
): Promise<ListAuditEntriesResult> {
  const { d1, page, limit } = params;
  const database = db(d1);
  const offset = (page - 1) * limit;

  const [rows, totalResult] = await Promise.all([
    database
      .select({
        id: adminAudit.id,
        actorId: adminAudit.actorId,
        actorEmail: users.email,
        action: adminAudit.action,
        targetId: adminAudit.targetId,
        payloadJson: adminAudit.payloadJson,
        at: adminAudit.at,
      })
      .from(adminAudit)
      .innerJoin(users, eq(adminAudit.actorId, users.id))
      .orderBy(desc(adminAudit.at))
      .limit(limit)
      .offset(offset)
      .all(),
    database.select({ value: count() }).from(adminAudit).get(),
  ]);

  return {
    entries: rows,
    total: totalResult?.value ?? 0,
  };
}
