---
phase: "01"
title: "Platform Foundations"
feature: "F1"
status: "Planned"
depends_on: []
---

# Phase 01 — Platform Foundations

## Goal

Establish the complete build, test, and deploy facility: a working monorepo, Terraform-managed
Cloudflare infrastructure, a Hono Worker serving a React SPA via ASSETS, all npm scripts, and
supply-chain hardening — so every subsequent phase has a reliable, repeatable deployment target.

## Deviations from original spec

The following decisions deviate from the spec below. Full rationale in
[`docs/DECISION_LOG.md`](../DECISION_LOG.md).

| #   | Original spec                                                                    | Decision                                                                                                                      |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| D08 | `OSV-Scanner` runs as a CI gate alongside `npm audit` and `npm audit signatures` | Step never functioned (broken action reference); removed from `ci.yml`; reinstatement decision deferred to Phase 12. See D08. |

## Scope

### In Scope

- npm workspaces skeleton (`apps/web`, `apps/worker`, `packages/shared`, `infra/`, `scripts/`, `e2e/`)
- `.npmrc` supply-chain hardening (`ignore-scripts=true`, `engine-strict=true`)
- `scripts/postinstall.mjs` allowlist runner (initial allowlist: `esbuild`)
- Renovate config with 14-day minimum release age
- Terraform infrastructure with `cloudflare/cloudflare` v5 + `jrhouston/dotenv` providers
  (D1 database, two KV namespaces, one R2 bucket, Worker resource)
- `scripts/render-wrangler.ts` — substitutes TF outputs into `wrangler.template.jsonc`
- `migrate:local` / `migrate:remote` npm scripts — apply Drizzle migrations via `wrangler d1 migrations apply` (no custom script; wrangler handles idempotency natively)
- Hono Worker: `/api/health`, `/api/version`, structured JSON logging, rate-limit middleware stub,
  consistent response envelope, 404 handler, ASSETS fallback
- Vite + React 19 SPA: one route showing "CF-Architect" + health-check status
- Drizzle config + empty first migration (`0000_init.sql`)
- TypeScript strict mode everywhere; `tsconfig.base.json` shared config
- ESLint 10 flat config: `@eslint/js` + `typescript-eslint` + `@eslint-react/eslint-plugin`
  (`recommended-typescript`); `parserOptions.projectService: true`
- Prettier, Husky + lint-staged, commitlint (Conventional Commits)
- `lockfile-lint`, `npm audit --audit-level=high`, `npm audit signatures` in CI (OSV-Scanner deferred — see D08)
- Vitest workspace config (web + worker-pool); one passing test per project
- Playwright config + one smoke spec; axe-core helper
- GitHub Actions: `ci.yml` (check + test:ci + build) and `deploy.yml` (manual + on main merge)
- `README.md` quickstart
- `wrangler.template.jsonc` with `${TF_OUTPUT_*}` placeholder pattern
- `@adrianhall/cloudflare-auth` pinned at a specific commit SHA

### Out of Scope

- Authentication / user management (Phase 02)
- Per-PR preview environments (Phase 02)
- Any product feature (Phases 03–11)

## Pre-requisites

- GitHub repository created and accessible
- Cloudflare account with an API token that can create Workers, D1, KV, and R2 resources
- Node.js ≥ 22.0.0 installed locally
- Terraform ≥ 1.9 installed locally

## Tasks

### Repository skeleton

- [ ] Create root `package.json`: `"workspaces": ["apps/*", "packages/*"]`, `"engines": { "node": ">=22.0.0" }`, script stubs (see §Script Reference in PLAN.md)
- [ ] Create workspace directories with minimal `package.json` in each: `apps/web/`, `apps/worker/`, `packages/shared/`, `infra/`, `scripts/`, `e2e/`
- [ ] Create `tsconfig.base.json`: `"strict": true`, `"exactOptionalPropertyTypes": true`, `"noUncheckedIndexedAccess": true`, path aliases
- [ ] Create `.nvmrc` / `.node-version` pinning Node 22
- [ ] Create `.gitignore` (node_modules, dist, wrangler.jsonc, .wrangler, .env, .dev.vars, .terraform, .terraform-outputs.json)

### Supply-chain hardening

- [ ] Write `.npmrc`: `engine-strict=true`, `fund=false`, `audit-level=high` (`ignore-scripts=true` is deferred to Phase 12 — see Design Notes)
- [ ] Write `scripts/postinstall.mjs`: reads allowlist from a `POSTINSTALL_ALLOWLIST` constant (initially `["esbuild"]`); calls `npm rebuild <pkg>` for each; logs what ran and what was skipped; add comment explaining the security rationale
- [ ] Add `lockfile-lint` config (`.lockfile-lintrc.json`): `allowed-hosts: ["registry.npmjs.org"]`, `validate-https: true`
- [ ] Write `.renovaterc.json`: `minimumReleaseAge: "14d"`, `groupName: "dependencies"` for minor/patch, `separateMajorMinor: true`, `prCreation: "not-pending"`, security PRs bypass cooldown

### Shared package

- [ ] `packages/shared/src/schemas/envelope.ts`: Zod schemas for `ApiSuccessResponse` and `ApiErrorResponse`; export `ErrorCode` enum with all error codes from PLAN.md §7
- [ ] `packages/shared/src/messages/en.json`: stub ICU message bundle (a few placeholder keys to establish structure)
- [ ] `packages/shared/src/index.ts`: re-export everything

### Terraform infrastructure

- [ ] `infra/main.tf`: declare `cloudflare/cloudflare ~> 5.0` and `jrhouston/dotenv ~> 1.0` providers; configure cloudflare provider using `data.dotenv.env.env.*` values; add `data "dotenv" "env" { filename = "../.env" }`
- [ ] `infra/variables.tf`: declare `environment` variable (default `"production"`)
- [ ] `infra/d1.tf`: `cloudflare_d1_database` resource named `cf-arch-${var.environment}`
- [ ] `infra/kv.tf`: two `cloudflare_workers_kv_namespace` resources: `cf-arch-shares-${var.environment}` and `cf-arch-catalog-${var.environment}`
- [ ] `infra/r2.tf`: one `cloudflare_r2_bucket` resource: `cf-arch-assets-${var.environment}`
- [ ] `infra/worker.tf`: `cloudflare_worker_script` resource (placeholder; wrangler manages script content)
- [ ] `infra/outputs.tf`: output D1 database id and name, KV namespace IDs, R2 bucket name, Worker name; also write outputs to `.terraform-outputs.json` via `local_file`
- [ ] `.env.example`: document every required variable with description (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, SEED_ADMIN_EMAIL, etc.)
- [ ] `.dev.vars.example`: document DEV_MODE and any local-only overrides

### Wrangler template and render script

- [ ] `wrangler.template.jsonc`: full Wrangler config with SPA ASSETS setup (`not_found_handling: "single-page-application"`, `run_worker_first: ["/api/*", "/_auth/*"]`); D1/KV/R2 bindings using `${TF_OUTPUT_D1_DATABASE_ID}` etc. placeholders; D1 binding must include `migrations_dir: "./apps/worker/src/db/migrations"` (migrations are not co-located with the wrangler config at repo root)
- [ ] `scripts/render-wrangler.ts`: reads `.terraform-outputs.json`; substitutes all `${TF_OUTPUT_*}` tokens in `wrangler.template.jsonc`; writes `wrangler.jsonc`; throws with a clear error if any placeholder is unresolved or if the outputs file is missing
- [ ] Add `wrangler.jsonc` to `.gitignore`

### Hono Worker

- [ ] `apps/worker/src/middleware/logging.ts`: structured JSON log middleware; emits `{ timestamp, method, path, status, duration_ms, requestId }` on every request; attaches `requestId` (UUID) to Hono context
- [ ] `apps/worker/src/middleware/rate-limit.ts`: stub middleware that reads an `X-Rate-Limit-Bypass` header in dev; real counter deferred to Phase 02; returns 429 envelope when triggered
- [ ] `apps/worker/src/lib/envelope.ts`: `ok(data)` and `err(code, message, details?)` helpers returning typed envelope objects
- [ ] `apps/worker/src/routes/health.ts`: `GET /api/health` → `{ status: "ok", timestamp }` (public)
- [ ] `apps/worker/src/routes/version.ts`: `GET /api/version` → `{ version, environment }` (public; version read from `package.json` at build time via Vite define)
- [ ] `apps/worker/src/index.ts`: create Hono app; mount logging + rate-limit middleware; mount health + version routes; 404 handler; ASSETS fallback (`env.ASSETS.fetch(request)`)
- [ ] `apps/worker/tsconfig.json`: extends `../../tsconfig.base.json`; targets `ES2022`; includes Cloudflare Workers types
- [ ] `apps/worker/package.json`: scripts (`build`, `check:types`, `test:unit`); devDependencies including `hono`, `wrangler`, `@cloudflare/workers-types`, `drizzle-orm`, `drizzle-kit`, `vitest`, `@cloudflare/vitest-pool-workers`, `@vitest/coverage-istanbul`

### Drizzle and migration scaffold

- [ ] `apps/worker/drizzle.config.ts`: configure D1 local and remote targets
- [ ] `apps/worker/src/db/schema.ts`: empty schema file (just exports a comment for Phase 02+)
- [ ] `apps/worker/src/db/migrations/0000_init.sql`: empty migration (establishes migrations infrastructure)

> **Note:** No `scripts/migrate.ts` is needed. Migrations are applied via `wrangler d1 migrations apply DB` directly — see `migrate:local` and `migrate:remote` scripts in root `package.json`. Wrangler tracks applied migrations in a `d1_migrations` table and skips already-applied ones, making repeated runs safe.

### Vite + React SPA

- [ ] `apps/web/package.json`: `vite`, `react`, `react-dom`, `@vitejs/plugin-react`, `@tanstack/react-router`, `typescript`, `@types/react`, `@types/react-dom`; scripts (`build`, `dev`, `check:types`, `test:unit`)
- [ ] `apps/web/vite.config.ts`: React plugin; `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`; dev-server proxy `/api → http://localhost:8787`
- [ ] `apps/web/index.html`: inline `<script>` reading `localStorage.getItem("theme")` and setting `data-theme` on `<html>` before React hydrates (no-FOUC pattern)
- [ ] `apps/web/src/styles/tokens.css`: CSS custom properties for light, dark, high-contrast themes (stub values; full design tokens in Phase 04)
- [ ] `apps/web/src/routes/__root.tsx`: TanStack Router root route; renders `<Outlet />`; sets up TanStack Query `QueryClient`
- [ ] `apps/web/src/routes/index.tsx`: root route; fetches `/api/health` via TanStack Query; renders "CF-Architect" heading + health status

### Tooling

- [ ] `eslint.config.ts` at repo root: `defineConfig([{ files: ["**/*.ts", "**/*.tsx"], extends: [eslintJs.configs.recommended, tseslint.configs.recommended, eslintReact.configs["recommended-typescript"]], languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } }])`
- [ ] `prettier.config.ts`: semi, singleQuote, tabWidth 2, printWidth 100
- [ ] `.prettierignore`: dist, node_modules, wrangler.jsonc, .terraform
- [ ] Install Husky: `npx husky init`; `.husky/pre-commit`: `npx lint-staged`; `.husky/commit-msg`: `npx commitlint --edit $1`
- [ ] `lint-staged` config in `package.json`: `"*.{ts,tsx}": ["eslint --fix", "prettier --write"]`, `"*.{json,md,css}": ["prettier --write"]`
- [ ] `commitlint.config.ts`: `@commitlint/config-conventional`

### Tests

- [ ] `vitest.workspace.ts`: define projects `web` (`apps/web/vitest.config.ts`), `worker` (`apps/worker/vitest.config.ts`), `shared` (`packages/shared/vitest.config.ts`); set workspace-level `coverage` to `{ provider: "istanbul", reporter: ["text", "lcov", "html"], reportsDirectory: "./coverage" }` — Istanbul is mandatory because `@cloudflare/vitest-pool-workers` does not support V8 coverage
- [ ] `apps/worker/vitest.config.ts`: `pool: "@cloudflare/vitest-pool-workers"`; `poolOptions.wrangler.configPath: "./wrangler.jsonc"`; `coverage.provider: "istanbul"` (must be consistent with workspace config)
- [ ] `apps/worker/src/routes/health.test.ts`: test `GET /api/health` returns 200 with `{ ok: true, data: { status: "ok" } }`
- [ ] `apps/worker/src/routes/version.test.ts`: test `GET /api/version` returns 200 with `version` string
- [ ] `apps/worker/src/lib/envelope.test.ts`: test success and error envelope shapes match Zod schema
- [ ] `scripts/render-wrangler.test.ts`: test placeholder substitution; test error on missing placeholder
- [ ] `playwright.config.ts`: baseURL `http://localhost:8787`; include `@axe-core/playwright`
- [ ] `e2e/helpers/axe.ts`: helper wrapping `injectAxe()` + `checkA11y()` with standard options
- [ ] `e2e/specs/smoke.spec.ts`: navigate to `/`; assert heading "CF-Architect"; assert `/api/health` returns `ok`
- [ ] `e2e/specs/a11y.spec.ts` (tagged `@a11y`): run axe on root `/`; assert zero serious/critical violations

### CI / CD

- [ ] `.github/workflows/ci.yml`: trigger on push + PR; steps: `npm ci`, `npm run check`, `npm run test:ci` (runs all Vitest projects with Istanbul coverage; uploads `./coverage/lcov.info` as a CI artefact), `npm run build`, `lockfile-lint`, `npm audit signatures` (OSV-Scanner deferred — see D08)
- [ ] `.github/workflows/deploy.yml`: trigger on `workflow_dispatch` + push to `main`; reuses ci steps; then `npm run deploy` (which internally chains `generate:wrangler → migrate:remote → deploy:worker`)
- [ ] Add GitHub repository secrets documentation to README: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (deploy-scoped)

### Documentation

- [ ] `README.md`: prerequisites; quickstart (clone → .env → npm install → npm run provision → npm run deploy); local dev (`npm start`); script reference table; postinstall allowlist explanation; supply-chain hygiene notes (including note that `ignore-scripts=true` disables npm `pre*`/`post*` auto-hooks — all sequencing uses explicit `run-s` chains); link to PLAN.md

## Schema Changes

Migration `0000_init.sql` is empty — it establishes the Drizzle migrations infrastructure without
creating any tables.

## API Additions

### `GET /api/health`

```jsonc
// 200 OK — public, no auth required
{
  "ok": true,
  "data": { "status": "ok", "timestamp": "2026-05-22T00:00:00.000Z" },
  "meta": { "requestId": "req_01abc…" },
}
```

### `GET /api/version`

```jsonc
// 200 OK — public, no auth required
{
  "ok": true,
  "data": { "version": "0.1.0", "environment": "production" },
  "meta": { "requestId": "req_01abc…" },
}
```

### Unknown route

```jsonc
// 404
{
  "ok": false,
  "error": { "code": "NOT_FOUND", "message": "Route not found" },
  "meta": { "requestId": "req_01abc…" },
}
```

## Test Plan

### Unit (Vitest — all projects; Istanbul coverage collected automatically)

- [ ] `render-wrangler.ts` — substitutes all `${TF_OUTPUT_*}` tokens; throws on any unresolved token; throws if `.terraform-outputs.json` is missing
- [ ] `postinstall.mjs` — runs allowed packages; skips non-listed packages; emits correct log lines
- [ ] Envelope helpers — `ok(data)` produces valid `ApiSuccessResponse`; `err(code, message)` produces valid `ApiErrorResponse`

### Worker integration (Vitest + @cloudflare/vitest-pool-workers — included in `test:unit`)

- [ ] `GET /api/health` → 200, `ok: true`, `status: "ok"`
- [ ] `GET /api/version` → 200, `version` field present
- [ ] `GET /api/unknown` → 404 envelope
- [ ] Rate-limit stub → 429 envelope when triggered via test header

### E2E (Playwright)

- [ ] Navigate to `/`; assert heading contains "CF-Architect"
- [ ] Assert health status shown on page reads "ok"

### Accessibility (axe-core/playwright) `@a11y`

- [ ] Root `/` page: zero serious/critical axe violations

### CI gates

- [ ] `npm run check:types` clean
- [ ] `npm run check:lint` clean
- [ ] `npm run check:format` clean
- [ ] `npm run check:audit` — no high/critical CVEs; signatures verified
- [ ] `lockfile-lint` — all `resolved` URLs are `https://registry.npmjs.org/`
- [ ] OSV-Scanner — deferred to Phase 12 (see D08)
- [ ] `npm run test:ci` exits 0 and `./coverage/lcov.info` is written
- [ ] `npm run build` succeeds

## Manual Tests

Work through these after all automated checks pass. Tick each box when confirmed.

- [ ] **Clean install** — Delete `node_modules/` and run `npm ci` from a clean shell. Confirm
      no unexpected postinstall scripts fire (terminal output shows only the allowlist runner logging
      "running esbuild"; no other package scripts execute).
- [ ] **Provision** — Copy `.env.example` to `.env`, fill in credentials. Run `npm run provision`.
      Open the Cloudflare dashboard. Confirm: a D1 database named `cf-arch-production`, two KV
      namespaces (`cf-arch-shares-production`, `cf-arch-catalog-production`), and one R2 bucket
      (`cf-arch-assets-production`) all exist.
- [ ] **render-wrangler** — After provision, confirm `wrangler.jsonc` was auto-generated (the
      `provision` script runs `generate:wrangler` as its final step via `run-s`). Open it. Confirm no
      `${TF_OUTPUT_*}` tokens remain — all are replaced with real IDs/names from Terraform outputs.
- [ ] **Local dev** — Run `npm start`. Open `http://localhost:8787`. Confirm the "CF-Architect"
      heading renders and the health status shows "ok".
- [ ] **Health endpoint** — In a terminal: `curl -s http://localhost:8787/api/health | jq`. Confirm
      `ok: true`, `data.status: "ok"`, and a `meta.requestId` field present.
- [ ] **Version endpoint** — `curl -s http://localhost:8787/api/version | jq`. Confirm `version`
      field is present and matches the version in root `package.json`.
- [ ] **404 envelope** — `curl -s http://localhost:8787/api/does-not-exist | jq`. Confirm
      HTTP 404 and `ok: false` with `error.code: "NOT_FOUND"`.
- [ ] **Structured logging** — Make a request to `http://localhost:8787/api/health`. In the wrangler
      dev console, confirm a JSON log line appears containing `method`, `path`, `status`, `duration_ms`,
      and `requestId`.
- [ ] **Commit hook — commitlint** — Stage a file and run `git commit -m "blah"`. Confirm commitlint
      rejects it with a message about Conventional Commits format. Then commit with
      `git commit -m "chore: test commit hook"` and confirm it succeeds.
- [ ] **Commit hook — lint-staged** — Introduce a deliberate ESLint error (e.g. add `var x = 1` to
      any `.ts` file). Stage the file and attempt a commit. Confirm lint-staged blocks the commit and
      reports the ESLint error. Fix the error and confirm the commit then succeeds.
- [ ] **Lockfile registry check** — Open `package-lock.json`. Spot-check 10 different `"resolved"`
      entries across different packages. Confirm every one begins with `https://registry.npmjs.org/`.
      Confirm the `@adrianhall/cloudflare-auth` entry uses a GitHub SHA URL, not a branch name.
- [ ] **Deploy to production** — Run `npm run deploy`. Observe the output: `generate:wrangler` runs
      first, then `migrate:remote` (wrangler reports each migration as applied or already-applied),
      then `deploy:worker`. Open the production URL from wrangler output. Confirm the page loads and
      `GET /api/health` returns `{ status: "ok" }`. Run `npm run deploy` a second time; confirm the
      migration step shows all migrations already applied (idempotent).
- [ ] **Coverage output** — Run `npm run test:unit` locally. Confirm a `./coverage/` directory is
      created containing `lcov.info`, an `html/` folder, and a text summary printed to the terminal
      showing per-file line/branch/function coverage percentages. Open `coverage/html/index.html` in a
      browser and confirm it shows coverage for files in all three projects (web, shared, worker).
- [ ] **CI green** — Push a branch to GitHub. Confirm the `ci.yml` workflow run completes entirely
      green (all check, test, and build steps pass). Confirm the `coverage/lcov.info` artefact is
      visible in the workflow run's artefacts list.

## Acceptance Criteria

| Story                                                                                 | How we verify                                                                                                                                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1-US4** — `npm run provision` provisions all Cloudflare resources with one command | `npm run provision` succeeds from scratch; D1/KV/R2/Worker all appear in the Cloudflare dashboard                                             |
| **F1-US5** — `npm run deploy` is idempotent; applies migrations before deploying      | Run `npm run deploy` twice consecutively; both succeed; second run shows migrations already applied (no-op) and re-deploys the Worker cleanly |
| **F1-US6** — `npm start` runs the code locally                                        | `npm start` launches wrangler dev; app accessible at `localhost:8787`                                                                         |
| **F1-US1** — Structured JSON logs on every request                                    | Manual logging test above: each request emits a JSON log with `method`, `path`, `status`, `duration_ms`, `requestId`                          |

## Rollout / Rollback

**Rollout:** `npm run provision` → `npm run deploy`. The `deploy` script chains
`generate:wrangler → migrate:remote → deploy:worker` automatically. Migration 0000 is a no-op so
there is no risk.

**Rollback:** `npm run teardown` tears down all created Cloudflare resources (`terraform destroy`) and
removes the now-stale `wrangler.jsonc` and `.terraform-outputs.json`. No user data exists at this
phase. Use `npm run clean` to additionally remove build artefacts and local wrangler state.

## Open Questions

- [ ] Which Cloudflare account to use for CI deployments? A dedicated sub-account or the main
      account? Recommend: dedicated CI sub-account with a narrow `Workers Scripts:Edit`-scoped API token
      stored as a GitHub secret.
- [ ] Should `wrangler.jsonc` be entirely gitignored (cleanest), or should a blank/example version
      be committed? Recommendation: gitignore `wrangler.jsonc`; commit only `wrangler.template.jsonc`.
      Document this clearly in the README.
- [ ] Confirm the exact commit SHA to pin for `@adrianhall/cloudflare-auth` before writing
      `apps/worker/package.json`.

## Design Notes

### Script sequencing with `run-s`

All multi-step npm scripts in this project use explicit `run-s` chains (e.g. `provision`,
`deploy`, `dev:worker`) rather than `pre*`/`post*` auto-hooks. This is intentional: explicit
chains are easier to read, debug, and audit regardless of `ignore-scripts` state. Do not add
`predeploy`-style hooks; add each step directly to the relevant `run-s` chain.

### `ignore-scripts=true` status

`ignore-scripts=true` is **suspended during Phases 01–11** to keep the development loop
frictionless. It will be re-instated and the postinstall allowlist fully audited in Phase 12.
See [phase-12.md](./phase-12.md).
