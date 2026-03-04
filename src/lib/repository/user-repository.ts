/**
 * Repository for all `users` table operations.
 *
 * Provides an upsert-by-email method used by the authentication middleware
 * to create or update user records on every authenticated request. The first
 * user inserted into an empty table is automatically granted admin status.
 *
 * Also exposes admin-oriented methods for listing, deleting, and toggling
 * the admin flag on user accounts.
 */
import { eq, like, asc, desc, count, sql } from "drizzle-orm";
import { type Database } from "../db/client";
import { users, diagrams, shareLinks } from "../db/schema";
import { generateId, nowISO } from "../helpers";
import type {
  UserRow,
  AdminUserRow,
  ListUsersOptions,
  ListUsersResult,
} from "./types";

const SORT_COLUMN_MAP = {
  email: users.email,
  displayName: users.displayName,
  createdAt: users.createdAt,
} as const;

export class UserRepository {
  constructor(private db: Database) {}

  /**
   * Find or create a user by email address.
   *
   * - If a user with the given email exists, update their profile fields
   *   and return the existing row.
   * - If no user exists with that email, insert a new row. The first user
   *   ever inserted (empty table) receives `isAdmin = true`.
   */
  async upsert(
    email: string,
    displayName: string | null,
    avatarUrl: string | null,
  ): Promise<UserRow> {
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existing) {
      const now = nowISO();
      await this.db
        .update(users)
        .set({ displayName, avatarUrl, updatedAt: now })
        .where(eq(users.id, existing.id));

      return {
        ...existing,
        displayName,
        avatarUrl,
        isAdmin: existing.isAdmin,
        updatedAt: now,
      } as UserRow;
    }

    const allUsers = await this.db.select().from(users);

    const now = nowISO();
    const row: UserRow = {
      id: generateId(),
      email,
      displayName,
      avatarUrl,
      isAdmin: allUsers.length === 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(users).values(row);
    return row;
  }

  /** Fetch a single user by primary key. */
  async getById(id: string): Promise<UserRow | undefined> {
    const row = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .get();
    return row as UserRow | undefined;
  }

  /**
   * Paginated, sortable, searchable user list with aggregate diagram and
   * share counts. Used exclusively by the admin interface.
   */
  async list(opts: ListUsersOptions): Promise<ListUsersResult> {
    const { page, pageSize, sortBy, sortOrder, search } = opts;
    const offset = (page - 1) * pageSize;

    const diagramCountSq = this.db
      .select({ dCnt: count().as("d_cnt"), ownerId: diagrams.ownerId })
      .from(diagrams)
      .groupBy(diagrams.ownerId)
      .as("dc");

    const shareCountSq = this.db
      .select({ sCnt: count().as("s_cnt"), createdBy: shareLinks.createdBy })
      .from(shareLinks)
      .groupBy(shareLinks.createdBy)
      .as("sc");

    let query = this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        diagramCount: sql<number>`coalesce(${diagramCountSq.dCnt}, 0)`.as(
          "diagram_count",
        ),
        shareCount: sql<number>`coalesce(${shareCountSq.sCnt}, 0)`.as(
          "share_count",
        ),
      })
      .from(users)
      .leftJoin(diagramCountSq, eq(users.id, diagramCountSq.ownerId))
      .leftJoin(shareCountSq, eq(users.id, shareCountSq.createdBy))
      .$dynamic();

    if (search) {
      query = query.where(like(users.email, `%${search}%`));
    }

    const col = SORT_COLUMN_MAP[sortBy];
    const orderFn = sortOrder === "desc" ? desc : asc;
    query = query.orderBy(orderFn(col));

    const rows = await query.limit(pageSize).offset(offset);

    let totalQuery = this.db.select({ total: count() }).from(users).$dynamic();
    if (search) {
      totalQuery = totalQuery.where(like(users.email, `%${search}%`));
    }
    const totalRow = await totalQuery.get();
    const total = totalRow?.total ?? 0;

    return {
      users: rows as AdminUserRow[],
      total,
    };
  }

  /**
   * Delete a user and cascade-delete their diagrams and share links.
   * Returns `true` if the user existed, `false` otherwise.
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;

    const userDiagrams = await this.db
      .select({ id: diagrams.id })
      .from(diagrams)
      .where(eq(diagrams.ownerId, id));

    for (const d of userDiagrams) {
      await this.db.delete(shareLinks).where(eq(shareLinks.diagramId, d.id));
    }

    await this.db.delete(shareLinks).where(eq(shareLinks.createdBy, id));

    await this.db.delete(diagrams).where(eq(diagrams.ownerId, id));
    await this.db.delete(users).where(eq(users.id, id));

    return true;
  }

  /** Update the admin flag for a user. Returns the updated row or `undefined`. */
  async setAdmin(id: string, isAdmin: boolean): Promise<UserRow | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;

    const now = nowISO();
    await this.db
      .update(users)
      .set({ isAdmin, updatedAt: now })
      .where(eq(users.id, id));

    return { ...existing, isAdmin, updatedAt: now };
  }
}
