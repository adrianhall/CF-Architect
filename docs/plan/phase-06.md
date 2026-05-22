---
phase: "06"
title: "Blueprints & Templates"
feature: "F6"
status: "Planned"
depends_on: ["05"]
---

# Phase 06 — Blueprints & Templates

## Goal

Deliver a data-driven blueprint gallery with category filter, non-interactive preview, and
create-from-blueprint flow. Add admin authoring and publish UI with schema validation.

## Scope

### In Scope

All F6 user stories. A seed set of 5–10 reference architecture blueprints bundled in the repo.

### Out of Scope

- User-submitted public blueprints
- Ratings or voting

## Pre-requisites

- Phase 05 complete (diagram persistence; dashboard; `POST /api/diagrams`)

## Tasks

### Database

- [ ] **Migration 0004** — Create `blueprints` table (see Schema Changes)
- [ ] Drizzle schema + query helpers: `listBlueprints(category?, q?)`, `getBlueprintBySlug(slug)`, `createBlueprint(data)`, `publishBlueprint(id, authorId)`, `updateBlueprint(id, data)`
- [ ] Seed script `scripts/seed-blueprints.ts`: reads `packages/shared/src/blueprints/seeds/*.json`; inserts each into the live DB if not already present; safe to run repeatedly

### Shared package — blueprint schemas

- [ ] `packages/shared/src/schemas/blueprint.ts`: `BlueprintSchema` with `{ id, slug, title, description, category, graph_json, published_at, author_id }`; validate `graph_json` conforms to the same `DiagramGraphSchema` used by the canvas; export `validateBlueprintGraph(json: string): { ok: true } | { ok: false, errors: ZodError }`
- [ ] `packages/shared/src/blueprints/categories.ts`: blueprint category list (distinct from service categories; e.g. "API & Workers", "Storage & Data", "AI & ML", "Security", "Full Stack", "Networking")

### Seed blueprints

- [ ] Create at least 5 seed blueprints in `packages/shared/src/blueprints/seeds/`:
  - `01-workers-api-with-d1.json` — Workers + D1 + KV REST API
  - `02-ai-rag-pipeline.json` — Workers AI + Vectorize + R2 + AI Gateway
  - `03-fullstack-app.json` — Workers + D1 + R2 + KV + Queues
  - `04-edge-cache-delivery.json` — CDN/Cache + R2 + Workers
  - `05-zero-trust-access.json` — Zero Trust + Access + Tunnel + WARP
- [ ] Each seed file validated against `BlueprintSchema` + `validateBlueprintGraph` at CI time

### API routes

- [ ] `GET /api/blueprints` — public; query params: `category` (filter), `q` (title search); returns array of blueprint summaries (no `graph_json`)
- [ ] `GET /api/blueprints/:slug` — public; returns full blueprint including `graph_json`
- [ ] `POST /api/blueprints` — admin only; body: full blueprint fields; validates `graph_json` with `validateBlueprintGraph`; creates in `published_at = null` (draft state)
- [ ] `PUT /api/blueprints/:id` — admin only; update draft blueprint
- [ ] `POST /api/blueprints/:id/publish` — admin only; sets `published_at = now`; validates `graph_json` before publishing; returns 422 with `details` on validation failure
- [ ] `POST /api/diagrams/from-blueprint/:slug` — authenticated; creates new diagram from blueprint's `graph_json`; title = blueprint title + " " + date, or user-supplied; navigates to `/canvas/:newId`

### Web app — gallery

- [ ] `apps/web/src/routes/blueprints/index.tsx`:
  - TanStack Query fetches `GET /api/blueprints`
  - Category filter tabs: "All" + one tab per blueprint category
  - Search input (debounced)
  - Blueprint card grid: title, category badge, description excerpt, "Preview" button, "Use This" button
  - Empty state per category
- [ ] `apps/web/src/features/f06-blueprints/BlueprintPreview.tsx`:
  - Non-interactive mini React Flow instance (`nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable={false}`, `panOnDrag={false}`, `zoomOnScroll={false}`)
  - Loads `graph_json` from `GET /api/blueprints/:slug`
  - Fits to container with `fitView`
  - Shown in a modal or side panel on "Preview" click
- [ ] Create-from-blueprint modal: title input (pre-filled with blueprint title), description textarea; "Create" button calls `POST /api/diagrams/from-blueprint/:slug`; on success navigates to `/canvas/:newId`
- [ ] Wire dashboard empty state "Browse blueprints" CTA to `/blueprints`

### Web app — admin authoring

- [ ] `apps/web/src/routes/admin/blueprints/index.tsx` — list all blueprints (draft + published); columns: title, category, status (draft/published), last updated, actions
- [ ] `apps/web/src/routes/admin/blueprints/new.tsx` — create form: title, slug, description, category dropdown, `graph_json` textarea; "Validate" button runs client-side schema check and shows errors; "Save Draft" calls `POST /api/blueprints`
- [ ] `apps/web/src/routes/admin/blueprints/$id.tsx` — edit draft; "Preview" shows `BlueprintPreview`; "Publish" button calls `POST /api/blueprints/:id/publish`; shows validation errors inline

### CI gate

- [ ] Add vitest test that imports all seed JSON files and runs each through `BlueprintSchema.parse()` + `validateBlueprintGraph()`; fails CI if any seed is invalid

## Schema Changes

**Migration 0004:**

```sql
CREATE TABLE blueprints (
  id           TEXT    PRIMARY KEY,
  slug         TEXT    NOT NULL UNIQUE,
  title        TEXT    NOT NULL,
  description  TEXT,
  category     TEXT    NOT NULL,
  graph_json   TEXT    NOT NULL,
  published_at INTEGER,                      -- null = draft; Unix ms = published
  author_id    TEXT    REFERENCES users(id) ON DELETE SET NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX idx_blueprints_category ON blueprints (category, published_at DESC);
```

## API Additions

| Method | Path                                 | Auth     | Purpose                       |
| ------ | ------------------------------------ | -------- | ----------------------------- |
| `GET`  | `/api/blueprints`                    | Public   | List published blueprints     |
| `GET`  | `/api/blueprints/:slug`              | Public   | Full blueprint with graph     |
| `POST` | `/api/blueprints`                    | Admin    | Create draft blueprint        |
| `PUT`  | `/api/blueprints/:id`                | Admin    | Update draft blueprint        |
| `POST` | `/api/blueprints/:id/publish`        | Admin    | Publish a draft               |
| `POST` | `/api/diagrams/from-blueprint/:slug` | Required | Create diagram from blueprint |

## Test Plan

### Unit (Vitest)

- [ ] `validateBlueprintGraph` — valid graph JSON passes; graph with unknown typeIds returns errors; empty nodes/edges passes; invalid JSON string returns error
- [ ] Every seed blueprint file passes `BlueprintSchema.parse()` + `validateBlueprintGraph()`
- [ ] `BlueprintPreview` renders without throwing for every seed blueprint (snapshot or render test)

### Worker integration

- [ ] `GET /api/blueprints` returns published blueprints only (draft excluded)
- [ ] `GET /api/blueprints/:slug` returns full blueprint including `graph_json`
- [ ] `POST /api/blueprints/:id/publish` with invalid `graph_json` → 422 with field errors
- [ ] `POST /api/diagrams/from-blueprint/:slug` creates diagram with blueprint's graph; returns new id

### E2E (Playwright)

- [ ] Navigate to `/blueprints`; confirm seed blueprints appear in the gallery
- [ ] Click "Preview" on a blueprint; confirm non-interactive canvas renders the graph
- [ ] Click "Use This" on a blueprint; fill title; confirm new diagram created and canvas opened with blueprint's nodes
- [ ] Admin: create a draft blueprint with invalid JSON in graph field; confirm validation error shown; fix and publish; confirm blueprint appears in gallery

### Accessibility `@a11y`

- [ ] Blueprint gallery page: zero serious/critical axe violations
- [ ] Blueprint preview modal: focus trapped; ESC closes; non-interactive canvas not focusable

## Manual Tests

- [ ] **Gallery loads** — Navigate to `/blueprints`. Confirm at least 5 blueprint cards appear.
      Confirm each card shows a title, category badge, and description.
- [ ] **Category filter** — Click the "AI & ML" tab. Confirm only AI-related blueprints are shown.
      Click "All". Confirm all blueprints return.
- [ ] **Blueprint search** — Type "workers" in the search box. Confirm only blueprints with "workers"
      in the title appear.
- [ ] **Non-interactive preview** — Click "Preview" on any blueprint. Confirm a mini canvas renders
      showing the blueprint's nodes and edges. Confirm you cannot drag nodes, connect handles, or
      scroll/zoom within the preview (it should be completely static).
- [ ] **Create from blueprint** — Click "Use This" on a blueprint. Confirm a modal appears with the
      blueprint title pre-filled. Change the title to "My Custom Architecture". Click "Create". Confirm
      the browser navigates to the canvas with the blueprint's nodes already on the canvas and the title
      "My Custom Architecture" shown in the header.
- [ ] **Admin — create draft** — Log in as admin. Navigate to `/admin/blueprints`. Click "New
      Blueprint". Fill in title, slug, description, and category. Paste the `graph_json` from an
      existing diagram's `</>` JSON modal. Click "Validate". Confirm validation passes. Click "Save
      Draft". Confirm the blueprint appears in the admin list with status "Draft".
- [ ] **Admin — validation failure** — In the admin create form, paste malformed JSON into the
      `graph_json` field. Click "Validate". Confirm a descriptive error message appears (e.g. "Invalid
      JSON" or specific Zod validation errors).
- [ ] **Admin — publish** — Open the draft blueprint created above. Click "Preview". Confirm the
      canvas preview matches the graph you entered. Click "Publish". Confirm the status changes to
      "Published". Navigate to `/blueprints` and confirm the new blueprint appears in the gallery.
- [ ] **Dashboard empty state CTA** — Log in as a new user with no diagrams. Confirm the dashboard
      empty state "Browse blueprints" link navigates to `/blueprints`.
- [ ] **Seed blueprints in CI** — Run `npm run test:unit` and confirm the CI seed validation test
      passes (all 5+ seed blueprints pass schema validation).

## Acceptance Criteria

| Story                                                                         | How we verify                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------ |
| **F6-US1** — Blueprint gallery with category filter including "All"           | Gallery manual test; category filter manual test |
| **F6-US2** — Non-interactive preview before using a blueprint                 | Preview manual test                              |
| **F6-US3** — Create diagram from blueprint with custom title; opens in editor | Create-from-blueprint manual test                |
| **F6-US4** — Admin can publish a blueprint via UI; invalid graph rejected     | Admin publish + validation failure manual test   |
| **F6-US5** — Admin can preview blueprint before publishing                    | Admin preview manual test                        |

## Rollout / Rollback

**Rollout:** `npm run migrate` (applies 0004), run `npm run seed-blueprints` to load seed data,
then `npm run deploy`.

**Rollback:** `DROP TABLE blueprints;`; redeploy previous Worker. Diagrams created from blueprints
become orphaned but remain intact (they are full copies, not references).

## Open Questions

- [ ] Should blueprint `graph_json` be validated against the _live_ service catalog at publish time
      (so unknown service typeIds are caught), or only against the structural `DiagramGraphSchema`?
      Recommendation: validate against the live catalog — import `getCatalog()` from shared and check
      every node's `type` is a known `typeId` or a resolvable alias.
- [ ] Slug format constraints: lowercase alphanumeric + hyphens, max 64 chars. Enforce at API level
      with Zod + a `UNIQUE` constraint in D1.
