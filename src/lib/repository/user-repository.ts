/**
 * Repository for all `users` table operations.
 *
 * Provides an upsert-by-email method used by the authentication middleware
 * to create or update user records on every authenticated request. The first
 * user inserted into an empty table is automatically granted admin status.
 */
import { eq } from "drizzle-orm";
import { type Database } from "../db/client";
import { users } from "../db/schema";
import { generateId, nowISO } from "../helpers";
import type { UserRow } from "./types";

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
}
