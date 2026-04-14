# Phase 004: Diagram & Blueprint API Endpoints

## Goal

Implement all REST API endpoints for diagram CRUD and blueprint listing. These are Astro server endpoints (`.ts` files in `src/pages/api/`) that use Kysely for database access and the response helpers from phase 002.

## Prerequisites

- Phase 003 complete (middleware populates `Astro.locals.user` on every request).

## Deliverables

### 1. Diagram List Endpoint

#### `src/pages/api/diagrams/index.ts`

**`GET /api/diagrams`** — List current user's diagrams.

Export a `GET` function. Spec reference: §7.1.

Query params (from URL): `page`, `limit`, `search`, `tag` (repeatable), `sort`, `order`.

Implementation:
1. Get `user` from `Astro.locals`. If null, return 401.
2. Parse query params using `parsePagination()` from `src/lib/api.ts`.
3. Build Kysely query on `diagrams` table:
   - `WHERE owner_id = user.id`
   - If `search` provided: `AND (title LIKE '%term%' OR description LIKE '%term%')`. Use Kysely's `.where()` with `LIKE`.
   - If `tag` provided (can be array): JOIN `diagram_tags`, GROUP BY diagram id, `HAVING COUNT(DISTINCT tag) = tagCount` for AND semantics.
   - `ORDER BY` the `sort` field (`updated_at`, `created_at`, `title`) in `order` direction (`asc`/`desc`). Default: `updated_at desc`.
   - Apply `LIMIT` and `OFFSET` from parsed pagination.
4. Run a separate count query for total (same WHERE/JOIN, no LIMIT/OFFSET).
5. For each diagram in results, fetch its tags from `diagram_tags`.
6. Map rows to `DiagramListItem` format (camelCase, no `canvasData`/`thumbnailSvg`).
7. Return `paginatedResponse(data, page, limit, total)`.

**`POST /api/diagrams`** — Create new diagram.

Export a `POST` function. Spec reference: §7.1.

1. Validate Content-Type (`validateContentType`).
2. Validate body size (`validateBodySize`).
3. Parse request body JSON: `{ title, description?, canvasData, tags? }`.
4. Validate required fields: `title` (non-empty string), `canvasData` (non-empty string, valid JSON).
5. Generate UUID for diagram id.
6. Use Kysely transaction:
   a. Insert into `diagrams`.
   b. If `tags` provided, insert into `diagram_tags` (lowercase, trimmed, UUID per tag row).
7. Return 201 with created diagram (mapped to `DiagramResponse`).

### 2. Single Diagram Endpoint

#### `src/pages/api/diagrams/[id].ts`

**`GET /api/diagrams/[id]`** — Get diagram by ID (owner only).

1. Get user from locals (401 if null).
2. Query diagram by `id` WHERE `owner_id = user.id`.
3. If not found, return 404.
4. Fetch tags for the diagram.
5. Return diagram mapped to `DiagramResponse`.

**`PUT /api/diagrams/[id]`** — Update diagram (owner only).

Spec reference: §7.1 PUT.

1. Validate Content-Type and body size.
2. Parse body: `{ title?, description?, canvasData?, thumbnailSvg?, tags? }`. All fields optional.
3. Verify ownership (query diagram, check `owner_id === user.id`).
4. If not found/not owned, return 404.
5. Use Kysely transaction:
   a. Update `diagrams` row with provided fields + `updated_at = datetime('now')`.
   b. If `tags` is present in body: delete all existing tags, reinsert new ones (spec §7.1 tag update strategy).
6. If diagram has share tokens and `canvasData` changed, invalidate KV share cache for each token.
7. Return 200 with updated diagram.

**`DELETE /api/diagrams/[id]`** — Delete diagram (owner only).

1. Verify ownership.
2. Before deleting, find any share tokens for this diagram and delete their KV cache entries.
3. Delete diagram from DB (cascades to tags and share_tokens via FK).
4. Return 204 No Content.

### 3. Thumbnail Endpoint

#### `src/pages/api/diagrams/[id]/thumbnail.ts`

**`GET /api/diagrams/[id]/thumbnail`** — Get diagram thumbnail SVG.

Spec reference: §7.1 thumbnail.

1. Get user from locals (401 if null).
2. Query diagram `thumbnail_svg` WHERE `id` AND `owner_id = user.id`.
3. If diagram not found, return 404.
4. If `thumbnail_svg` is null, return 404 (no thumbnail yet).
5. Return the raw SVG string with headers:
   ```
   Content-Type: image/svg+xml
   Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'
   ```

### 4. Blueprint Endpoints

#### `src/pages/api/blueprints/index.ts`

**`GET /api/blueprints`** — List all blueprints.

Spec reference: §7.2.

Query params: `page`, `limit`, `search`, `tag`, `sort` (default: `title`), `order` (default: `asc`).

Same query-building logic as diagram list, but:
- `WHERE is_blueprint = 1` (no owner filter — blueprints are visible to all authenticated users).
- Default sort is `title asc`.
- Response uses same `DiagramListItem` format.

#### `src/pages/api/blueprints/[id].ts`

**`GET /api/blueprints/[id]`** — Get blueprint data (for cloning).

1. Query diagram WHERE `id = :id AND is_blueprint = 1`.
2. If not found, return 404.
3. Return full diagram (including `canvasData`) mapped to `DiagramResponse`.
4. This is used by the "New from Blueprint" flow — the client receives the `canvasData` to initialize a new diagram.

### 5. Input Validation Helpers

#### `src/lib/validators.ts`

Create validation helpers used by API endpoints:

```typescript
/** Validate diagram creation input. Returns null if valid, error message if invalid. */
export function validateDiagramInput(body: unknown): { title: string; description: string; canvasData: string; tags: string[] } | string

/** Validate diagram update input. Returns null if valid, error message if invalid. */
export function validateDiagramUpdate(body: unknown): { title?: string; description?: string; canvasData?: string; thumbnailSvg?: string; tags?: string[] } | string

/** Validate sort field against allowed values. */
export function validateSort(sort: string | null, allowed: string[], defaultSort: string): string

/** Validate order direction. */
export function validateOrder(order: string | null, defaultOrder: 'asc' | 'desc'): 'asc' | 'desc'
```

Validation rules:
- `title`: string, 1-200 characters, required on create.
- `description`: string, max 2000 characters, defaults to `''`.
- `canvasData`: string, must be valid JSON (wrap in try/catch), required on create.
- `tags`: array of strings, each tag max 50 chars, lowercased, trimmed, max 20 tags per diagram.
- `thumbnailSvg`: string, optional, max 500KB.
- `sort`: must be in the allowed list.
- `order`: must be `'asc'` or `'desc'`.

---

## Testing Requirements

### `tests/unit/lib/validators.test.ts`
- Test `validateDiagramInput` with valid input.
- Test `validateDiagramInput` rejects missing title.
- Test `validateDiagramInput` rejects title > 200 chars.
- Test `validateDiagramInput` rejects missing canvasData.
- Test `validateDiagramInput` rejects invalid JSON in canvasData.
- Test `validateDiagramInput` normalizes tags (lowercase, trim).
- Test `validateDiagramInput` rejects > 20 tags.
- Test `validateDiagramUpdate` allows all fields optional.
- Test `validateSort` returns default for invalid sort.
- Test `validateOrder` returns default for invalid order.

### `tests/unit/api/diagrams.test.ts`

Test all diagram API endpoints using miniflare D1:

- **GET /api/diagrams**: returns user's diagrams, pagination works, search filters, tag filters, empty list for new user.
- **POST /api/diagrams**: creates diagram, returns 201, assigns correct owner. Rejects missing fields (400), rejects wrong Content-Type (415), rejects oversize body (413).
- **GET /api/diagrams/[id]**: returns owned diagram, 404 for non-existent, 404 for other user's diagram.
- **PUT /api/diagrams/[id]**: updates fields, returns 200. Tag update replaces all tags. Rejects non-owner (404).
- **DELETE /api/diagrams/[id]**: returns 204, diagram no longer accessible. Idempotent (deleting non-existent returns 204).
- **GET /api/diagrams/[id]/thumbnail**: returns SVG with correct headers, 404 when no thumbnail.

### `tests/unit/api/blueprints.test.ts`

- **GET /api/blueprints**: returns only blueprints, pagination works, search/tag filter.
- **GET /api/blueprints/[id]**: returns blueprint with canvasData, 404 for non-blueprint.

### Test Setup

For API tests, you need to:
1. Seed a user in the DB (simulate the middleware having set `locals.user`).
2. Seed test diagrams with known data.
3. Call the endpoint handler directly or use miniflare's test utilities.

Since Astro API endpoints are functions that receive an `APIContext`, you can call them directly in tests by constructing a mock context with the correct `locals`, `params`, `url`, and `request`.

---

## Testable Features

1. **Create a diagram**: Use curl or a REST client to `POST /api/diagrams` with a JSON body. Verify 201 response.
   ```bash
   curl -X POST http://localhost:4321/api/diagrams \
     -H "Content-Type: application/json" \
     -d '{"title":"Test Diagram","canvasData":"{}"}'
   ```

2. **List diagrams**: `GET /api/diagrams` returns the created diagram in a paginated envelope.

3. **Get single diagram**: `GET /api/diagrams/{id}` returns the full diagram with canvasData.

4. **Update diagram**: `PUT /api/diagrams/{id}` with partial fields updates correctly.

5. **Delete diagram**: `DELETE /api/diagrams/{id}` returns 204.

6. **Pagination**: Create 25+ diagrams, verify `GET /api/diagrams?page=2&limit=10` returns correct page.

7. **Search**: `GET /api/diagrams?search=test` filters by title/description.

8. **Validation**: `POST /api/diagrams` with missing title returns 400, without Content-Type returns 415.

9. **Blueprints**: After manually setting `is_blueprint = 1` on a diagram in local D1, `GET /api/blueprints` returns it.

---

## Acceptance Criteria

- [ ] `src/pages/api/diagrams/index.ts` handles GET (list) and POST (create)
- [ ] `src/pages/api/diagrams/[id].ts` handles GET, PUT, DELETE
- [ ] `src/pages/api/diagrams/[id]/thumbnail.ts` handles GET with SVG+CSP headers
- [ ] `src/pages/api/blueprints/index.ts` handles GET (list)
- [ ] `src/pages/api/blueprints/[id].ts` handles GET (single)
- [ ] `src/lib/validators.ts` validates all inputs per spec
- [ ] All endpoints return correct error format `{ error: { code, message } }`
- [ ] All list endpoints use `{ data, pagination }` envelope
- [ ] All JSON responses use camelCase field names
- [ ] Content-Type validation on mutations (415)
- [ ] Body size validation on mutations (413)
- [ ] Ownership checks prevent access to other users' diagrams
- [ ] Tag update uses delete-and-reinsert in a transaction
- [ ] All exports have JSDoc documentation
- [ ] Unit tests cover success and error paths for all endpoints
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and API endpoints respond
- [ ] `npm run build` succeeds
