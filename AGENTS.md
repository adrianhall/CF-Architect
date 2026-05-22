# AGENTS.md — CF-Architect v2

Guidance for AI agents working on this codebase across all 12 phases.

---

## 1. Project overview

CF-Architect v2 is a visual architecture design tool for Cloudflare. It is a TypeScript
monorepo (npm workspaces) with:

| Package           | Purpose                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `apps/web`        | Vite + React 19 SPA (TanStack Router, TanStack Query, TanStack Table) |
| `apps/worker`     | Hono Worker (Cloudflare Workers) — API + ASSETS fallback              |
| `packages/shared` | Shared Zod v3 schemas, error codes, i18n stubs                        |

Full engineering reference: `docs/PLAN.md`
Per-phase task lists: `docs/plan/phase-NN.md`
Phase index: `docs/PLAN.md §13`

---

## 2. Definition of done

A phase is **not complete** until **all** of the following pass with zero errors:

```bash
npm run check       # types + lint + format + audit
npm run test:ci     # all Vitest projects (unit + integration)
npm run build       # web + worker dry-run
```

**Before starting work:** run `npm run check` and `npm run test:ci` so you know
the baseline. Fix any pre-existing failures before layering new changes.

**Fix formatting at any time:** `npm run fix` (runs `eslint --fix` + `prettier --write`).
Do not submit code that requires manual formatting adjustments.

**Type-check individual workspaces** to get faster feedback during development:

```bash
npm run check:types --workspace=apps/worker
npm run check:types --workspace=apps/web
npm run check:types --workspace=packages/shared
```

**Run only worker tests** during backend iteration:

```bash
npx vitest run --project worker --reporter=verbose
```

---

## 3. Decision log

`docs/DECISION_LOG.md` is the authoritative record of architectural and
implementation decisions. **Write a new entry whenever you:**

- Choose between two or more viable implementation approaches
- Deviate from what `docs/plan/phase-NN.md` specifies
- Make a decision with non-obvious tradeoffs that will constrain future phases
- Resolve a conflict between documentation and reality

**Entry format:**

```markdown
### D<N> — Short title

**Status:** Accepted | Deferred | Superseded by D<M>
**Phase:** NN

**Decision:** One sentence describing what was decided.

**Context:** Why this decision needed to be made.

**Alternatives considered:**

- _Option A_: ...
- _Option B_: ...

**Rationale:** Why the chosen option was selected.
```

Increment the `D` number sequentially. Never delete or overwrite existing entries;
supersede them by adding "**Status:** Superseded by D<N>" and a new entry.

**Update phase docs:** When a decision deviates from `docs/plan/phase-NN.md`, add a
"Deviations from original spec" table to that file (see `phase-02.md` for the pattern)
and reference the decision number from `DECISION_LOG.md`.

---

## 4. TypeScript constraints

The entire codebase uses TypeScript strict mode with two settings that cause
non-obvious compile errors:

### `exactOptionalPropertyTypes: true`

With this setting, `{ q?: string }` and `{ q: string | undefined }` are **different
types**. Passing `q: someUndefinedValue` to a function that expects `q?: string`
is a type error.

**Pattern to use when calling functions with optional params:**

```typescript
// ❌ Fails: q is string | undefined, not string
fn({ q: maybeUndefined });

// ✅ Use conditional spread
fn({ ...(maybeUndefined !== undefined && { q: maybeUndefined }) });

// ✅ Or omit the key entirely when undefined
const params: Params = { required: "value" };
if (maybeUndefined !== undefined) params.q = maybeUndefined;
```

This pattern appears frequently when passing Zod-parsed query params to query helpers
and when calling TanStack Table's `useReactTable`.

### `noUncheckedIndexedAccess: true`

Array indexing (`arr[0]`) returns `T | undefined`, not `T`. Always guard with
`?? defaultValue` or an existence check before use.

---

## 5. Key package constraints

### Zod

The project uses **Zod v3** (`^3.25.x`) in `packages/shared`. This is intentional —
Zod v4 is a major rewrite with different internals. Do not upgrade to v4 until all
phases are complete and a migration is explicitly planned.

When adding Hono validators, use `@hono/zod-validator@^0.7.6`, which supports both
Zod v3 and v4. Version 0.8.x dropped v3 support.

### `@adrianhall/cloudflare-auth`

Pinned to a specific commit SHA in `apps/worker/package.json`:

```json
"@adrianhall/cloudflare-auth": "github:adrianhall/cloudflare-auth#447daa60bc3a0c4b72a9c2aa7f2ab2ac06013139"
```

Do not change to a branch name or "latest". If upgrading, pin to a new SHA and
review the diff. Key behaviours to understand:

- `developerAuthentication` is a **no-op in production** (detects real CF Access
  headers and passes through). In local dev it serves `/_auth/login` interactively.
  No `DEV_MODE` flag is needed or checked — it activates automatically.
- `cloudflareAccess` verifies JWTs via HMAC first (for dev JWTs), then JWKS.
  `CLOUDFLARE_TEAM_DOMAIN` is only read when verifying real (non-dev) JWTs.
- `VerifiedToken` only exposes `{ email, sub }`. To get `exp`, decode the JWT
  payload from the `cf-access-jwt-assertion` header directly (it's already verified).

---

## 6. ESLint rules to watch

### `@typescript-eslint/no-unused-vars`

Prefix intentionally unused variables with `_` to suppress:

```typescript
const [_state, setState] = useState(0); // _state intentionally unused
```

### `@typescript-eslint/consistent-type-imports`

Always use `import type` for type-only imports:

```typescript
import type { MiddlewareHandler } from "hono"; // ✅
import { MiddlewareHandler } from "hono"; // ❌ error
```

### `@eslint-react/hooks-extra/no-direct-set-state-in-use-effect`

Do not call `setState` synchronously inside a `useEffect` body. Derive state from
other values instead, or call `setState` inside an async callback (e.g. `setInterval`,
`fetch().then(...)`):

```typescript
// ❌ setState called directly in useEffect
useEffect(() => {
  setFoo(computeFoo());
}, [dep]);

// ✅ Derive the value without setState
const foo = useMemo(() => computeFoo(dep), [dep]);

// ✅ setState inside async callback is fine
useEffect(() => {
  const id = setInterval(() => setState(Date.now()), 1000);
  return () => clearInterval(id);
}, []);
```

### React import

The project uses the **new JSX transform** (`jsx: "react-jsx"`). Do **not** add
`import React from "react"` to component files — it is unused and will cause a
lint error. Only import specific hooks/types you actually use:

```typescript
import { useState, useEffect } from "react"; // ✅
import React from "react"; // ❌ unused
```

---

## 7. Testing conventions

### What to test

- **Our business logic**: query helpers, middleware (auth context, CSRF), route
  handlers (correct status codes, response shapes, access control).
- **Behaviour at boundaries**: what the function returns when given valid/invalid
  input; what HTTP status is returned for various auth states.

### What NOT to test

- **Cloudflare infrastructure**: do not test that the native `ratelimit` binding
  enforces limits, that KV reads/writes work, or that D1 enforces CHECK constraints.
  Trust that Cloudflare's platform works.
- **Third-party library internals**: do not test that `developerAuthentication`
  redirects to login or that `cloudflareAccess` returns 401 on a missing JWT.
  Those are library tests. Test your code around them.

### Worker test setup

Tests run inside the Cloudflare Workers runtime via `@cloudflare/vitest-pool-workers`.

**D1 migration pattern** (official `vitest-pool-workers` example):

```typescript
// apps/worker/vitest.config.ts
const migrations = await readD1Migrations("./src/db/migrations");
cloudflareTest({
  miniflare: {
    bindings: { TEST_MIGRATIONS: migrations }, // injected as a binding
  },
});

// apps/worker/test/apply-migrations.ts (setupFiles entry)
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); // runs before each file
```

**Auth in integration tests** — use `signDevJwt` from `@adrianhall/cloudflare-auth`
to mint tokens, then set the `cf-access-jwt-assertion` header directly. This bypasses
`developerAuthentication` (which no-ops when that header is present) and lets
`cloudflareAccess` verify the token via HMAC:

```typescript
// test/auth-helper.ts
import { signDevJwt } from "@adrianhall/cloudflare-auth";
const token = await signDevJwt(email);
headers["cf-access-jwt-assertion"] = token;
headers["Origin"] = "http://localhost"; // passes CSRF Origin check
```

**`SELF` vs `exports`**: `SELF` from `cloudflare:test` is deprecated; prefer
`exports.default.fetch()` from `cloudflare:workers` for new tests. Existing
`SELF.fetch(...)` calls continue to work.

**CSRF in integration tests**: mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`)
to protected routes require passing the CSRF check. The simplest approach is to
include `Origin: "http://localhost"` in the headers, which matches the request URL's
host and passes the Origin check in `csrfMiddleware`.

### Migration SQL files

Migration files must contain at least one SQL statement. A comment-only file will
cause `applyD1Migrations` to fail with `D1_ERROR: SQL code did not contain a statement`.
Add `SELECT 1;` as a no-op sentinel if a migration file is intentionally empty.

---

## 8. Wrangler config conventions

### `wrangler.template.jsonc`

The production config template. Contains `${TF_OUTPUT_*}` tokens substituted by
`npm run generate:wrangler` (reads `.terraform-outputs.json`). **Never edit
`wrangler.jsonc` directly** — it is gitignored and generated.

### `wrangler.test.jsonc`

The committed test fixture used by:

- `apps/worker/vitest.config.ts` (via `wrangler.configPath`)
- `npm run build:worker` (dry-run)
- `npm run dev:worker:serve` (local wrangler dev)

Keep stub binding IDs consistent between `wrangler.template.jsonc` and
`wrangler.test.jsonc`. When adding a new binding:

1. Add the production binding to `wrangler.template.jsonc` with a `${TF_OUTPUT_*}` token
2. Add a stub equivalent to `wrangler.test.jsonc`
3. Add the binding to the `Bindings` type in `apps/worker/src/index.ts`

### `ratelimits` namespace_id

The `namespace_id` field in `ratelimits` entries must be a **string**, not a number:

```jsonc
// ✅
{ "name": "RL_SHARES", "namespace_id": "1001", "simple": { "limit": 10, "period": 60 } }

// ❌ Wrangler validation error
{ "name": "RL_SHARES", "namespace_id": 1001, ... }
```

---

## 9. TanStack Router file naming

TanStack Router auto-generates `routeTree.gen.ts` from files in `apps/web/src/routes/`.

| File pattern        | Route behaviour                                  |
| ------------------- | ------------------------------------------------ |
| `_layout.tsx`       | Pathless layout (no URL segment, wraps children) |
| `_layout.child.tsx` | Route at `/child` inside the `_layout` boundary  |
| `index.tsx`         | Root route at `/`                                |
| `foo.tsx`           | Route at `/foo`                                  |
| `foo.bar.tsx`       | Route at `/foo/bar`                              |

The route tree is regenerated on every `vite build` or `vite dev` run. Do not
edit `routeTree.gen.ts` manually.

**Import paths in route files**: route files live in `apps/web/src/routes/`. Imports
to other `src/` directories use `../`, not `../../`:

```typescript
// ✅ from apps/web/src/routes/some-route.tsx
import { useCurrentUser } from "../features/f02-auth/useCurrentUser.js";

// ❌ one level too many
import { useCurrentUser } from "../../features/f02-auth/useCurrentUser.js";
```

---

## 10. Auth and CSRF conventions

### Middleware order in `apps/worker/src/index.ts`

```
loggingMiddleware          → sets requestId
developerAuthentication    → dev login form; no-op in production
cloudflareAccess           → verifies JWT; sets userEmail + userSub
attachUserContext          → upserts user; sets userId + userRole + userExp
csrfMiddleware             → Origin check or double-submit cookie
```

Rate limiting is applied **per route** via `rateLimit("RL_*")`, not globally.

### CSRF double-submit cookie

The `CF_CSRF` cookie is intentionally **not HttpOnly** — the SPA must read it to
attach the `X-CSRF-Token` header on mutating requests. It uses `SameSite=Strict` to
prevent cross-origin reads. Set it in `csrfMiddleware` on every response if not
already present (see D07 in `docs/DECISION_LOG.md`).

### Session expiry

`GET /api/me` returns `exp` (Unix seconds from the JWT). The `SessionExpiryBanner`
reads this from `useCurrentUser().exp`. Do **not** attempt to read `CF_Authorization`
from JavaScript — it is `HttpOnly` (see D01 in `docs/DECISION_LOG.md`).

---

## 11. Database conventions

### Drizzle + D1

- Schema: `apps/worker/src/db/schema.ts`
- Migrations: `apps/worker/src/db/migrations/*.sql` (named `NNNN_description.sql`)
- Query helpers: `apps/worker/src/db/queries/` — one file per table, barrel at `index.ts`

New migrations increment the four-digit prefix sequentially. Migration files must
contain at least one SQL statement (see §7 above).

### `exactOptionalPropertyTypes` with Drizzle

Drizzle's `.get()` returns `T | undefined`. The `as` cast pattern is commonly needed:

```typescript
const row = await db.select().from(table).where(eq(table.id, id)).get();
return row ?? null; // explicit null, not undefined
```

---

## 12. Shared package (`@cf-architect/shared`)

All types shared between the Worker and the SPA live here. The import alias
`@cf-architect/shared` resolves to `packages/shared/src/index.ts` via `tsconfig.base.json`.

When adding new schemas:

1. Create the Zod schema file in `packages/shared/src/schemas/`
2. Export the schema and its type from `packages/shared/src/index.ts`
3. Import in both `apps/worker` and `apps/web` as needed

Type exports follow the dual-export pattern (schema object + type alias):

```typescript
export { MySchema } from "./schemas/my-schema.js";
export type { MySchema as MySchemaType } from "./schemas/my-schema.js";
```

---

## 13. Phase dependencies

| Phase | Title                         | Depends on |
| ----- | ----------------------------- | ---------- |
| 01    | Platform Foundations          | —          |
| 02    | Identity, Access & Multi-User | 01         |
| 03    | Cloudflare Service Catalog    | 01         |
| 04    | Architecture Canvas           | 02, 03     |
| 05    | Diagram Lifecycle             | 04         |
| 06    | Blueprints & Templates        | 05         |
| 07    | Sharing & Read-Only View      | 05         |
| 08    | Export & Print                | 04         |
| 09    | Project Scaffold Export       | 03, 08     |
| 10    | MCP Server                    | 09         |
| 11    | In-App AI Architect Chat      | 10         |
| 12    | Security Hardening            | 01–11      |

Each phase plan at `docs/plan/phase-NN.md` lists its scope, tasks, schema changes,
API additions, and acceptance criteria. **Read the phase plan before starting work.**

Stubs and placeholders left by earlier phases are documented with inline comments
referencing the phase that will complete them, e.g.:

```typescript
diagramCount: 0, // Wired in Phase 05
```

Do not remove stubs ahead of their planned phase.

---

## 14. Running the app locally

```bash
# First-time setup
cp .env.example .env       # fill in credentials
cp .dev.vars.example .dev.vars  # optionally add SEED_ADMIN_EMAIL
npm ci
npm run provision          # terraform init + apply + generate:wrangler

# Start dev server
npm start                  # builds web, then wrangler dev at localhost:8787

# Or, for parallel hot-reload:
npm run dev:web            # Vite at localhost:5173 (proxies /api to 8787)
npm run dev:worker         # wrangler dev at localhost:8787
```

No `DEV_MODE` variable is required. The dev login form at `/_auth/login` activates
automatically when real Cloudflare Access headers are absent.
