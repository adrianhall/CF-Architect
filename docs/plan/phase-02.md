---
phase: "02"
title: "Identity, Access & Multi-User"
feature: "F2"
status: "Planned"
depends_on: ["01"]
---

# Phase 02 — Identity, Access & Multi-User

## Goal

Wire Cloudflare Access authentication into the Hono Worker, provision user records on first login,
enforce CSRF protection on all mutating endpoints, and provide an admin panel with full audit trail
and user management. Add per-PR preview environment provisioning (the item deferred from Phase 01).

## Scope

### In Scope

- `@adrianhall/cloudflare-auth` middleware (`developerAuthentication` + `cloudflareAccess`) wired
  into Hono with a shared `PathPolicy[]`
- D1 `users` table; first-login upsert; `SEED_ADMIN_EMAIL` admin promotion
- D1 `admin_audit` table; audit entries written on every admin mutation
- Admin route group: user list (paginated, sortable, searchable), promote/demote/delete actions
- Cannot-promote/demote/delete-self guard
- CSRF middleware (Origin check + double-submit cookie)
- Real rate-limit implementation replacing the Phase 01 stub (D1 or KV sliding window)
- Session-expiry banner (30 min before JWT `exp`; client-side)
- `GET /api/me` user profile endpoint
- User profile widget (avatar, email) in app shell
- `D1 user_preferences` table and `GET/PUT /api/me/preferences` (theme, palette state)
- Per-PR preview environment: `scripts/preview-env.ts` + GitHub Actions jobs

### Out of Scope

- Diagram ownership (Phase 05)
- User diagram/share counts in admin list (Phase 05 completes these columns)
- OAuth avatar URL enrichment (future; `avatar_url` defaults to null)

## Pre-requisites

- Phase 01 complete and deployed
- Cloudflare Access application configured and associated with the deployment domain
- `CLOUDFLARE_TEAM_DOMAIN` set in `.env`
- `SEED_ADMIN_EMAIL` set in `.env`

## Tasks

### Database

- [ ] **Migration 0001** — Create `users` and `admin_audit` tables (see Schema Changes)
- [ ] **Migration 0002** — Create `user_preferences` table (see Schema Changes)
- [ ] Add Drizzle schema definitions in `apps/worker/src/db/schema.ts` for both tables
- [ ] Add query helpers: `upsertUser(sub, email, name, avatarUrl)`, `getUserById(id)`,
  `setUserRole(actorId, targetId, role)`, `deleteUser(actorId, targetId)`,
  `insertAuditEntry(actorId, action, targetId, payload)`,
  `listUsers(page, limit, sort, order, q)`, `getUserPreferences(userId)`, `setUserPreferences(userId, prefs)`

### Authentication middleware

- [ ] Install `@adrianhall/cloudflare-auth` (pinned SHA) in `apps/worker/package.json`
- [ ] Define `AUTH_POLICIES: PathPolicy[]` in `apps/worker/src/middleware/auth.ts`:
  public: `/api/health`, `/api/version`, `/share/.*`; protected: all other `/api/.*`
- [ ] Mount `developerAuthentication({ policies: AUTH_POLICIES })` as the first middleware in `index.ts`
- [ ] Mount `cloudflareAccess({ policies: AUTH_POLICIES, teamDomain: env.CLOUDFLARE_TEAM_DOMAIN })` as the second middleware
- [ ] Add wrangler ASSETS config entry for `/_auth/*` in `run_worker_first` (already in template from Phase 01; verify)
- [ ] First-login hook: after `cloudflareAccess`, call `upsertUser` with `c.get("userSub")` and `c.get("userEmail")`; promote to admin if email matches `env.SEED_ADMIN_EMAIL`; attach `userId` and `userRole` to Hono context

### CSRF middleware

- [ ] `apps/worker/src/middleware/csrf.ts`: check `Origin` header matches deployment origin for mutating methods; if absent, check `X-CSRF-Token` header against double-submit cookie value; return 403 `FORBIDDEN` on failure; skip for public paths and `GET/HEAD/OPTIONS`
- [ ] Set `CF_CSRF` cookie (HttpOnly=false, SameSite=Strict, Secure, 24 h) on all responses so the client can read it
- [ ] Mount CSRF middleware after auth middleware in `index.ts`

### Rate limits

- [ ] Replace Phase 01 stub with real KV-backed sliding-window rate limiter in `apps/worker/src/middleware/rate-limit.ts`
- [ ] Apply per-endpoint limits: `POST /api/shares` 10/min per user; `POST|PATCH|DELETE /api/admin/*` 20/min per user; autosave limit stubbed (Phase 05 wires it)

### API routes

- [ ] `GET /api/me` — return `{ id, email, name, avatarUrl, role }`; 401 if unauthenticated
- [ ] `GET /api/admin/users` — require `role = admin`; query params: `page`, `limit`, `sort` (name|email|role|joined_at), `order` (asc|desc), `q`; return paginated list; diagram/share counts as 0 (real counts wired in Phase 05)
- [ ] `PATCH /api/admin/users/:id/role` — require admin; validate body `{ role: "admin" | "user" }`; reject self-target with 403; write audit entry; return updated user
- [ ] `DELETE /api/admin/users/:id` — require admin; reject self-target with 403; write audit entry; return 204
- [ ] `GET /api/admin/audit` — require admin; paginated list of `admin_audit` rows sorted by `at DESC`
- [ ] `GET /api/me/preferences` — return user preferences; create defaults if missing
- [ ] `PUT /api/me/preferences` — update theme, palette state, ai_panel_enabled

### Client — admin UI

- [ ] `apps/web/src/routes/admin/index.tsx` (TanStack Router) — users list with DataTable; columns: name, email, role badge, joined date, diagram count (shows 0), share count (shows 0), actions
- [ ] Sort and search controls on admin user list
- [ ] Pagination controls
- [ ] Promote/demote action (dropdown per row); confirmation for demote; disabled on own row
- [ ] Delete action; confirmation modal showing user email; disabled on own row
- [ ] Audit log tab at `/admin/audit`; paginated list of audit entries
- [ ] `apps/web/src/routes/admin/_layout.tsx` — admin gate: redirects non-admin users to `/`

### Client — auth flow and profile

- [ ] `apps/web/src/features/f02-auth/useCurrentUser.ts` — TanStack Query hook for `GET /api/me`; used in app shell
- [ ] Profile widget `ProfileWidget.tsx` — avatar (initials fallback), email, role badge; in top-right of app shell; shown on all protected pages
- [ ] Session-expiry banner `SessionExpiryBanner.tsx` — reads JWT `exp` from `CF_Authorization` cookie (accessible since `HttpOnly=false`); shows banner with "Re-authenticate" link 30 min before expiry; dismissible
- [ ] Route guard: unauthenticated requests to protected TanStack Router routes redirect to `/_auth/login`

### Preview environments

- [ ] `scripts/preview-env.ts` — sub-commands: `create <pr-number>` (terraform workspace new + apply) and `destroy <pr-number>` (workspace select + destroy); reads `.env` for credentials
- [ ] `.github/workflows/preview.yml` — on `pull_request` opened/reopened: run `preview-env create ${{ github.event.number }}`; on `pull_request` closed: run `preview-env destroy ${{ github.event.number }}`; output preview URL as PR comment
- [ ] Update `infra/variables.tf` to accept `environment` override per workspace

## Schema Changes

**Migration 0001:**

```sql
CREATE TABLE users (
  id          TEXT    PRIMARY KEY,          -- Cloudflare Access sub claim
  email       TEXT    NOT NULL UNIQUE,
  name        TEXT,
  avatar_url  TEXT,
  role        TEXT    NOT NULL DEFAULT 'user'
              CHECK (role IN ('user', 'admin')),
  created_at  INTEGER NOT NULL,             -- Unix ms
  last_login_at INTEGER NOT NULL
);

CREATE TABLE admin_audit (
  id          TEXT    PRIMARY KEY,
  actor_id    TEXT    NOT NULL REFERENCES users(id),
  action      TEXT    NOT NULL              -- 'promote' | 'demote' | 'delete'
              CHECK (action IN ('promote', 'demote', 'delete')),
  target_id   TEXT    NOT NULL,
  payload_json TEXT,
  at          INTEGER NOT NULL              -- Unix ms
);
```

**Migration 0002:**

```sql
CREATE TABLE user_preferences (
  user_id           TEXT    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme             TEXT    NOT NULL DEFAULT 'system'
                    CHECK (theme IN ('system', 'light', 'dark', 'high-contrast')),
  palette_state_json TEXT,                  -- JSON: collapsed category IDs
  ai_panel_enabled  INTEGER NOT NULL DEFAULT 1,
  updated_at        INTEGER NOT NULL
);
```

## API Additions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/me` | Required | Current user profile |
| `GET` | `/api/me/preferences` | Required | User preferences |
| `PUT` | `/api/me/preferences` | Required | Update user preferences |
| `GET` | `/api/admin/users` | Admin | Paginated user list |
| `PATCH` | `/api/admin/users/:id/role` | Admin | Promote or demote user |
| `DELETE` | `/api/admin/users/:id` | Admin | Delete user |
| `GET` | `/api/admin/audit` | Admin | Paginated audit log |

## Test Plan

### Unit (Vitest)

- [ ] CSRF middleware — passes valid `Origin`; rejects mismatched `Origin`; passes valid double-submit token; rejects missing token on mutating method; passes public paths without any header
- [ ] Rate-limit middleware — allows requests under the window; returns 429 on exceed; window resets after expiry
- [ ] First-login hook — inserts user on first call; updates `last_login_at` on subsequent call; promotes to admin when email matches `SEED_ADMIN_EMAIL`; does not demote existing admin on re-login
- [ ] Cannot-self-mutate guard — returns 403 with `FORBIDDEN` code when `targetId === actorId`
- [ ] `upsertUser` query helper — idempotent; correct field mapping

### Worker integration (Vitest + pool-workers)

- [ ] `GET /api/me` with valid JWT → 200 with user profile
- [ ] `GET /api/me` without JWT → 401
- [ ] `GET /api/admin/users` as admin → 200 paginated list
- [ ] `GET /api/admin/users` as non-admin → 403
- [ ] `PATCH /api/admin/users/:id/role` writes `admin_audit` row
- [ ] `DELETE /api/admin/users/:id` removes user; returns 204
- [ ] `PATCH /api/admin/users/:self/role` → 403 (self-target)

### E2E (Playwright)

- [ ] Dev mode: navigate to protected route → redirected to `/_auth/login` → enter email → land on protected route with profile widget showing email
- [ ] Admin user list renders with correct columns; sort by email changes order
- [ ] Promote user: select non-admin → promote → role badge changes to "admin"
- [ ] Cannot delete own account: delete button is disabled on the current user's row

### Accessibility `@a11y`

- [ ] Admin user list page: zero serious/critical axe violations
- [ ] Delete confirmation modal: focus trapped inside; ESC dismisses; confirm button is focused by default

## Manual Tests

- [ ] **Dev login flow** — `npm start`. Open `http://localhost:8787`. Confirm redirect to `/_auth/login`.
  Enter any email address. Confirm redirect back to the app with the profile widget showing that email.
- [ ] **Protected route 401** — `curl -s http://localhost:8787/api/me` with no cookie or header.
  Confirm HTTP 401 and `{ ok: false, error: { code: "UNAUTHENTICATED" } }`.
- [ ] **Seed admin promotion** — Set `SEED_ADMIN_EMAIL=your@email.com` in `.dev.vars`. Log in with that
  email via the dev login flow. Confirm `curl http://localhost:8787/api/me` returns `role: "admin"`.
  Log in with a different email. Confirm `role: "user"`.
- [ ] **Admin panel access** — Logged in as admin, navigate to `/admin`. Confirm the user list renders.
  Log out, log in as a non-admin user, navigate to `/admin`. Confirm redirect to `/`.
- [ ] **User list sort and search** — In the admin panel, click the "Email" column header. Confirm the
  list re-sorts. Type a partial email in the search box. Confirm the list filters correctly.
- [ ] **Promote/demote** — As admin, promote a non-admin user to admin. Confirm their role badge
  changes. Demote them back. Confirm the change. Verify both actions appear in the audit log.
- [ ] **Cannot delete self** — As admin, try to delete your own row. Confirm the delete button is
  disabled or produces a 403 error.
- [ ] **Audit log** — Navigate to the audit log tab. Confirm the promote and demote actions from the
  previous test appear with correct actor, target, action, and timestamp.
- [ ] **CSRF rejection** — Using curl, send a mutating request without `Origin` or `X-CSRF-Token`:
  `curl -X DELETE http://localhost:8787/api/admin/users/some-id`. Confirm HTTP 403.
- [ ] **Session expiry banner** — Manually craft a dev JWT with `exp = now + 20 minutes` using the
  dev secret. Set it as the `CF_Authorization` cookie in the browser. Reload the app. Confirm the
  session-expiry banner appears with a re-authenticate link.
- [ ] **Rate limit** — Send 25 rapid-fire requests to `POST /api/shares` (stub endpoint is ok; use
  any POST /api/admin route). Confirm the 21st+ request returns HTTP 429.
- [ ] **Preview environment** — Open a draft PR. Confirm the `preview.yml` GitHub Actions job runs.
  Confirm a new isolated D1 database and KV namespace appear in the Cloudflare dashboard for that PR.
  Close the PR. Confirm the resources are destroyed.

## Acceptance Criteria

| Story | How we verify |
|---|---|
| **F2-US1** — Protected routes require Access auth; 401 for unauthenticated | Manual 401 test above |
| **F2-US2** — First admin via `SEED_ADMIN_EMAIL` | Seed admin promotion manual test |
| **F2-US3** — Paginated, sortable, searchable user list at `/admin` | Admin panel manual tests |
| **F2-US4** — Promote/demote/delete; cannot target self | Cannot-delete-self manual test |
| **F2-US5** — User list shows diagram count and share count | Columns visible (values are 0; counts wired in Phase 05) |
| **F2-US6** — Profile widget shows name, email, avatar | Profile widget shown in dev login E2E test |
| **F2-US7** — DEV_MODE bypass; production fails closed without `CLOUDFLARE_TEAM_DOMAIN` | Dev login manual test; verify 401 in local without `DEV_MODE` |
| **F2-US8** — CSRF on all mutating endpoints | CSRF rejection manual test |
| **F2-US9** — Audit log records actor, target, action, timestamp | Audit log manual test |
| **F1-US2** — Preview deploys per PR with isolated data, cleaned up on PR close | Preview environment manual test |

## Rollout / Rollback

**Rollout:** Run `npm run migrate` (applies 0001 and 0002), then `npm run deploy`. Set
`CLOUDFLARE_TEAM_DOMAIN`, `SEED_ADMIN_EMAIL` as Worker secrets via `wrangler secret put`.

**Rollback:** Redeploy previous Worker version (which has no auth middleware). If migrations must
be reverted: `DROP TABLE user_preferences; DROP TABLE admin_audit; DROP TABLE users;` via
`wrangler d1 execute`. No diagram data at risk (not created until Phase 05).

## Open Questions

- [ ] Should `avatar_url` be populated from CF Access JWT claims if available, or always left null until
  a profile-edit UI exists? Recommendation: null for now; enrich in Phase 05 when preferences are wired.
- [ ] Preview environment isolation: should the preview D1 database be seeded with the `SEED_ADMIN_EMAIL`
  user, or left completely empty? Recommendation: empty — each preview is independent.
