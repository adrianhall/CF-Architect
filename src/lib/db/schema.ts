/**
 * Drizzle ORM table definitions for the D1 (SQLite) database.
 *
 * Defines the three core tables — `users`, `diagrams`, and `share_links` —
 * that back the CF Architect data model. Changes here require a new migration
 * via `npm run db:generate`.
 */
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Application users.
 *
 * In the MVP a single seed row exists (see SEED_USER_ID). The schema is
 * designed so that adding OIDC auth post-MVP requires no migration changes
 * beyond making `email` NOT NULL.
 */
export const users = sqliteTable("users", {
  /** UUID primary key. */
  id: text("id").primaryKey(),
  /** Email address. Nullable in MVP; required once OIDC is implemented. */
  email: text("email").unique(),
  /** Human-readable display name. */
  displayName: text("display_name"),
  /** URL to the user's avatar image. */
  avatarUrl: text("avatar_url"),
  /** ISO 8601 creation timestamp. */
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  /** ISO 8601 last-update timestamp. */
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Architecture diagrams.
 *
 * Each row represents a single diagram. The `graph_data` column stores the
 * full React Flow serialised state (nodes, edges, viewport) as a JSON string.
 */
export const diagrams = sqliteTable("diagrams", {
  /** UUID primary key. */
  id: text("id").primaryKey(),
  /** FK to the owning user. */
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  /** User-editable diagram title. */
  title: text("title").notNull().default("Untitled Diagram"),
  /** Optional free-text description. */
  description: text("description"),
  /** JSON-serialised React Flow state (nodes, edges, viewport). */
  graphData: text("graph_data").notNull().default("{}"),
  /** R2 object key for a generated thumbnail image (post-MVP). */
  thumbnailKey: text("thumbnail_key"),
  /** Slug of the blueprint template used to seed this diagram, if any. */
  blueprintId: text("blueprint_id"),
  /** ISO 8601 creation timestamp. */
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  /** ISO 8601 last-update timestamp (updated on every autosave). */
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Read-only share links for diagrams.
 *
 * Each row maps a short URL-safe token to a diagram. Tokens are also
 * written to KV for fast edge lookups without hitting D1.
 */
export const shareLinks = sqliteTable("share_links", {
  /** UUID primary key. */
  id: text("id").primaryKey(),
  /** FK to the shared diagram. */
  diagramId: text("diagram_id")
    .notNull()
    .references(() => diagrams.id),
  /** Short URL-safe token (nanoid, 12 chars). Unique across all links. */
  token: text("token").unique().notNull(),
  /** FK to the user who created the share link. */
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  /** ISO 8601 expiration timestamp, or null for no expiry. */
  expiresAt: text("expires_at"),
  /** ISO 8601 creation timestamp. */
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
