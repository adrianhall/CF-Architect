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

---

## 2026-05-22 — Phase 01 follow-up: CI supply-chain gates

### D08 — OSV-Scanner removed from CI gate

**Status:** Accepted; re-evaluation deferred to Phase 12
**Phase:** 01 (follow-up)

**Decision:** Remove the `OSV Scanner` step from `.github/workflows/ci.yml`. Rely on
`npm audit --audit-level=high` and `npm audit signatures` as the sole CVE and integrity
gates until Phase 12 re-evaluates whether OSV-Scanner adds enough marginal value to
justify reinstatement.

**Context:** The step at `ci.yml:77-82` used `google/osv-scanner-action@v2`, but no
such tag exists on `google/osv-scanner-action` — the repo publishes only semver tags
(latest: `v2.3.8`). The root `action.yml` in that repository is metadata-only (name,
description, branding) with no `runs:` block; the action is designed to be consumed as
a reusable workflow at the job level (with `security-events: write` permission), not as
a step inside another job. As a result the scanner has never actually executed in CI;
every CI run failed at action resolution before any scan occurred.

**Alternatives considered:**

- _Fix via reusable workflow_: Add a parallel `osv-scan` job invoking
  `google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@v2.3.8`.
  Officially supported, uploads SARIF to GitHub Security → Code scanning, but requires
  granting `security-events: write` to the workflow and adds a parallel job.
- _Fix via CLI step_: Curl-install the `osv-scanner` binary pinned to a release and run
  `osv-scanner --recursive .`. Simpler, no permission changes, but loses SARIF integration
  and pins to an installer URL.
- _Remove entirely (chosen)_: Drop the Layer 4 second-opinion scanner for now. `npm audit`
  continues to cover the GitHub Advisory Database; `npm audit signatures` continues to
  verify sigstore integrity. Accepts the residual risk that an OSV-only CVE may slip
  through until Phase 12.

**Rationale:** The scanner has been a no-op since Phase 01 due to the broken action
reference, so removing it does not reduce real-world coverage — it only corrects the CI
configuration to match reality. Phase 12 is the appropriate place to decide whether to
reinstate OSV-Scanner with the correct reusable-workflow integration, keep it removed,
or substitute a different second-opinion scanner.

**Follow-ups:**

- Phase 12 task added: decide whether to reinstate OSV-Scanner as a CI gate.
- Phase 01 `Deviations from original spec` table updated to reference D08.
- `docs/SUPPLY_CHAIN_SECURITY.md` created as the authoritative supply-chain reference;
  the OSV-Scanner deferral is documented there under "Phase 12 deferred tasks".
- `docs/PLAN.md` §9 Layer 4 and `README.md` supply-chain section updated to link to
  the new doc.

---

## 2026-05-22 — Phase 03: Cloudflare Service Catalog

### D09 — Catalog schemas: Zod v3 instead of v4

**Status:** Accepted
**Phase:** 03

**Decision:** Author all catalog Zod schemas in **Zod v3** (`^3.25.x`), consistent with every
other schema in `packages/shared`.

**Context:** The phase-03.md spec says "Zod v4 schemas", but AGENTS.md §5 is explicit:
"The project uses Zod v3 … do not upgrade to v4 until all phases are complete and a migration
is explicitly planned." Upgrading only the catalog module while keeping the rest of shared on v3
is not viable (single `zod` dependency in `packages/shared/package.json`).

**Alternatives considered:**

- _Upgrade all of `packages/shared` to Zod v4 now_: Breaking change; `@hono/zod-validator@^0.7.6`
  supports both v3 and v4 but the rest of the codebase uses v3 API syntax throughout.
- _Use Zod v3 (chosen)_: Zero migration risk; consistent with entire existing codebase.

**Rationale:** AGENTS.md mandate takes precedence over the phase spec. The catalog schemas are
functionally identical between v3 and v4 for the types used here.

---

### D10 — Icon source: local sibling cloudflare-docs repo

**Status:** Accepted
**Phase:** 03

**Decision:** Copy SVG icons from the local sibling repository at
`../cloudflare-docs/src/icons/` into `apps/web/src/icons/src/`. Document the source and
licence in `apps/web/src/icons/ICONS.md`.

**Context:** Phase-03.md open question #1 asks whether the Cloudflare brand asset repository is
publicly accessible. The cloudflare-docs repository at `../cloudflare-docs/src/icons/` contains
123 production SVG icons and licence has been confirmed pre-cleared for this use.

**Alternatives considered:**

- _Wait for official brand assets_: Blocks Phase 03 and Phase 04.
- _Derive icons from developers.cloudflare.com_: Same source, higher per-icon effort.

**Rationale:** Unblocks Phase 03 immediately. The ICONS.md file documents the origin for
auditability.

---

### D11 — otherLinks: deferred to Phase 12

**Status:** Accepted
**Phase:** 03

**Decision:** `otherLinks` is an empty array (`[]`) for every service in Phase 03. The schema
and the type are defined now; population is deferred. A follow-on task is added to
`docs/plan/phase-12.md`.

**Context:** Phase-03.md recommended seeding `otherLinks` for 6 well-known products. After
discussion, the preference is to seed only `docLink` universally and keep `otherLinks`
schema-complete but empty until Phase 12.

**Rationale:** Avoids partial data (`6/37` services with links vs. the rest empty) and keeps
the Phase 03 service data consistent. Doc links provide the majority of UX value.

---

### D12 — Icon sprite: generated once and committed

**Status:** Accepted
**Phase:** 03

**Decision:** `scripts/build-icon-sprite.ts` generates `apps/web/public/icons/sprite.svg` and
that file is **committed to git**. It is not re-generated on every `build:web` invocation.
Re-run the script manually when icons change.

**Context:** Phase-03.md specified the script "run as part of `build:web`". However:

1. Regenerating the sprite on every CI build requires the `cloudflare-docs` sibling repo to be
   present at the correct relative path — which is not available in CI.
2. The sprite content is deterministic from the committed source SVGs in `apps/web/src/icons/src/`.
3. Committing the sprite means CI always has a valid asset without needing to run the generator.

**Alternatives considered:**

- _Run as part of `build:web`_: Requires sibling repo in CI; adds complexity.
- _Inline SVGs in React via Vite raw import_: More bundle overhead; harder to cache.

**Rationale:** Committed artefact is simpler, auditable, and CI-friendly. The ICONS.md documents
how to regenerate it when source icons change.

---

### D13 — Generic non-Cloudflare resources in catalog

**Status:** Accepted
**Phase:** 03

**Decision:** Add a `generic` category (grey `#6B7280`) with 8 common architecture diagram
primitives: user, agent, external-api, internet, mobile, browser, server, database. These use
custom-authored SVG icons stored alongside the CF icons in `apps/web/src/icons/src/`.

**Context:** Architecture diagrams always include non-Cloudflare actors (users, origin servers,
third-party APIs, the internet). Without these primitives, Phase 04 diagrams cannot represent
realistic architectures.

**Rationale:** Adding them now (Phase 03) means Phase 04 canvas work can immediately draw
real-looking diagrams. The custom icons are simple monochrome SVG paths matching the CF icon
visual style.
