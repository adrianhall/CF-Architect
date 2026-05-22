# Adding a New Service to the Catalog

The catalog is bundled TypeScript — there is no admin UI for live edits.
Updates require a PR and a redeploy. This guide walks you through the process.

---

## Step 1 — Add the service entry to `services.ts`

Open `packages/shared/src/catalog/services.ts` and add a new entry to the
`SERVICES` array in the appropriate category block. Follow these conventions:

### `typeId` — permanent kebab-case identifier

```typescript
typeId: "my-new-service",
```

- **Never** change this after it ships — diagrams reference it by `typeId`.
- If a product is renamed, add an alias instead (see §Renaming a Service below).
- Format: all lowercase, words separated by hyphens, no leading/trailing hyphens.

### Required fields

```typescript
{
  typeId: "my-new-service",
  name: "My New Service",           // Official product name
  shortName: "New Service",         // Shortened name for tight spaces (≤20 chars)
  categoryId: "compute",            // Must exist in categories.ts
  iconId: "my-new-service",         // Filename stem of the SVG in src/icons/src/
  description: "One-sentence description of what this service does.",
  docLink: "https://developers.cloudflare.com/my-new-service/",
  otherLinks: [],                   // Leave empty (populated post-launch)
}
```

### Optional field

```typescript
scaffoldBindingType: "kv_namespaces",  // Wrangler binding type; omit if not applicable
```

Valid `scaffoldBindingType` values match Wrangler `wrangler.toml` binding types, e.g.:
`kv_namespaces`, `d1_databases`, `r2_buckets`, `queues`, `durable_objects`, `ai`,
`vectorize`, `services`, `workflows`, `browser`, `analytics_engine_datasets`, etc.

---

## Step 2 — Add the icon SVG

1. Obtain the SVG icon (see `apps/web/src/icons/ICONS.md` for sources).
2. Place the file at `apps/web/src/icons/src/{iconId}.svg`.
   - The filename stem must exactly match the `iconId` in `services.ts`.
   - The file must be a valid SVG with a `viewBox` attribute.
   - Strip `width` and `height` attributes from the root `<svg>` element
     (the sprite builder will do this automatically, but keeping them clean
     makes the source easier to read).
3. Regenerate the sprite:
   ```bash
   npx tsx scripts/build-icon-sprite.ts
   ```
4. Commit both `apps/web/src/icons/src/{iconId}.svg` and
   `apps/web/public/icons/sprite.svg`.

---

## Step 3 — Validate the schema

```bash
npm run check:types --workspace=packages/shared
```

`getCatalog()` validates the catalog against `CatalogSchema` at module load
time — a TypeScript error or a Zod parse failure here means something is wrong
with your entry.

---

## Step 4 — Run the unit tests

```bash
npx vitest run --project shared --reporter=verbose
```

The catalog integrity tests will verify:

- Your new service's `categoryId` references a valid category.
- `docLink` is a valid URL (if present).
- All `typeId`s are unique.

---

## Step 5 — Open a PR

Once `npm run check` and `npm run test:ci` both pass:

1. Commit your changes with a conventional commit message:
   ```
   feat(catalog): add My New Service
   ```
2. Open a PR; request a review from the team.
3. After merge, run `npm run deploy`. The new service appears in the canvas
   palette immediately after the Worker redeploys — no further steps needed.

---

## Renaming a Service (alias workflow)

If a Cloudflare product is renamed or merged into another:

1. **Do not** change the old `typeId` in `services.ts` — existing diagrams
   reference it. Instead:
2. Add the new service entry with the new `typeId`.
3. Open `packages/shared/src/catalog/aliases.ts` and add:
   ```typescript
   "old-type-id": "new-type-id",
   ```
4. If the old service should no longer appear in the palette, remove it from
   `services.ts` — but keep the alias so existing diagrams still resolve.
5. Run the full check + test suite and open a PR.

The `resolveTypeId(id, aliases)` helper is used by the canvas renderer to map
old IDs to current ones when loading saved diagrams.

---

## Category colours and IDs

Defined in `packages/shared/src/catalog/categories.ts`.
Each category has a `colour` (6-digit CSS hex) used in the palette header and
node accent. Adding a new category requires updating both `categories.ts` and
adding a block in `services.ts`.

---

## Edge types

Defined in `packages/shared/src/catalog/edge-types.ts`.
Edge types have style tokens that the Phase 04 canvas renderer consumes.
Adding a new edge type requires updating both `edge-types.ts` and the
Phase 04 React Flow edge configuration.
