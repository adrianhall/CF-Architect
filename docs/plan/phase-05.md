---
phase: "05"
title: "Diagram Lifecycle"
feature: "F5"
status: "Planned"
depends_on: ["04"]
---

# Phase 05 — Diagram Lifecycle

## Goal

Persist diagrams to D1, wire the canvas autosave to the API, and build the dashboard: create,
duplicate, delete, rename, search, and paginate diagrams. Add client-side thumbnail generation
stored in R2.

## Scope

### In Scope

All F5 user stories. Optimistic concurrency via `version` column. Thumbnail generation and R2
storage. Wiring user_preferences (theme, palette state) to server-side storage. Diagram/share
counts in the admin user list.

### Out of Scope

- Creating diagrams from blueprints (Phase 06 wires this)
- Share-link cascade on delete (Phase 07 wires this)

## Pre-requisites

- Phase 04 complete (canvas, undo/redo, autosave writing to localStorage)

## Tasks

### Database

- [ ] **Migration 0003** — Create `diagrams` table and `user_preferences` table (see Schema Changes)
- [ ] Add Drizzle schema definitions in `apps/worker/src/db/schema.ts`
- [ ] Query helpers: `createDiagram(ownerId, title)`, `getDiagram(id, ownerId)`,
  `listDiagrams(ownerId, page, limit, sort, q)`, `saveDiagram(id, ownerId, graphJson, title, description, expectedVersion)` (returns `{ ok, newVersion }` or `{ conflict: true }`),
  `deleteDiagram(id, ownerId)`, `setThumbnailKey(id, ownerId, r2Key)`,
  `duplicateDiagram(sourceId, ownerId)`, `countDiagramsByUser(userId)`

### API routes

- [ ] `POST /api/diagrams` — create blank diagram; returns `{ id, version: 0, title }`
- [ ] `GET /api/diagrams` — paginated list for current user; query params: `page`, `limit`, `sort` (title|updated_at|created_at), `order` (asc|desc), `q` (title substring); returns array of diagram summaries (id, title, thumbnail_url, created_at, updated_at, version)
- [ ] `GET /api/diagrams/:id` — full diagram (includes `graph_json`); 404 if not owned by current user
- [ ] `PUT /api/diagrams/:id` — full save; body: `{ graph_json, title, description, version }`; uses optimistic concurrency; returns `{ version: newVersion }` or 409 `CONFLICT`
- [ ] `DELETE /api/diagrams/:id` — delete; returns 204; share link cascade stubbed (real in Phase 07)
- [ ] `POST /api/diagrams/:id/duplicate` — duplicate; returns new diagram summary; browser navigates to `/canvas/:newId` via redirect or client-side
- [ ] `PUT /api/diagrams/:id/thumbnail` — accepts `{ dataUrl: "data:image/png;base64,…" }`; stores in R2 under `thumbnails/{id}/{version}.png`; updates `thumbnail_r2_key`; returns 204
- [ ] `GET /api/diagrams/:id/thumbnail` — redirects to R2 presigned URL (15 min TTL)
- [ ] Apply `POST /api/diagrams` rate limit: 30/min per user (prevent spam creation)
- [ ] Wire diagram counts into `GET /api/admin/users` response

### Wire canvas persistence

- [ ] `apps/web/src/features/f05-lifecycle/useDiagramLoader.ts` — on canvas route mount: `GET /api/diagrams/:id`; loads graph into diagram store; initialises `expectedVersion` ref
- [ ] `apps/web/src/features/f04-canvas/useAutosave.ts` — update: now calls `PUT /api/diagrams/:id` with `graph_json`, `title`, `description`, and current `version`; on 409 `CONFLICT` response shows "Another session saved changes — reload?" modal; on success updates `expectedVersion` ref with returned `newVersion`
- [ ] Wire palette collapsed state: on change, call `PUT /api/me/preferences` with updated `palette_state_json`; on mount, load from `GET /api/me/preferences`
- [ ] Wire theme: on toggle, call `PUT /api/me/preferences` with `theme`; on mount, prefer server-side value over localStorage

### Thumbnail generation

- [ ] `apps/web/src/features/f05-lifecycle/useThumbnail.ts`:
  - After a successful save, render the React Flow `<ReactFlowProvider>` viewport to an off-screen `<canvas>` element using `html2canvas` or React Flow's `getViewport()` + manual SVG serialisation
  - Encode as PNG data URL; send to `PUT /api/diagrams/:id/thumbnail`
  - Thumbnail generation is fire-and-forget (errors are logged, not surfaced to the user)
- [ ] Pass thumbnail URL from diagram summary to dashboard card `<img>`

### Dashboard

- [ ] `apps/web/src/routes/dashboard.tsx`:
  - TanStack Query fetches `GET /api/diagrams` with pagination
  - Card grid: each card shows thumbnail, title, "last updated X ago", action buttons (open, duplicate, delete)
  - Sort controls: "Most recent" / "Oldest" / "Title A–Z" / "Title Z–A"
  - Search input (debounced 300 ms) filtering by title
  - Pagination controls (previous / next / page numbers)
  - Empty state: "No diagrams yet. Start from scratch or browse blueprints." with two CTA buttons
- [ ] `apps/web/src/routes/dashboard.tsx` — "New Diagram" button: calls `POST /api/diagrams` → navigates to `/canvas/:id`
- [ ] Duplicate button on card: calls `POST /api/diagrams/:id/duplicate` → navigates to `/canvas/:newId`
- [ ] Delete button on card: opens confirmation modal showing diagram title; on confirm calls `DELETE /api/diagrams/:id`; optimistically removes card from list; undo on error
- [ ] Inline title rename in editor header: `<input>` with current title; on change debounces 1 s; calls `PUT /api/diagrams/:id` with just `{ title }`; updates document `<title>` tag
- [ ] "Another session saved" conflict modal: `ConflictModal.tsx` with "Reload" and "Keep mine (overwrite)" actions; "Overwrite" sends `PUT` without version check (omit version field → server accepts)

### Concurrency overwrite flow

- [ ] Add `force: true` param to `saveDiagram` query helper: when `force` is true, the `WHERE version = $expected` clause is omitted; client uses this when user explicitly chooses to overwrite

## Schema Changes

**Migration 0003:**

```sql
CREATE TABLE diagrams (
  id               TEXT    PRIMARY KEY,
  owner_id         TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT    NOT NULL DEFAULT 'Untitled Diagram',
  description      TEXT,
  graph_json       TEXT    NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  thumbnail_r2_key TEXT,
  version          INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE INDEX idx_diagrams_owner_updated ON diagrams (owner_id, updated_at DESC);
CREATE INDEX idx_diagrams_owner_title   ON diagrams (owner_id, title COLLATE NOCASE);
```

> Note: `user_preferences` was already introduced in Phase 02 migration 0002 but is fully wired to
> the client only in this phase.

## API Additions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/diagrams` | Required | Create blank diagram |
| `GET` | `/api/diagrams` | Required | Paginated diagram list |
| `GET` | `/api/diagrams/:id` | Required (owner) | Load full diagram |
| `PUT` | `/api/diagrams/:id` | Required (owner) | Save graph + metadata |
| `DELETE` | `/api/diagrams/:id` | Required (owner) | Delete diagram |
| `POST` | `/api/diagrams/:id/duplicate` | Required (owner) | Duplicate diagram |
| `PUT` | `/api/diagrams/:id/thumbnail` | Required (owner) | Store thumbnail |
| `GET` | `/api/diagrams/:id/thumbnail` | Required (owner) | Get thumbnail redirect |

## Test Plan

### Unit (Vitest)

- [ ] `saveDiagram` — correct version accepted; stale version returns `{ conflict: true }`; `force: true` bypasses version check
- [ ] `countDiagramsByUser` — returns correct count per user
- [ ] Thumbnail R2 key derivation: `thumbnails/${id}/${version}.png`
- [ ] Dashboard search filter — debounce function delays API call correctly

### Worker integration

- [ ] `POST /api/diagrams` creates row with `version = 0`; returns id
- [ ] `GET /api/diagrams` returns only current user's diagrams; other user's diagrams not visible
- [ ] `PUT /api/diagrams/:id` with correct version → 200 with new `version`
- [ ] `PUT /api/diagrams/:id` with stale version → 409 `CONFLICT`
- [ ] `DELETE /api/diagrams/:id` by owner → 204; by non-owner → 404
- [ ] `POST /api/diagrams/:id/duplicate` → new diagram with title + " (Copy)"; different id

### E2E (Playwright)

- [ ] Create blank diagram → canvas opens → autosave → navigate to dashboard → diagram card appears
- [ ] Open diagram → edit nodes → wait for save → reload canvas → nodes still present
- [ ] Duplicate diagram from dashboard → "(Copy)" suffix on card; navigates to new diagram
- [ ] Delete diagram from dashboard → confirmation modal → confirm → card disappears
- [ ] Inline rename → debounce fires → dashboard card shows new title
- [ ] Dashboard search → type "test" → only matching diagrams shown
- [ ] Pagination → create 30 diagrams → confirm page 2 controls appear and work

### Accessibility `@a11y`

- [ ] Dashboard page: zero serious/critical axe violations
- [ ] Delete confirmation modal: focus trapped; confirm button focused by default

## Manual Tests

- [ ] **Create and autosave** — Click "New Diagram" on the dashboard. Confirm the canvas opens with
  "Untitled Diagram" as the title. Add a Workers node to the canvas. Confirm the status bar shows
  "Saving…" then "Saved Xs ago". Reload the page. Confirm the node is still there.
- [ ] **Thumbnail generation** — After adding a few nodes and waiting for a save, return to the
  dashboard. Confirm the diagram card shows a thumbnail image (not a blank or broken image).
- [ ] **Duplicate** — On the dashboard, click the duplicate button on a diagram card. Confirm a new
  card appears with " (Copy)" appended to the title. Confirm the browser navigates to the new
  diagram. Confirm the canvas has the same nodes as the original.
- [ ] **Delete with confirmation** — Click the delete button on a diagram card. Confirm a modal
  appears showing the exact diagram title. Click "Cancel". Confirm the diagram is still there.
  Click delete again, then "Delete". Confirm the card is removed from the grid.
- [ ] **Inline rename** — Open a diagram. Click the title "Untitled Diagram" in the editor header.
  Edit it to "My Test Architecture". Wait 1 second. Return to the dashboard. Confirm the card now
  shows the new title.
- [ ] **Conflict detection** — Open the same diagram URL in two browser tabs. In tab A, add a node
  and wait for save. In tab B, add a different node and click save (or wait for autosave). Confirm
  tab B shows the "Another session saved changes — reload?" modal. Click "Reload" in tab B. Confirm
  tab B now shows the state from tab A. Reopen the diagram in a new tab B. Add a node and choose
  "Keep mine (overwrite)" in the conflict modal. Confirm the overwrite succeeds.
- [ ] **Pagination** — Create at least 20 diagrams. Confirm the dashboard shows pagination controls.
  Navigate to page 2. Confirm different diagrams are shown.
- [ ] **Sort** — On the dashboard, change sort to "Title A–Z". Confirm diagrams re-order alphabetically.
- [ ] **Search** — Search for the partial title of an existing diagram. Confirm only matching diagrams
  appear. Clear search. Confirm all diagrams return.
- [ ] **Empty state** — Log in as a brand new user. Confirm the dashboard empty state appears with
  "No diagrams yet" and CTA buttons for "New Diagram" and "Browse Blueprints" (even if Phase 06
  isn't yet deployed — the link can be a placeholder).
- [ ] **Theme persists server-side** — Set dark mode in the web app. Log in as the same user in a
  different browser (incognito or different browser). Confirm dark mode is active on load without
  the user toggling it (preference was fetched from the server, not localStorage).
- [ ] **Admin user diagram count** — Navigate to the admin panel. Confirm each user row shows a
  non-zero diagram count matching the number of diagrams created in manual tests above.

## Acceptance Criteria

| Story | How we verify |
|---|---|
| **F5-US1** — Dashboard with thumbnail, title, last-updated, sorted by recency | Dashboard manual test |
| **F5-US2** — Create blank diagram | Create and autosave manual test |
| **F5-US3** — Duplicate; "(Copy)" suffix; navigates to new | Duplicate manual test |
| **F5-US4** — Delete with confirmation modal showing title; cascades shares | Delete manual test; share cascade verified in Phase 07 |
| **F5-US5** — Inline rename with 1 s debounce | Inline rename manual test |
| **F5-US6** — Search by title | Search manual test |
| **F5-US7** — Paginated dashboard | Pagination manual test |

## Rollout / Rollback

**Rollout:** `npm run migrate` (applies 0003) then `npm run deploy`. Existing users get an empty
diagram list.

**Rollback:** Drop `diagrams` table; redeploy previous Worker. No other user data at risk (users and
preferences tables remain intact).

## Open Questions

- [ ] Thumbnail library: `html2canvas` is the simplest option but has known quirks with SVG. React
  Flow's `toSvg()` utility (from `@xyflow/react`) may be more reliable — evaluate both during
  implementation and choose whichever produces correct output.
- [ ] Should `graph_json` have a size limit enforced at the API layer? A 4 MB D1 row limit applies.
  Recommendation: validate JSON size ≤ 500 KB server-side; return 422 if exceeded; add an R2 blob
  overflow path in a future phase if real diagrams hit this limit.
