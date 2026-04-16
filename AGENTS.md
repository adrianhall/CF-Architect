# AGENTS.md - Rules for All Phases

This document defines mandatory rules for every phase of the CF-Architect build. Read this before starting any phase. The engineering spec (`.spec/spec.md`) and tech stack (`.spec/stack.md`) are the authoritative references for behavior and technology choices.

---

## 1. Phase Completion Criteria

Every phase MUST end with ALL of the following passing:

1. **`npm run build`** — Production build completes without errors.
2. **`npm run fullcheck`** - Must exist cleanly, with 80% code coverage from the unit tests.
3. **`npm run test:e2e`** - shows all tests pass.

Do NOT consider a phase complete until both gates pass. Fix issues before moving on.

---

## 2. Documentation-First Research

When encountering an unfamiliar API, configuration option, error message, or framework behavior, **always consult official documentation before guessing or reading npm package source code.**

### Available Documentation Sources

Use the `WebFetch` tool to retrieve official documentation. Key sources for this project:

| Topic                                                      | Documentation URL                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Cloudflare Workers / D1 / KV                               | https://developers.cloudflare.com/workers/                            |
| Wrangler CLI                                               | https://developers.cloudflare.com/workers/wrangler/                   |
| Cloudflare Vitest pool (`@cloudflare/vitest-pool-workers`) | https://developers.cloudflare.com/workers/testing/vitest-integration/ |
| Astro                                                      | https://docs.astro.build/                                             |
| React                                                      | https://react.dev/                                                    |
| tldraw                                                     | https://tldraw.dev/docs                                               |
| Kysely                                                     | https://kysely.dev/docs/intro                                         |
| Vitest                                                     | https://vitest.dev/guide/                                             |
| Playwright                                                 | https://playwright.dev/docs/intro                                     |
| Tailwind CSS                                               | https://tailwindcss.com/docs                                          |
| shadcn/ui                                                  | https://ui.shadcn.com/docs                                            |

For any other npm package, check `https://www.npmjs.com/package/<package-name>` or the package's own documentation site first.

### Rules

- **Never guess** at an API signature, configuration key, or framework behavior. If uncertain, fetch the docs.
- **Never read `node_modules/` source code** to infer how a package works. Use official documentation instead.
- **Never run `node` scripts to inspect or analyze packages.** This is dangerous and forbidden. Use `npm info <package>` (or `npm info <package> exports`, `npm info <package> version`, etc.) to introspect package metadata from the registry instead.
- **Fetch docs proactively**: before writing any non-trivial integration (e.g., a new Wrangler binding, a tldraw shape, a Vitest worker pool config), retrieve the relevant documentation page first.
- **If the first doc page is insufficient**, follow links within the docs or try a more specific URL rather than falling back to guessing.
- **Record the source URL** in a code comment when a non-obvious API usage is derived from documentation, so future agents can verify the reference.

---

## 3. Code Style & Documentation

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

## 4. Database Rules

- **All queries go through Kysely.** No raw SQL strings outside of migration files in `src/lib/db/migrations/`.
- **Migrations** use Wrangler D1 format: plain `.sql` files, sequential numbering (`0001_`, `0002_`, ...).
- **Schema types** in `src/lib/db/schema.ts` must stay in sync with migration files.
- **Atomic operations** use D1's native `batch()` API instead of Kysely transactions. The `kysely-d1` dialect does **not** support `db.transaction().execute()` (it throws at runtime). Use Kysely's `.compile()` to build typed queries, then pass the compiled SQL to `env.DB.prepare(sql).bind(...params)` and execute via `env.DB.batch([...stmts])`. D1 batch executes statements as an implicit SQL transaction — if any statement fails, the entire batch is rolled back.
  Ref: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
- **UUIDs** generated via `crypto.randomUUID()`.
- **Timestamps** stored as ISO 8601 TEXT in D1, using `datetime('now')` as default.

---

## 5. API Rules

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

## 6. Security Rules

- **CSRF**: Middleware validates `Origin` header on `POST`/`PUT`/`DELETE` to `/api/*`.
- **Share tokens**: 24 chars from `crypto.getRandomValues()`, URL-safe alphabet.
- **SVG thumbnails**: Served with `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`.
- **No raw HTML injection**: Canvas data is JSON-parsed, never rendered as raw HTML.
- **No secrets in code**: Environment variables for all credentials. Never commit `.env`.
- **Dev auth stub**: Gated behind `import.meta.env.DEV` (compile-time eliminated in production).

---

## 7. Testing Rules

- **Unit tests** in `tests/unit/` mirror the `src/` directory structure.
- **Test file naming**: `*.test.ts` or `*.test.tsx`.
- **Use miniflare** (via `@cloudflare/vitest-pool-workers`) for tests that need D1/KV.
- **Test isolation**: Each test file sets up and tears down its own data. No shared mutable state between tests.
- **Coverage**: Istanbul provider (V8 is not supported by `@cloudflare/vitest-pool-workers`), 80% threshold on statements, branches, functions, and lines.
- **E2E tests** in `tests/e2e/` use Playwright.
- **Mocking**: Mock external HTTP calls (CF Access endpoints). Never make real external calls in tests.
- **Assertions**: Test both success and error paths for every API endpoint.

---

## 8. Component Rules

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

- tldraw v4 bundles its own UI assets (fonts, icons, translations) internally. The `@tldraw/assets` package no longer exists as a standalone copy target. If corporate network restrictions block tldraw's default CDN loads, configure asset URLs via tldraw's `assetUrls` prop at the component level. The `public/tldraw-assets/` directory and `copy:tldraw-assets` script remain as placeholders for this purpose.
- Disable image/video embedding (`acceptedImageMimeTypes: []`, `acceptedVideoMimeTypes: []`).
- Custom shapes use `BaseBoxShapeUtil`.
- Persistence via `store.getStoreSnapshot()` / `store.loadStoreSnapshot()`.

---

## 9. File Structure

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

## 10. Environment & Configuration

- **Local dev**: `wrangler` provides miniflare D1/KV emulation. No real Cloudflare resources needed.
- **Auth in dev**: Middleware uses dev stub (`import.meta.env.DEV`), injecting a mock admin user.
- **Migrations**: Run `npm run db:migrate:local` for local D1, `npm run db:migrate` for production.
- **Secrets**: `CF_ACCESS_TEAM_NAME` and `INITIAL_ADMIN_GITHUB_USERNAME` set as wrangler vars. `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are Terraform variables only (used by CF Access, not by the Worker).

---

## 11. Phase Execution Checklist

Before marking any phase complete, verify:

- [ ] All files listed in the phase deliverables exist and are implemented
- [ ] All new exports have JSDoc documentation
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and the app is browsable at `http://localhost:4321`
- [ ] `npm run build` succeeds
- [ ] No `TODO` or `FIXME` comments left unresolved (unless explicitly deferred to a named future phase)
