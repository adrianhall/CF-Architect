---
phase: "09"
title: "Project Scaffold Export"
feature: "F9"
status: "Planned"
depends_on: ["03", "08"]
---

# Phase 09 — Project Scaffold Export

## Goal

Turn a diagram into a downloadable, ready-to-run Cloudflare Workers project ZIP: a generated
`wrangler.jsonc`, `package.json`, `tsconfig.json`, framework source files, and a conditional
README — all assembled client-side.

## Scope

### In Scope

All F9 user stories. Three built-in framework templates: `vanilla`, `hono`, `astro`. Drizzle config
and D1 migration stub when D1 is present. CI gate: every seed blueprint scaffold passes
`wrangler deploy --dry-run`.

### Out of Scope

- Pushing the scaffold to a Git host
- Running `wrangler deploy` from the browser

## Pre-requisites

- Phase 03 complete (service catalog with `scaffoldBindingType` per service)
- Phase 08 complete (export infrastructure; JSON export for consistency)

## Tasks

### Shared package — scaffold templates

- [ ] `packages/shared/src/templates/types.ts`: interface `ScaffoldTemplate { id, name, description, files(context: ScaffoldContext): ScaffoldFile[] }` where `ScaffoldFile = { path: string, content: string }`
- [ ] `packages/shared/src/templates/context.ts`: `ScaffoldContext` type — computed from the diagram graph: `{ projectName, nodes: ServiceNode[], edges: Edge[], hasD1, hasKV, hasR2, hasQueues, hasVectorize, hasWorkersAI, hasBrowserRendering, hasContainers, hasHyperdrive, hasEmailRouting, hasVPC, hasPipelines, hasArtifacts, hasDynamicWorkers, bindingNames: Record<typeId, string> }`
- [ ] `packages/shared/src/templates/name-sanitiser.ts`: `sanitiseBindingName(label: string): string` — lowercase, replace non-alphanumeric with `_`, deduplicate underscores, max 64 chars, prefix with `_` if starts with digit; deterministic and reversible enough for `wrangler.jsonc`
- [ ] `packages/shared/src/templates/wrangler-generator.ts`: `generateWranglerConfig(ctx: ScaffoldContext): string` — generates a valid `wrangler.jsonc` covering all binding types listed in F9-US3 (D1, KV, R2, Queues, Vectorize, AI, Browser, Containers, mTLS, Hyperdrive, Email, Workers VPC, Pipelines, Artifacts, Dynamic Workers); each binding derives its `binding` name from `sanitiseBindingName(nodeLabel)`
- [ ] `packages/shared/src/templates/vanilla.ts`: vanilla TypeScript Cloudflare Worker template
- [ ] `packages/shared/src/templates/hono.ts`: Hono-based Worker template (mirrors CF-Architect's own stack)
- [ ] `packages/shared/src/templates/astro.ts`: Astro SSR template for Workers

Each template generates:

- `wrangler.jsonc` — from `generateWranglerConfig(ctx)`
- `package.json` — dependencies appropriate to the template
- `tsconfig.json`
- Main source file(s) (`src/index.ts` or Astro app skeleton)
- `drizzle.config.ts` + `migrations/0000_init.sql` — only when `hasD1`
- `README.md` — conditional sections per service type (D1 setup, Queues setup, etc.)

### Web app — scaffold export UI

- [ ] `apps/web/src/features/f09-scaffold/ScaffoldExportDialog.tsx`:
  - "Export Scaffold" button in canvas toolbar (disabled with tooltip when no CF-bound services are on canvas — F9-US6)
  - Opens dialog: project name input (pre-filled from diagram title, passed through `sanitiseBindingName`); framework selector (vanilla / hono / astro) with description for each
  - "Download ZIP" button; on click runs `buildScaffold()` and triggers download
- [ ] `apps/web/src/features/f09-scaffold/buildScaffold.ts`:
  - Accepts `{ nodes, edges, framework, projectName }`
  - Computes `ScaffoldContext` from the diagram store
  - Calls `template.files(context)` for the chosen template
  - Assembles files into a ZIP using `@zip.js/zip.js` (client-side; no native bindings)
  - Returns a `Blob`; triggers `<a download>` programmatic click
- [ ] "No CF services" disabled state: check if any node has a `scaffoldBindingType` from the catalog; if none, disable the export button and show tooltip "Add at least one Cloudflare service to export a scaffold"

### CI gate

- [ ] `scripts/test-scaffold-dry-run.ts`: for each seed blueprint, export a scaffold for each template (vanilla / hono / astro), write to a temp directory, run `wrangler deploy --dry-run --config ./wrangler.jsonc` (no real credentials needed), fail if any exit with non-zero
- [ ] Add `test:scaffold` script to root `package.json`: runs `scripts/test-scaffold-dry-run.ts`
- [ ] Add `test:scaffold` to `ci.yml` workflow

### install new dependency

- [ ] `npm install -D @zip.js/zip.js` in `apps/web` — no native bindings; passes postinstall lockdown

## Schema Changes

None. All scaffold generation is client-side.

## API Additions

None.

## Test Plan

### Unit (Vitest)

- [ ] `sanitiseBindingName` — "Workers KV" → "workers_kv"; "D1 Production DB" → "d1_production_db"; label starting with digit → prefixed; 70-char label → truncated to 64
- [ ] `generateWranglerConfig` for a context with D1, KV, R2 → output is valid JSONC; binding names correctly derived; all sections present
- [ ] `generateWranglerConfig` for context with no bindings → no `[[kv_namespaces]]` etc. sections (no empty arrays)
- [ ] Every seed blueprint scaffold (all 3 templates) passes `BlueprintSchema` shape validation and produces a parseable `wrangler.jsonc`
- [ ] README conditional sections: D1 section present when `hasD1`; absent when `!hasD1`; Queue section present when `hasQueues`

### Integration (scaffold dry-run)

- [ ] Each seed blueprint × each template passes `wrangler deploy --dry-run` (CI gate, see Tasks)

### E2E (Playwright)

- [ ] Open a diagram with Workers + D1 nodes; click "Export Scaffold"; choose "hono"; click "Download ZIP"; confirm a `.zip` file downloads
- [ ] Unzip the downloaded file; confirm `wrangler.jsonc`, `package.json`, `tsconfig.json`, and `src/index.ts` are present; confirm `drizzle.config.ts` is present (D1 node was on canvas)
- [ ] Open a diagram with no CF-bound services; confirm the "Export Scaffold" button is disabled

### Accessibility `@a11y`

- [ ] Scaffold export dialog: zero serious/critical axe violations; framework selector is keyboard navigable

## Manual Tests

- [ ] **Export scaffold — vanilla** — Open a diagram with Workers + KV + D1. Click "Export Scaffold".
      Confirm the export button is enabled. Select "vanilla". Enter "my-project" as the project name.
      Click "Download ZIP". Confirm a `.zip` file downloads named `my-project.zip`.
- [ ] **Inspect ZIP contents** — Unzip `my-project.zip`. Confirm it contains: `wrangler.jsonc`,
      `package.json`, `tsconfig.json`, `src/index.ts`, `drizzle.config.ts` (D1 was on canvas),
      `migrations/0000_init.sql`, and `README.md`.
- [ ] **wrangler.jsonc bindings** — Open `wrangler.jsonc` from the ZIP. Confirm D1 binding section
      is present with a `binding` name derived from the node's label (e.g. `"D1_PRODUCTION_DB"`).
      Confirm KV namespace section is present. Confirm no sections exist for services not on the canvas.
- [ ] **README conditional sections** — Open `README.md`. Confirm there is a D1 setup section.
      Export a second scaffold from a diagram with no D1. Confirm the second README has no D1 section.
- [ ] **Export scaffold — hono** — On the same diagram, select "hono" template. Download ZIP. Open
      `src/index.ts`. Confirm it contains Hono boilerplate with the Hono import and a basic route.
- [ ] **Export scaffold — astro** — Select "astro" template. Download ZIP. Open `wrangler.jsonc`.
      Confirm `"pages_build_output_dir"` or equivalent Astro Workers config is present.
- [ ] **Disabled when no CF services** — Open a diagram with only label/annotation nodes (no
      services from the catalog). Confirm the "Export Scaffold" button is greyed out and the tooltip
      explains why.
- [ ] **Binding name sanitisation** — Create a node labelled "My D1 DB (Production) #2". Export a
      scaffold. Open `wrangler.jsonc`. Confirm the binding name is a valid identifier (no spaces,
      parentheses, or `#`).
- [ ] **wrangler dry-run** — From the unzipped project directory, run
      `npx wrangler deploy --dry-run --config ./wrangler.jsonc`. Confirm the command exits 0 with
      no errors (note: you may need a Cloudflare account for the dry-run to pass the API shape check;
      use a test account).
- [ ] **All binding types** — Create a diagram with one node of each type listed in F9-US3
      (D1, KV, R2, Queues, Vectorize, AI, Browser, Containers, mTLS, Hyperdrive, Email, VPC, Pipelines,
      Artifacts, Dynamic Workers). Export as vanilla. Open `wrangler.jsonc`. Confirm every binding
      type has a corresponding section.
- [ ] **CI scaffold gate** — Run `npm run test:scaffold`. Confirm all seed blueprints × all 3
      templates pass the `wrangler deploy --dry-run` check with exit code 0.

## Acceptance Criteria

| Story                                                                                    | How we verify                             |
| ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| **F9-US1** — ZIP with `wrangler.jsonc`, `package.json`, `tsconfig.json`, sources, README | Inspect ZIP contents manual test          |
| **F9-US2** — Framework template selection (vanilla / hono / astro)                       | Export scaffold hono + astro manual tests |
| **F9-US3** — All binding types reflected accurately in `wrangler.jsonc`                  | All-binding-types manual test + dry-run   |
| **F9-US4** — Drizzle config + D1 migration stub when D1 is present                       | Inspect ZIP + README conditional sections |
| **F9-US5** — README shows D1 instructions only when D1 is in the diagram                 | README conditional manual test            |
| **F9-US6** — Export button disabled with explanation when no CF services                 | Disabled-when-no-services manual test     |
| **F9-US7** — Every seed blueprint scaffold passes `wrangler deploy --dry-run` in CI      | CI scaffold gate manual + automated test  |

## Rollout / Rollback

**Rollout:** `npm run deploy`. No migrations. Scaffold generation is entirely client-side.

**Rollback:** Redeploy previous version. No data at risk.

## Open Questions

- [ ] Should the scaffold ZIP include `node_modules` (no — always) or a `.npmrc` that the user
      runs `npm install` in? Recommendation: no `node_modules`; README instructs `npm install` as
      the first step after unzipping.
- [ ] Astro template: should it target Cloudflare Workers (SSR) or Cloudflare Pages? Recommendation:
      Workers SSR, consistent with the rest of the stack and `wrangler.jsonc` deployment model.
- [ ] Project name in `wrangler.jsonc`: should it be the sanitised diagram title, or should the
      user be able to enter a different project name? Per F9 spec, use node labels for binding names,
      but the top-level `"name"` in `wrangler.jsonc` should be the overall project name from the
      dialog input.
