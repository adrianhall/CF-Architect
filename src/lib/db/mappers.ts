import type { Selectable } from 'kysely'

import type { DiagramsTable, User, UsersTable } from './schema'

/**
 * API response shape for a single diagram (includes canvasData and thumbnailSvg).
 * Field names are camelCase per spec §7.0.
 */
export interface DiagramResponse {
  /** UUID of the diagram. */
  id: string
  /** Diagram title. */
  title: string
  /** Optional description. */
  description: string
  /** JSON string of the tldraw store snapshot. */
  canvasData: string
  /** Cached SVG thumbnail; null if not yet generated. */
  thumbnailSvg: string | null
  /** Whether this diagram is a blueprint. */
  isBlueprint: boolean
  /** Array of tag labels. */
  tags: string[]
  /** ISO 8601 creation timestamp. */
  createdAt: string
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string
}

/**
 * API list-item shape for a diagram (excludes heavy fields canvasData and thumbnailSvg).
 * Used in paginated list responses.
 */
export interface DiagramListItem {
  /** UUID of the diagram. */
  id: string
  /** Diagram title. */
  title: string
  /** Optional description. */
  description: string
  /** Array of tag labels. */
  tags: string[]
  /** ISO 8601 creation timestamp. */
  createdAt: string
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string
}

/**
 * API response shape for a user.
 * Field names are camelCase per spec §7.0. Excludes `updated_at`.
 */
export interface UserResponse {
  /** UUID of the user. */
  id: string
  /** GitHub login handle. */
  githubUsername: string
  /** Display name. */
  displayName: string
  /** Email address. */
  email: string
  /** GitHub avatar URL; null if not set. */
  avatarUrl: string | null
  /** User role. */
  role: 'admin' | 'user'
  /** ISO 8601 creation timestamp. */
  createdAt: string
}

/**
 * Map a `diagrams` DB row to the full API response format.
 * Converts snake_case fields to camelCase and maps `is_blueprint` to a boolean.
 *
 * @param row - A raw row from the `diagrams` table.
 * @param tags - Optional array of tag labels associated with the diagram.
 * @returns A {@link DiagramResponse} suitable for API responses.
 */
export function mapDiagramToResponse(
  row: Selectable<DiagramsTable>,
  tags: string[] = [],
): DiagramResponse {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    canvasData: row.canvas_data,
    thumbnailSvg: row.thumbnail_svg,
    isBlueprint: row.is_blueprint === 1,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Map a `diagrams` DB row to the list-item format.
 * Excludes `canvasData` and `thumbnailSvg` to keep list payloads small.
 *
 * @param row - A raw row from the `diagrams` table.
 * @param tags - Optional array of tag labels associated with the diagram.
 * @returns A {@link DiagramListItem} suitable for paginated list responses.
 */
export function mapDiagramToListItem(
  row: Selectable<DiagramsTable>,
  tags: string[] = [],
): DiagramListItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Map a `users` DB row to the API response format.
 * Converts snake_case fields to camelCase and excludes `updated_at`.
 *
 * @param row - A raw row from the `users` table.
 * @returns A {@link UserResponse} suitable for API responses.
 */
export function mapUserToResponse(row: Selectable<UsersTable>): UserResponse {
  return {
    id: row.id,
    githubUsername: row.github_username,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: row.role,
    createdAt: row.created_at,
  }
}

/**
 * Strip timestamp columns from a D1 select result to produce a {@link User}.
 *
 * `Selectable<UsersTable>` resolves `Generated<string>` back to `string`,
 * matching what Kysely actually returns at runtime from a `selectAll()` query.
 *
 * @param row - A row returned by a `selectAll()` query on the `users` table.
 * @returns The row without `created_at` and `updated_at`.
 */
export function mapUserRow(row: Selectable<UsersTable>): User {
  return {
    id: row.id,
    github_id: row.github_id,
    github_username: row.github_username,
    email: row.email,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    role: row.role,
  }
}
