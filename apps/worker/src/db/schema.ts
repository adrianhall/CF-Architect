/**
 * apps/worker/src/db/schema.ts
 *
 * Drizzle ORM schema for CF-Architect.
 *
 * Phase 02: users, admin_audit, user_preferences tables.
 * Subsequent phases add diagrams, blueprints, shares (Phase 03+).
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  /** Cloudflare Access sub claim — stable, opaque user identifier. */
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  /** 'user' | 'admin' — enforced by a CHECK constraint in the migration. */
  role: text("role").notNull().default("user"),
  /** Unix milliseconds. */
  createdAt: integer("created_at").notNull(),
  /** Unix milliseconds — updated on every login. */
  lastLoginAt: integer("last_login_at").notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// admin_audit
// ---------------------------------------------------------------------------

export const adminAudit = sqliteTable("admin_audit", {
  id: text("id").primaryKey(),
  actorId: text("actor_id")
    .notNull()
    .references(() => users.id),
  /** 'promote' | 'demote' | 'delete' — enforced by a CHECK constraint. */
  action: text("action").notNull(),
  /**
   * Not a foreign key: audit rows for deleted users must be retained.
   * The target user row may no longer exist when this is read.
   */
  targetId: text("target_id").notNull(),
  /** Optional JSON string with additional context. */
  payloadJson: text("payload_json"),
  /** Unix milliseconds. */
  at: integer("at").notNull(),
});

export type AdminAuditRow = typeof adminAudit.$inferSelect;
export type NewAdminAuditRow = typeof adminAudit.$inferInsert;

// ---------------------------------------------------------------------------
// user_preferences
// ---------------------------------------------------------------------------

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** 'system' | 'light' | 'dark' | 'high-contrast' */
  theme: text("theme").notNull().default("system"),
  /** JSON string: array of collapsed category IDs. */
  paletteStateJson: text("palette_state_json"),
  /** 1 = enabled, 0 = disabled (SQLite has no native boolean). */
  aiPanelEnabled: integer("ai_panel_enabled").notNull().default(1),
  /** Unix milliseconds. */
  updatedAt: integer("updated_at").notNull(),
});

export type UserPreferencesRow = typeof userPreferences.$inferSelect;
export type NewUserPreferencesRow = typeof userPreferences.$inferInsert;
