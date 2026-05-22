# Decision Log

Architectural and implementation decisions made during CF-Architect v2.
Each entry lists the date, phase, context, alternatives considered, and the chosen option with
rationale. The log is append-only; superseded decisions are annotated rather than deleted.

---

## 2026-05-22 — Phase 02: Identity, Access & Multi-User

### D01 — Session-expiry banner: `exp` source

**Status:** Accepted
**Phase:** 02

**Decision:** `GET /api/me` returns an `exp` field (Unix seconds). The session-expiry banner reads
`exp` from the query response via `useCurrentUser()` and uses `setInterval` to check elapsed time.
The `CF_Authorization` cookie remains `HttpOnly` throughout.

**Context:** Phase 02 originally specified reading `exp` from the `CF_Authorization` cookie, which
would require `HttpOnly=false`. However `infra/access.tf` sets `http_only_cookie_attribute = true`
and the `@adrianhall/cloudflare-auth` library hard-codes `HttpOnly` in dev JWTs
(`jwt.ts:168`). Weakening cookie security for a non-critical UX feature is unjustified.

**Alternatives considered:**

- _Drop `HttpOnly` on `CF_Authorization`_: Silently accepts XSS risk on the primary auth cookie.
- _Server-Sent Events push_: Heavier infrastructure for a 30-minute-advance UX hint.

**Rationale:** Secure by default. `GET /api/me` is called on every protected page load anyway;
adding `exp` to the response body costs no extra round-trip.

---

### D02 — Rate-limit implementation: native Workers binding

**Status:** Accepted
**Phase:** 02

**Decision:** Use the native Cloudflare Workers `ratelimit` binding (GA September 2025) instead of
a KV-backed sliding-window counter.

**Context:** Workers KV has a hard limit of 1 write/second per key. A per-user sliding window at
the autosave rate (30 req/min per user) would collide with this limit under normal usage. The
native binding uses in-isolate counters with async background flush — zero latency impact, no KV
write cost, no per-key write limit.

**Tradeoffs:** The native binding enforces limits per Cloudflare location, not globally per user.
For the v2 use case (authenticated internal team on a single deployment) this is an acceptable
trade-off. A globally-accurate counter (via Durable Objects) would add infrastructure and cost
overhead disproportionate to the risk.

**Wrangler config:** Three `ratelimits` entries added to `wrangler.template.jsonc` and
`wrangler.test.jsonc`:

| Binding       | Limit  | Period | Endpoint                                    |
| ------------- | ------ | ------ | ------------------------------------------- |
| `RL_SHARES`   | 10 req | 60 s   | `POST /api/shares`                          |
| `RL_ADMIN`    | 20 req | 60 s   | `POST\|PATCH\|DELETE /api/admin/*`          |
| `RL_AUTOSAVE` | 30 req | 60 s   | `PUT /api/diagrams/:id` (wired in Phase 05) |

**Alternatives considered:**

- _KV sliding window_: Per-user-globally accurate but breaks at autosave rates.
- _Durable Object counter_: Globally accurate but adds binding, infra cost, and complexity. Overkill for v2.

---

### D03 — Per-PR preview environments: deferred

**Status:** Deferred — removed from Phase 02 scope
**Phase:** 02 (originally in scope per F1-US2)

**Decision:** Remove per-PR preview environment provisioning (`scripts/preview-env.ts`,
`.github/workflows/preview.yml`, Terraform workspace-per-PR) from Phase 02 entirely.
F1-US2 is tracked as deferred in the acceptance-criteria table.

**Context:** The Terraform-workspace-per-PR approach requires ~minutes per PR to provision
(D1 + KV + R2 + Access app + Worker), consumes Access app quota, and creates Terraform state
management complexity. Simpler alternatives exist but add scope to an already large phase.

**Future path:** Revisit in a later phase using `wrangler deploy --env preview-pr-<n>` (no Terraform
per PR; reuse existing infrastructure with environment-namespaced resource IDs).

---

### D04 — Admin DataTable: TanStack Table v8

**Status:** Accepted
**Phase:** 02

**Decision:** Use `@tanstack/react-table` v8 (headless) for the admin user list.

**Rationale:** Consistent with the existing TanStack ecosystem (Router, Query) already in the
project. Type-safe, zero-style-opinion, small bundle. No new ecosystem introduced.

---

### D05 — Seed admin re-promotion behaviour

**Status:** Accepted
**Phase:** 02

**Decision:** `upsertUser` only promotes `role` to `'admin'` when the user row is first **inserted**
(i.e. the user has never logged in before). Subsequent logins update `last_login_at` only and
never overwrite `role`.

**Rationale:** `SEED_ADMIN_EMAIL` is a one-time bootstrap lever, not a continuous override. If the
env var is left set after initial seeding, it must not silently re-elevate a user whose role was
deliberately changed through the admin UI. Operators who need to recover from accidental
self-demotion should delete the user row and re-log in.

---

### D06 — `DEV_MODE` variable: removed

**Status:** Accepted
**Phase:** 02

**Decision:** Remove `DEV_MODE` from `.dev.vars.example`, `README.md`, `PLAN.md`, and all other
documentation. Do not read or check it anywhere in the Worker codebase.

**Context:** `DEV_MODE` was documented in `.dev.vars.example` as a flag to "enable the interactive
dev-mode login bypass provided by `@adrianhall/cloudflare-auth`". However, the library never
actually checks for this variable. Its behaviour is:

1. If `Cf-Access-Jwt-Assertion` header is present on the incoming request → no-op (real CF Access
   is handling auth). This is the production path.
2. Otherwise → serve the interactive email-login form at `/_auth/login` and issue a dev JWT. This
   is the local-development path — it activates automatically without any configuration.

Confirmed by reading `developer-authentication.ts:72` (checks for JWT header, not any env var)
and `cloudflare-access.ts:154–166` (tries HMAC verification first; only reads
`CLOUDFLARE_TEAM_DOMAIN` from env if HMAC verification fails — which it never does for dev JWTs).

**Impact on local development:**

- `.dev.vars` can be empty (or contain only `SEED_ADMIN_EMAIL` if testing admin promotion).
- `CLOUDFLARE_TEAM_DOMAIN` is **not** required locally; dev JWTs are verified via HMAC.
- `CLOUDFLARE_TEAM_DOMAIN` **is** required in production (set via `wrangler secret put` or
  injected by Terraform into `wrangler.jsonc`).

**Impact on tests:**

- Use `signDevJwt(email)` from `@adrianhall/cloudflare-auth` to mint tokens for integration
  tests. No magic env var needed.

---

### D07 — CSRF double-submit cookie: primed on `GET /api/me`

**Status:** Accepted
**Phase:** 02

**Decision:** The `CF_CSRF` double-submit cookie is set on **every response** (if not already
present), including `GET /api/me`. This ensures the SPA always has a valid token before making
its first mutating request.

**Rationale:** Without this, a user who just logged in would have no `CF_CSRF` cookie when
attempting their first POST. Setting it on every response (not just auth responses) is safe —
the cookie is not secret, just random; it is `SameSite=Strict` so it cannot be set by a
cross-origin attacker.
