/**
 * Kysely database type definitions matching the D1 schema.
 *
 * All table interfaces use snake_case column names as they appear in D1.
 * Timestamps are ISO 8601 TEXT strings. Booleans are D1 INTEGER (0/1).
 *
 * Columns that carry a SQL `DEFAULT` expression are typed with Kysely's
 * `Generated<T>`. This makes them optional in `INSERT` expressions while
 * still resolving to `T` in `SELECT` results, matching the runtime behaviour.
 */

import type { Generated } from 'kysely'

/** Top-level Kysely database interface mapping table names to their row types. */
export interface Database {
  users: UsersTable
  diagrams: DiagramsTable
  diagram_tags: DiagramTagsTable
  share_tokens: ShareTokensTable
}

/** Row type for the `users` table. */
export interface UsersTable {
  /** UUID v4 primary key. */
  id: string
  /** GitHub user ID from CF Access JWT. */
  github_id: string
  /** GitHub login handle. */
  github_username: string
  /** Email from GitHub profile. */
  email: string
  /** Display name. */
  display_name: string
  /** GitHub avatar URL; nullable. */
  avatar_url: string | null
  /** User role — either 'admin' or 'user'. */
  role: 'admin' | 'user'
  /** ISO 8601 creation timestamp — auto-set by D1 default. */
  created_at: Generated<string>
  /** ISO 8601 last-updated timestamp — auto-set by D1 default. */
  updated_at: Generated<string>
}

/** Row type for the `diagrams` table. */
export interface DiagramsTable {
  /** UUID v4 primary key. */
  id: string
  /** FK -> users.id (owner). */
  owner_id: string
  /** Diagram name. */
  title: string
  /** Optional description; defaults to empty string. */
  description: Generated<string>
  /** JSON string of the tldraw store snapshot. */
  canvas_data: string
  /** Cached SVG thumbnail; nullable. */
  thumbnail_svg: string | null
  /** Whether this diagram is a blueprint. D1 INTEGER: 1 = true, 0 = false. */
  is_blueprint: Generated<number>
  /** ISO 8601 creation timestamp — auto-set by D1 default. */
  created_at: Generated<string>
  /** ISO 8601 last-updated timestamp — auto-set by D1 default. */
  updated_at: Generated<string>
}

/** Row type for the `diagram_tags` table. */
export interface DiagramTagsTable {
  /** UUID v4 primary key. */
  id: string
  /** FK -> diagrams.id (CASCADE). */
  diagram_id: string
  /** Tag label (lowercase, trimmed). */
  tag: string
}

/** Row type for the `share_tokens` table. */
export interface ShareTokensTable {
  /** UUID v4 primary key. */
  id: string
  /** FK -> diagrams.id (CASCADE). */
  diagram_id: string
  /** URL-safe random token (24 chars). */
  token: string
  /** FK -> users.id (creator). */
  created_by: string
  /** Optional expiry as ISO 8601 TEXT; NULL means never expires. */
  expires_at: string | null
  /** ISO 8601 creation timestamp — auto-set by D1 default. */
  created_at: Generated<string>
}

/**
 * Slim user type used in `Astro.locals.user`.
 * Matches the shape declared in `src/env.d.ts` (excludes `created_at`/`updated_at`).
 */
export type User = Omit<UsersTable, 'created_at' | 'updated_at'>
