---
phase: "03"
title: "Cloudflare Service Catalog"
feature: "F3"
status: "Planned"
depends_on: ["01"]
---

# Phase 03 — Cloudflare Service Catalog

## Goal

Deliver a type-safe, bundled registry of all Cloudflare services, categories, and edge types —
with icons, documentation links, and an alias map — so the canvas (Phase 04), the scaffold
exporter (Phase 09), and the MCP server (Phase 10) all share one authoritative data source.

## Scope

### In Scope

- Zod v4 schemas for `Service`, `Category`, `EdgeType`, `AliasMap`, and `Catalog` in `packages/shared`
- Initial service data set covering all products named in F9-US3 and the current Cloudflare product surface
- Category metadata (label + hex colour per category)
- Four edge type definitions (`data-flow`, `binding`, `dependency`, `logical`)
- Alias map for renamed/merged services; `resolveTypeId()` resolver
- Cloudflare brand icon SVG sprite (`apps/web/src/icons/sprite.svg`) + `<ServiceIcon>` component
- `GET /api/catalog` public endpoint with `ETag` + KV cache
- `useCatalog()` TanStack Query hook in the web app
- `packages/shared/src/catalog/CONTRIBUTING.md`

### Out of Scope

- Admin UI for live catalog editing (separate tooling per F3 scope; catalog updates require a PR + deploy)
- Runtime hot-reload without redeploy

## Pre-requisites

- Phase 01 complete (packages/shared scaffold, KV namespace, Worker deployed)

## Tasks

### Shared package — types and data

- [ ] `packages/shared/src/catalog/types.ts` — Zod schemas:
  - `ServiceSchema`: `{ typeId, name, shortName, categoryId, iconId, description, docLink, otherLinks[], scaffoldBindingType? }`
  - `OtherLinkSchema`: `{ type: "video" | "audio" | "document" | "example", text, href }`
  - `CategorySchema`: `{ id, label, colour }` (colour is a CSS hex string)
  - `EdgeTypeSchema`: `{ id, label, description, styleTokens }`
  - `AliasMapSchema`: `Record<string, string>` (old typeId → current typeId)
  - `CatalogSchema`: `{ version, services[], categories[], edgeTypes[], aliases }`
- [ ] `packages/shared/src/catalog/categories.ts` — initial categories:
      Compute, Storage, Data, AI & ML, Networking, Security, Developer Tools, Communication, Platform
- [ ] `packages/shared/src/catalog/edge-types.ts` — four edge types:
      `data-flow` (solid blue arrow), `binding` (dashed orange), `dependency` (solid grey), `logical` (dotted purple)
- [ ] `packages/shared/src/catalog/services.ts` — seed all services. Required entries (at minimum):
      Workers, Workers KV, D1, R2, Queues, Vectorize, Workers AI, Browser Rendering, Containers,
      mTLS, Hyperdrive, Email Routing, Workers VPC, Pipelines, Workers Artifacts, Dynamic Workers,
      Pages, Stream, Images, AI Gateway, Zero Trust, Access, WARP, Magic Transit, Magic WAN,
      CDN/Cache, DNS, Argo Smart Routing, Rate Limiting, Zaraz, R2 Event Notifications,
      Workers Analytics Engine, Durable Objects, Service Bindings
- [ ] `packages/shared/src/catalog/aliases.ts` — initial alias map (e.g. legacy type IDs from any prior CF-Architect v1); `resolveTypeId(id, aliases): string` function
- [ ] `packages/shared/src/catalog/index.ts` — `getCatalog(): Catalog` factory; validates result against `CatalogSchema` at build time (static assertion; throws at module load if invalid)

### Icons

- [ ] Source Cloudflare brand SVG icons from the official Cloudflare brand assets repository; document the exact source URL and license in `apps/web/src/icons/ICONS.md`
- [ ] Build script `scripts/build-icon-sprite.ts` — reads all `*.svg` files from `apps/web/src/icons/src/`; strips width/height attributes; inlines as `<symbol id="{iconId}">` in `apps/web/src/icons/sprite.svg`; run as part of `build:web`
- [ ] `apps/web/src/icons/ServiceIcon.tsx` — renders `<svg role="img" aria-label="{name}"><use href="/icons/sprite.svg#{iconId}" /></svg>`; renders an accessible labelled placeholder `<span aria-label="{name}">` when `iconId` is unknown or missing; never throws

### Worker route

- [ ] `apps/worker/src/routes/catalog.ts`:
  - Import `getCatalog()` from `packages/shared`
  - Compute ETag as `sha256(JSON.stringify(catalog)).slice(0, 16)`
  - On request: check `If-None-Match`; return 304 if matches
  - On cache miss: serialize catalog, write to `CF_ARCH_CATALOG` KV with 24 h TTL, return 200 with `ETag` and `Cache-Control: public, max-age=3600, s-maxage=86400`
  - Public — no auth required
- [ ] Register catalog route as `GET /api/catalog` in `apps/worker/src/index.ts`

### Web app

- [ ] `apps/web/src/lib/api/catalog.ts` — `useCatalog()` TanStack Query hook; `staleTime: 24 * 60 * 60 * 1000`; fetches from `/api/catalog`
- [ ] Add `/icons/sprite.svg` to `apps/web/public/` so it is served as a static asset

### Documentation

- [ ] `packages/shared/src/catalog/CONTRIBUTING.md` — step-by-step guide for adding a new service:
  1. Add entry to `services.ts` (typeId conventions, required fields)
  2. Add icon SVG to `apps/web/src/icons/src/` and run `npm run build:icons`
  3. Run `npm run check:types` to validate schema
  4. Run `npm run test:unit` to validate catalog integrity
  5. Open a PR; after merge + deploy, new service appears in the palette

## Schema Changes

None. Catalog data is bundled TypeScript; no D1 tables.

## API Additions

### `GET /api/catalog`

```jsonc
// 200 OK — public
{
  "ok": true,
  "data": {
    "version": "1.0.0",
    "services": [
      /* ServiceSchema[] */
    ],
    "categories": [
      /* CategorySchema[] */
    ],
    "edgeTypes": [
      /* EdgeTypeSchema[] */
    ],
    "aliases": { "old-type-id": "new-type-id" },
  },
  "meta": { "requestId": "…" },
}

// 304 Not Modified (when If-None-Match matches current ETag)
```

## Test Plan

### Unit (Vitest)

- [ ] `getCatalog()` returns a value that passes full `CatalogSchema.parse()` with no errors
- [ ] Every service's `categoryId` references a valid entry in `categories`
- [ ] Every alias value is a `typeId` that exists in `services`
- [ ] `resolveTypeId("old-id", aliases)` returns the new typeId; unknown ids pass through unchanged
- [ ] `resolveTypeId` is idempotent: calling it twice returns the same result
- [ ] `<ServiceIcon iconId="workers-kv" name="Workers KV" />` renders an `<svg>` with correct `aria-label`
- [ ] `<ServiceIcon iconId="unknown-xyz" name="Unknown" />` renders the accessible fallback placeholder

### Worker integration

- [ ] `GET /api/catalog` returns 200 with valid envelope; `data.services` length > 30
- [ ] `GET /api/catalog` with matching `If-None-Match` header returns 304
- [ ] KV write: after first request, `CF_ARCH_CATALOG` KV namespace contains an entry (test with Miniflare binding)

## Manual Tests

- [ ] **Catalog completeness** — `curl -s http://localhost:8787/api/catalog | jq '.data.services | length'`.
      Confirm the count is at least 30. Then `jq '.data.services[] | select(.typeId == "workers-kv")'` and
      confirm `name`, `categoryId`, `docLink`, and `iconId` are all populated.
- [ ] **Icon rendering** — Start `npm run dev:web`. Open `http://localhost:5173` in the browser.
      Create a temporary route (or storybook story) that renders `<ServiceIcon>` for every iconId in the
      catalog. Confirm all icons render as visible SVG shapes with no broken-image indicators.
- [ ] **Accessible fallback** — Render `<ServiceIcon iconId="__nonexistent__" name="Test Service" />`.
      Confirm the fallback renders and has `aria-label="Test Service"`. Inspect with a screen reader or
      axe to confirm it is announced correctly.
- [ ] **Alias resolution** — Temporarily add an alias `"workers-kv-legacy": "workers-kv"` to
      `aliases.ts`. Run `npm run check:types`. Fetch `GET /api/catalog`. Confirm the alias appears in
      `data.aliases`. Revert the change.
- [ ] **ETag / 304** — `curl -Is http://localhost:8787/api/catalog | grep ETag` to capture the ETag
      value. Then `curl -Is -H 'If-None-Match: <etag>' http://localhost:8787/api/catalog`. Confirm the
      response is HTTP 304 with no body.
- [ ] **KV cache** — After the first `GET /api/catalog` request in local dev (using Miniflare), inspect
      the local KV store. Confirm a catalog entry exists with the expected TTL.
- [ ] **Invalid schema guard** — Temporarily remove the required `typeId` field from one service entry.
      Run `npm run check:types`. Confirm TypeScript compilation fails with a type error. Revert.
- [ ] **Doc links** — Pick 5 services and click the `docLink` URL from the catalog JSON. Confirm each
      opens a valid Cloudflare documentation page (no 404s).

## Acceptance Criteria

| Story                                                                          | How we verify                                                                          |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **F3-US1** — Services rendered with correct icon, category colour, and handles | Icon rendering manual test; Phase 04 canvas smoke test                                 |
| **F3-US2** — Add service without editing application source code               | Not achievable with bundled catalog; documented as "PR + deploy" in CONTRIBUTING.md    |
| **F3-US3** — Alias map keeps existing diagrams renderable after rename         | `resolveTypeId` unit test + alias manual test                                          |
| **F3-US4** — Documentation link in properties panel                            | `docLink` field present in catalog; wired to properties panel in Phase 04              |
| **F3-US5** — New products appear in palette after catalog update               | Update = PR to `services.ts` → merge → `npm run deploy`; documented in CONTRIBUTING.md |

## Rollout / Rollback

**Rollout:** `npm run deploy` (no migrations; catalog is bundled). KV cache is populated on the
first request after deploy.

**Rollback:** Redeploy previous Worker version. KV cache entries expire within 24 hours or can be
manually purged via `wrangler kv key delete`.

## Open Questions

- [ ] Exact source for Cloudflare brand SVG icons: confirm whether the Cloudflare brand asset repository
      is publicly accessible or requires a request to the brand team. If restricted, agree on a fallback
      (e.g. SVG icons derived from the public Cloudflare documentation site).
- [ ] Should `otherLinks` (video, example, document) be seeded now or deferred? Recommendation: seed
      `docLink` for every service now; `otherLinks` as best-effort for well-known services (Workers, D1,
      R2, KV, Queues, Workers AI).
