# AGENTS.md - Rules for All Phases

This document defines mandatory rules for every phase of the CF-Architect build. Read this before starting any phase. The engineering spec (`.spec/spec.md`) and tech stack (`.spec/stack.md`) are the authoritative references for behavior and technology choices.

---

## 1. Phase Completion Criteria

Every phase MUST end with ALL of the following passing:

1. **`npm run check`** — `tsc --noEmit && eslint . && prettier --check .` exits cleanly.
2. **`npm run test:coverage`** — 100% pass rate, 80% statement/branch/function/line coverage for all code introduced so far.
3. **`npm run dev`** — Dev server starts on `http://localhost:4321` and the page loads in a browser.
4. **`npm run build`** — Production build completes without errors.
5. **Deployable** — `npm run firstrun` (terraform) and `npm run deploy` (wrangler) work with a valid `.env` / `terraform.tfvars`.

Do NOT consider a phase complete until all five gates pass. Fix issues before moving on.

---

## 2. Code Style & Documentation

### JSDoc

- Every exported function, type, interface, constant, and class MUST have a JSDoc comment.
- JSDoc must describe purpose, parameters, and return values.
- Internal (non-exported) helpers need a short JSDoc or inline comment explaining intent.

### TypeScript

- Strict mode (`"strict": true` via `astro/tsconfigs/strict`).
- No `any` types. Use `unknown` and narrow with type guards when dealing with untyped data.
- No `@ts-ignore` or `@ts-expect-error` unless accompanied by a comment explaining why and a linked issue.
- Prefer `interface` over `type` for object shapes. Use `type` for unions, intersections, and mapped types.

### Formatting & Linting

- Prettier and ESLint configs are set in phase 001. Do not modify them in later phases without justification.
- Run `npm run check` frequently during development, not just at the end.

### Imports

- Use path aliases only if configured in tsconfig. Otherwise use relative imports.
- Group imports: external packages first, then internal modules, separated by a blank line.
- Astro components use `.astro` extension; TypeScript files use `.ts`/`.tsx`.

---

## 3. Database Rules

- **All queries go through Kysely.** No raw SQL strings outside of migration files in `src/lib/db/migrations/`.
- **Migrations** use Wrangler D1 format: plain `.sql` files, sequential numbering (`0001_`, `0002_`, ...).
- **Schema types** in `src/lib/db/schema.ts` must stay in sync with migration files.
- **Transactions** use `db.transaction().execute()` for multi-statement atomic operations.
- **UUIDs** generated via `crypto.randomUUID()`.
- **Timestamps** stored as ISO 8601 TEXT in D1, using `datetime('now')` as default.

---

## 4. API Rules

- Follow REST conventions from spec §7.0 exactly.
- **Error responses** always use the `{ error: { code, message } }` envelope.
- **List responses** always use the `{ data, pagination }` envelope.
- **Single resource responses** return the resource object directly (no envelope).
- **JSON field names** in responses use camelCase (e.g., `createdAt`, `githubUsername`).
- **Content-Type validation**: Reject mutations without `application/json` with 415.
- **Body size**: Reject request bodies > 1MB with 413.
- **Pagination**: `limit` clamped to max 100.
- **Authorization**: Every endpoint validates ownership. Users access only their own diagrams. Admin endpoints check `role === 'admin'`.

---

## 5. Security Rules

- **CSRF**: Middleware validates `Origin` header on `POST`/`PUT`/`DELETE` to `/api/*`.
- **Share tokens**: 24 chars from `crypto.getRandomValues()`, URL-safe alphabet.
- **SVG thumbnails**: Served with `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`.
- **No raw HTML injection**: Canvas data is JSON-parsed, never rendered as raw HTML.
- **No secrets in code**: Environment variables for all credentials. Never commit `.env`.
- **Dev auth stub**: Gated behind `import.meta.env.DEV` (compile-time eliminated in production).

---

## 6. Testing Rules

- **Unit tests** in `tests/unit/` mirror the `src/` directory structure.
- **Test file naming**: `*.test.ts` or `*.test.tsx`.
- **Use miniflare** (via `@cloudflare/vitest-pool-workers`) for tests that need D1/KV.
- **Test isolation**: Each test file sets up and tears down its own data. No shared mutable state between tests.
- **Coverage**: v8 provider, 80% threshold on statements, branches, functions, and lines.
- **E2E tests** in `tests/e2e/` use Playwright.
- **Mocking**: Mock external HTTP calls (CF Access endpoints). Never make real external calls in tests.
- **Assertions**: Test both success and error paths for every API endpoint.

---

## 7. Component Rules

### Astro Components (SSR, zero JS)

- Use for static/server-rendered UI: buttons, cards, badges, tables, pagination, avatars, inputs.
- Styled with Tailwind classes only. No React, no `client:*` directives.
- Place reusable Astro UI components in `src/components/ui/`.

### React Islands (interactive, hydrated)

- Use only where client-side interactivity is required: tldraw canvas, dialogs, dropdowns, toasts, tooltips.
- Always use `client:only="react"` for tldraw components (they require DOM APIs and cannot SSR).
- Use `client:load` for immediately needed interactivity (dialogs, menus).
- Use `client:idle` for deferred interactivity (admin role selector).
- shadcn/ui components installed via CLI into `src/components/ui/` and used inside React islands.

### tldraw

- Self-host assets via `public/tldraw-assets/` (copied from `node_modules/@tldraw/assets` at build).
- Disable image/video embedding (`acceptedImageMimeTypes: []`, `acceptedVideoMimeTypes: []`).
- Custom shapes use `BaseBoxShapeUtil`.
- Persistence via `store.getStoreSnapshot()` / `store.loadStoreSnapshot()`.

---

## 8. File Structure

Follow the project structure defined in `.spec/stack.md`. Do not create files outside the established directory tree without justification. Key directories:

```
src/
  components/canvas/          # tldraw components
  components/canvas/shapes/   # custom shape definitions
  components/ui/              # shadcn/ui + Astro UI components
  components/admin/           # admin-specific React islands
  layouts/                    # Astro layouts
  pages/                      # routes (pages + API)
  pages/api/                  # REST API endpoints
  lib/                        # shared business logic
  lib/db/                     # database layer
  lib/auth/                   # authentication
tests/
  unit/                       # vitest unit tests
  e2e/                        # playwright E2E tests
terraform/                    # IaC
public/icons/cf/              # Cloudflare service SVG icons
public/tldraw-assets/         # self-hosted tldraw assets (gitignored)
```

---

## 9. Environment & Configuration

- **Local dev**: `wrangler` provides miniflare D1/KV emulation. No real Cloudflare resources needed.
- **Auth in dev**: Middleware uses dev stub (`import.meta.env.DEV`), injecting a mock admin user.
- **Migrations**: Run `npm run db:migrate:local` for local D1, `npm run db:migrate` for production.
- **Secrets**: `CF_ACCESS_TEAM_NAME` and `INITIAL_ADMIN_GITHUB_USERNAME` set as wrangler vars. `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are Terraform variables only (used by CF Access, not by the Worker).

---

## 10. Phase Execution Checklist

Before marking any phase complete, verify:

- [ ] All files listed in the phase deliverables exist and are implemented
- [ ] All new exports have JSDoc documentation
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and the app is browsable at `http://localhost:4321`
- [ ] `npm run build` succeeds
- [ ] No `TODO` or `FIXME` comments left unresolved (unless explicitly deferred to a named future phase)
