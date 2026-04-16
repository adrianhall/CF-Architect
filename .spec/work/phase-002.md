# Phase 002: Database Layer & Core Utilities

## Goal

Implement the D1 database schema via migration, the Kysely type-safe query layer, KV cache helpers, share token utilities, and API response helpers. These form the foundation that all API endpoints and middleware depend on.

## Prerequisites

- Phase 001 complete (all tooling, configs, Layout, Tailwind working).

## Deliverables

### 1. D1 Migration

#### `src/lib/db/migrations/0000_initial.sql`

A placeholder migration file was created in phase 001. **Replace its contents** with the real schema as specified in spec §13.1. Do NOT create a new `0001_` file — edit the existing `0000_initial.sql` in place. This defines four tables:

- **`users`** — id, github_id (UNIQUE), github_username, email, display_name, avatar_url, role (CHECK admin/user), created_at, updated_at.
- **`diagrams`** — id, owner_id (FK users), title, description, canvas_data, thumbnail_svg, is_blueprint (INTEGER), created_at, updated_at.
- **`diagram_tags`** — id, diagram_id (FK diagrams ON DELETE CASCADE), tag, UNIQUE(diagram_id, tag).
- **`share_tokens`** — id, diagram_id (FK diagrams ON DELETE CASCADE), token (UNIQUE), created_by (FK users), expires_at, created_at.

Include all indexes from the spec:
- `idx_users_github_id` on users(github_id)
- `idx_diagrams_owner` on diagrams(owner_id)
- `idx_diagrams_blueprint` partial index on diagrams(is_blueprint) WHERE is_blueprint = 1
- `idx_tags_diagram` on diagram_tags(diagram_id)
- `idx_tags_tag` on diagram_tags(tag)
- `idx_share_token` on share_tokens(token)
- `idx_share_diagram` on share_tokens(diagram_id)

After creating the file, verify it runs locally: `npm run db:migrate:local`.

### 2. Kysely Database Types

#### `src/lib/db/schema.ts`

Define TypeScript interfaces matching the D1 schema exactly as specified in spec §2.3:

- `Database` interface with all four table mappings.
- `UsersTable`, `DiagramsTable`, `DiagramTagsTable`, `ShareTokensTable` interfaces.
- `DiagramsTable.is_blueprint` is `number` (D1 uses INTEGER for booleans).
- All timestamp fields are `string` (ISO 8601 TEXT).
- `UsersTable.role` is `'admin' | 'user'`.

Also export a `User` type alias matching the shape used in `Astro.locals.user` (omitting `created_at`, `updated_at` for the locals version, or exporting both a full row type and a slim locals type).

### 3. Kysely D1 Client Factory

#### `src/lib/db/client.ts`

```typescript
import { Kysely } from 'kysely'
import { D1Dialect } from 'kysely-d1'
import type { Database } from './schema'

/** Create a Kysely database client from a D1 binding. */
export function createDb(d1: D1Database): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new D1Dialect({ database: d1 }),
  })
}
```

This function is called in the middleware with `Astro.locals.runtime.env.DB`.

### 4. KV Cache Helpers

#### `src/lib/cache.ts`

Implement typed helpers for the two KV cache patterns defined in spec §2.2:

```typescript
/** Cache key patterns and their TTLs. */

/** Get a cached user by email. Returns null on miss. */
export async function getCachedUser(cache: KVNamespace, email: string): Promise<User | null>

/** Cache a user record by email. TTL: 15 minutes. */
export async function setCachedUser(cache: KVNamespace, email: string, user: User): Promise<void>

/** Delete a cached user by email (used after role changes). */
export async function deleteCachedUser(cache: KVNamespace, email: string): Promise<void>

/** Get cached share data by token. Returns null on miss. */
export async function getCachedShare(
  cache: KVNamespace,
  token: string,
): Promise<ShareCacheData | null>

/** Cache share data by token. TTL: 1 hour. */
export async function setCachedShare(
  cache: KVNamespace,
  token: string,
  data: ShareCacheData,
): Promise<void>

/** Delete cached share data by token (used on diagram update/delete). */
export async function deleteCachedShare(cache: KVNamespace, token: string): Promise<void>
```

The `ShareCacheData` interface:
```typescript
export interface ShareCacheData {
  diagramId: string
  canvasData: string
  title: string
  description: string
}
```

All KV operations should handle errors gracefully (cache misses return null, cache write failures are logged but don't throw).

### 5. Share Token Utilities

#### `src/lib/share.ts`

```typescript
/** Length of generated share tokens. */
export const SHARE_TOKEN_LENGTH = 24

/** URL-safe alphabet for token generation. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** Generate a cryptographically random URL-safe share token (24 chars, ~143 bits entropy). */
export function generateShareToken(): string

/** Check if a share token has expired. Returns true if expired, false otherwise. Null expires_at means never expires. */
export function isShareTokenExpired(expiresAt: string | null): boolean
```

Implementation of `generateShareToken`:
- Use `crypto.getRandomValues(new Uint8Array(SHARE_TOKEN_LENGTH))`.
- Map each byte to the URL-safe alphabet using modulo.

### 6. API Response Helpers

#### `src/lib/api.ts`

Create standardized response builders matching spec §7.0:

```typescript
/** Error codes matching spec §7.0 error table. */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'CONTENT_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR'

/** Create a JSON error response. */
export function errorResponse(status: number, code: ApiErrorCode, message: string): Response

/** Create a JSON success response (200). */
export function jsonResponse(data: unknown, status?: number): Response

/** Create a paginated list response. */
export function paginatedResponse(
  data: unknown[],
  page: number,
  limit: number,
  total: number,
): Response

/** Validate that the request Content-Type is application/json. Returns error Response or null. */
export function validateContentType(request: Request): Response | null

/** Check request body size. Returns error Response if > 1MB, null otherwise. */
export function validateBodySize(request: Request): Response | null

/** Parse pagination query params with defaults and clamping. */
export function parsePagination(url: URL, defaults?: { page?: number; limit?: number }): {
  page: number
  limit: number
  offset: number
}
```

Key behaviors:
- `errorResponse` returns `{ error: { code, message } }` with the correct status code.
- `paginatedResponse` returns `{ data, pagination: { page, limit, total, totalPages } }`.
- `parsePagination` clamps `limit` to max 100, ensures `page >= 1`, computes `offset`.
- `validateContentType` checks `Content-Type` header includes `application/json`.
- `validateBodySize` checks `Content-Length` header against 1MB (1_048_576 bytes).

### 7. Diagram Response Mapper

#### `src/lib/db/mappers.ts`

Create a helper to map database rows (snake_case) to API response objects (camelCase) per spec §7.0:

```typescript
/** Map a diagrams DB row to API response format (camelCase, exclude heavy fields). */
export function mapDiagramToResponse(row: DiagramsTable, tags?: string[]): DiagramResponse

/** Map a diagrams DB row to list item format (no canvasData, no thumbnailSvg). */
export function mapDiagramToListItem(row: DiagramsTable, tags?: string[]): DiagramListItem

/** Map a users DB row to API response format (camelCase). */
export function mapUserToResponse(row: UsersTable): UserResponse
```

Define the response interfaces:
```typescript
export interface DiagramResponse {
  id: string
  title: string
  description: string
  canvasData: string
  thumbnailSvg: string | null
  isBlueprint: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface DiagramListItem {
  id: string
  title: string
  description: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface UserResponse {
  id: string
  githubUsername: string
  displayName: string
  email: string
  avatarUrl: string | null
  role: 'admin' | 'user'
  createdAt: string
}
```

---

## Testing Requirements

Create the following test files in `tests/unit/`:

### `tests/unit/lib/cache.test.ts`
- Test `getCachedUser` returns null on cache miss.
- Test `setCachedUser` + `getCachedUser` round-trip.
- Test `deleteCachedUser` removes cached entry.
- Test `getCachedShare` returns null on miss.
- Test `setCachedShare` + `getCachedShare` round-trip.
- Test `deleteCachedShare` removes cached entry.

### `tests/unit/lib/share.test.ts`
- Test `generateShareToken` returns a 24-character string.
- Test `generateShareToken` only contains URL-safe characters.
- Test `generateShareToken` produces different tokens on successive calls.
- Test `isShareTokenExpired` returns false for null (never expires).
- Test `isShareTokenExpired` returns false for future date.
- Test `isShareTokenExpired` returns true for past date.

### `tests/unit/lib/api.test.ts`
- Test `errorResponse` returns correct status and body shape.
- Test `jsonResponse` returns 200 with JSON body.
- Test `paginatedResponse` computes totalPages correctly.
- Test `parsePagination` with defaults.
- Test `parsePagination` clamps limit to 100.
- Test `parsePagination` ensures page >= 1.
- Test `validateContentType` rejects non-JSON.
- Test `validateContentType` accepts application/json.

### `tests/unit/lib/db/mappers.test.ts`
- Test `mapDiagramToResponse` converts snake_case to camelCase.
- Test `mapDiagramToListItem` excludes canvasData and thumbnailSvg.
- Test `mapUserToResponse` converts correctly.
- Test `is_blueprint` number maps to boolean.

### `tests/unit/lib/db/client.test.ts`
- Test `createDb` returns a Kysely instance.
- Test that a simple query can be executed against local D1 (if miniflare pool is working).

All tests must achieve 80%+ coverage on the files they test.

---

## Testable Features

1. **Migration runs**: `npm run db:migrate:local` completes without errors. Verify tables exist by running `wrangler d1 execute cf-architect-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"`.
2. **Share token generation**: Write a quick script or test that calls `generateShareToken()` 100 times and verifies all tokens are 24 chars, unique, and URL-safe.
3. **Cache round-trip**: Tests demonstrate KV get/set/delete for both user and share patterns.
4. **API helpers**: Tests demonstrate correct error response format, pagination math, and content-type validation.
5. **Dev server still works**: `npm run dev` starts and the placeholder page loads.

---

## Acceptance Criteria

- [ ] `src/lib/db/migrations/0000_initial.sql` contains the full schema from spec §13.1
- [ ] `npm run db:migrate:local` succeeds
- [ ] `src/lib/db/schema.ts` defines all table interfaces
- [ ] `src/lib/db/client.ts` exports `createDb`
- [ ] `src/lib/db/mappers.ts` exports all mapper functions
- [ ] `src/lib/cache.ts` exports all cache helpers
- [ ] `src/lib/share.ts` exports `generateShareToken` and `isShareTokenExpired`
- [ ] `src/lib/api.ts` exports all response helpers
- [ ] All exports have JSDoc documentation
- [ ] Unit tests exist for every utility module
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and page loads
- [ ] `npm run build` succeeds
