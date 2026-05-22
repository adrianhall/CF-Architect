---
phase: "12"
title: "Security Hardening & Production Readiness"
feature: "SEC"
status: "Planned"
depends_on: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"]
---

# Phase 12 — Security Hardening & Production Readiness

## Goal

A full-scope security review of the completed codebase and infrastructure before
public launch. This phase re-instates supply-chain controls that were deliberately
suspended during active development (Phases 01–11), hardens the runtime, and
systematically works through the OWASP Top 10. No new product features are added
here; the goal is to make what exists safe to run in production under adversarial
conditions.

## Scope

### In Scope

- Re-institute `ignore-scripts=true` in `.npmrc` with a fully audited postinstall
  allowlist
- Full dependency audit: necessity, version freshness, license compliance, CVEs
- OWASP Top 10 checklist applied to every layer of the stack
- Full Content Security Policy and security response headers
- Complete rate-limiting implementation (replaces the stub from Phase 01)
- Input validation audit across all API endpoints
- Authentication and authorisation hardening review
- Secrets and environment variable hygiene audit
- Error-handling audit (no stack traces or internal paths in production responses)
- Code review focused on security vulnerabilities
- Supply-chain CI gate restoration
- `SECURITY.md` vulnerability disclosure policy

### Out of Scope

- New product features
- Performance optimisation
- Multi-region / HA deployment architecture

## Pre-requisites

- All Phases 01–11 complete and deployed to production
- Clean `npm audit --audit-level=high` baseline
- OSV-Scanner passing in CI

## Tasks

### Supply-chain hardening re-institution

- [ ] Restore `ignore-scripts=true` in `.npmrc`
- [ ] Audit `scripts/postinstall.mjs` allowlist:
  - Review every package added to the allowlist during Phases 01–11
  - Document the justification for each entry in a comment next to the entry
  - Remove any entries that are no longer necessary
- [ ] Verify `prepare` (Husky) still runs correctly with `ignore-scripts=true`;
      Husky v9 detects `CI=true` and is a no-op in CI, so no special workaround
      should be needed — confirm and document
- [ ] Update CI workflows: restore the explicit `npm run postinstall` step after
      `npm ci` in both `ci.yml` and `deploy.yml`
- [ ] Update README quickstart to document the manual `npm run postinstall` step
      and explain why it is necessary
- [ ] Update `docs/PLAN.md` §9 to mark Layer 1 as fully active
- [ ] Verify `lockfile-lint` still passes after any dependency changes made during
      this phase

### Dependency audit

- [ ] Run `npm audit --audit-level=moderate` (stricter than the development
      threshold of `--audit-level=high`) and remediate all findings
- [ ] Review every direct dependency in `package.json`, `apps/web/package.json`,
      `apps/worker/package.json`, and `packages/shared/package.json`:
  - Is it still used?
  - Is it on the latest stable version?
  - Does it have a healthy maintenance record?
  - Does it carry an acceptable license (MIT, Apache-2.0, BSD-2-Clause,
    BSD-3-Clause, ISC, 0BSD)?
- [ ] Remove all unused dependencies
- [ ] Verify `@adrianhall/cloudflare-auth` SHA is pinned to a current, reviewed
      commit; update if a newer reviewed commit exists
- [ ] Run `npm audit signatures` — all packages must have valid sigstore signatures
- [ ] Run OSV-Scanner and confirm zero findings
- [ ] Generate SBOM: `npm sbom --sbom-format spdx` and store as a release artefact
- [ ] Confirm `lockfile-lint` passes: every `resolved` URL is
      `https://registry.npmjs.org/`

### OWASP Top 10 review

- [ ] **A01 — Broken Access Control**: verify every API route that handles user
      data enforces ownership checks (diagram owner, share creator). Verify
      admin routes reject non-admin JWTs. Write a test for at least one IDOR
      attempt (attempt to read another user's diagram).
- [ ] **A02 — Cryptographic Failures**: confirm no sensitive data (tokens, secrets,
      PII) is written to Worker structured logs. Confirm `.dev.vars` and `.env` are
      gitignored and not leaked in any CI artefact. Confirm all D1 data at rest is
      encrypted (Cloudflare provides this by default; document it).
- [ ] **A03 — Injection**: verify all D1 queries use Drizzle ORM parameterised
      statements; grep for any raw SQL string concatenation and eliminate it.
      Confirm Zod schemas are applied at every API boundary before data touches
      the database.
- [ ] **A04 — Insecure Design**: produce a one-page threat model covering the
      highest-risk flows (share link access, admin actions, diagram persistence).
      Document mitigations for each identified threat.
- [ ] **A05 — Security Misconfiguration**: review all Cloudflare Access policies;
      confirm the application audience (`aud`) claim is validated correctly; confirm
      `DEV_MODE` is impossible to enable outside of `.dev.vars`; review all
      `ENVIRONMENT` variable references to confirm they fail closed in production.
- [ ] **A06 — Vulnerable and Outdated Components**: covered by dependency audit
      above; add CI gate that blocks merges on `npm audit --audit-level=high`
      failure (already present — confirm it is not disabled).
- [ ] **A07 — Identification and Authentication Failures**: review every
      authenticated endpoint to confirm the JWT validation path has no bypass; test
      with expired, malformed, and correctly signed tokens from a different `aud`;
      confirm the Cloudflare Access team domain check is enforced.
- [ ] **A08 — Software and Data Integrity Failures**: covered by supply-chain
      re-hardening above; additionally verify that Worker code is only deployed
      from CI (never from a developer machine directly in the `main` branch
      workflow).
- [ ] **A09 — Security Logging and Monitoring Failures**: confirm that
      authentication failures, authorisation denials, and rate-limit hits are
      written to the structured log with enough context to investigate; confirm
      observability is enabled in `wrangler.jsonc`; confirm log sampling rate is
      appropriate for production volume.
- [ ] **A10 — Server-Side Request Forgery**: grep for any use of `fetch()` with a
      URL derived from user input; if any exists, add an allowlist of permitted
      domains and reject all others.

### Security response headers

- [ ] Add a `securityHeaders` middleware to the Hono Worker that applies on every
      response:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
- [ ] Implement a production-ready Content Security Policy:
  - `default-src 'self'`
  - `script-src 'self'` — no `'unsafe-inline'`, no `'unsafe-eval'`
  - `style-src 'self' 'unsafe-inline'` — justify or remove `'unsafe-inline'`
    (CSS-in-JS may require it; document the decision)
  - `connect-src 'self'` plus AI Gateway endpoint (Phase 11, if deployed)
  - `img-src 'self' data:` — `data:` required for canvas PNG export
  - `font-src 'self'`
  - `frame-ancestors 'none'`
- [ ] Verify no CDN-loaded resources appear in the Vite bundle (no external
      `<script src>` or `<link href>`)
- [ ] Run `securityheaders.com` scan against the production URL and target an A
      grade or above
- [ ] Add header-presence assertions to the Playwright smoke tests

### Rate limiting (full implementation)

Rate limiting was stubbed in Phase 01 (the middleware reads a bypass header and
returns 429 only in tests). This task replaces the stub with a real implementation.

- [ ] Decide implementation strategy: Cloudflare Rate Limiting product vs.
      KV-backed sliding-window counter (document the decision in this file)
- [ ] Apply rate limits to the following endpoints (values are starting points —
      tune after load testing):
  - `POST /api/shares` — 10 requests / minute / IP
  - `GET /api/shares/:token` — 60 requests / minute / IP
  - `PUT /api/diagrams/:id` (autosave) — 30 requests / minute / user
  - All admin endpoints — 20 requests / minute / user
- [ ] Return `Retry-After` and `X-RateLimit-*` headers on 429 responses
- [ ] Add rate-limit metrics to the structured log (log the bucket key and current
      count on every rate-limit hit)
- [ ] Write integration tests confirming 429 is returned after the limit is
      exceeded and 200 is returned after the window resets

### Input validation audit

- [ ] For every `POST`, `PUT`, and `PATCH` route, confirm the request body is
      parsed through a Zod schema before any database write
- [ ] Confirm all string fields have a maximum length constraint in their Zod
      schema
- [ ] Confirm all ID fields are validated as the expected format (UUID, slug, etc.)
      before use in a database query
- [ ] Confirm malformed JSON bodies return `400` with the error envelope (not `500`)
- [ ] Confirm unexpected fields are stripped by Zod (`.strict()` or `.strip()`)

### Error handling audit

- [ ] Confirm the global 500 handler returns only the error envelope with a generic
      message — no stack traces, no file paths, no internal error messages
- [ ] Confirm Worker logs capture the full error (including stack) for internal
      debugging, but the client response does not
- [ ] Test with an intentionally thrown error in a route and verify both the log
      content and the response body

### Authentication hardening

- [ ] Re-read the `@adrianhall/cloudflare-auth` implementation at the pinned SHA;
      document any concerns or assumptions
- [ ] Verify the `aud` claim validation: the value must come from an environment
      variable (`CLOUDFLARE_ACCESS_AUD`), never be hardcoded, and the middleware
      must reject tokens whose `aud` does not match
- [ ] Write a test using a token signed with a valid key but a wrong `aud` value —
      confirm it is rejected
- [ ] Verify the Cloudflare team domain check: confirm requests that do not come
      through Cloudflare Access are rejected in production (not just missing a
      header, but actually rejected by the middleware)
- [ ] Confirm `DEV_MODE=true` cannot be set via an environment variable in
      `wrangler.jsonc` or the Cloudflare dashboard (it must only be settable via
      `.dev.vars`)
- [ ] Audit admin role assignment: confirm the only way to make a user an admin is
      through a database migration or a deliberate admin panel action by an existing
      admin; no API endpoint allows self-promotion

### Secrets management audit

- [ ] Verify no secret or token is committed to the repository (run `git log
--all --full-history -- '*.env' '*.dev.vars'` to confirm no historical leaks)
- [ ] Verify `.env` and `.dev.vars` are in `.gitignore` and not present in any
      CI artefact
- [ ] Confirm the deploy-scoped Cloudflare API token stored as a GitHub secret has
      only `Workers Scripts:Edit` scope — not provisioning-level permissions
- [ ] Document secret rotation procedure in `SECURITY.md`

### Code review

- [ ] Security-focused manual review of:
  - All Hono middleware (auth, rate limit, logging, CSRF if added)
  - All Worker route handlers
  - All Drizzle query helpers (`apps/worker/src/db/queries/`)
  - Share token generation and validation
  - Admin panel actions and role checks
- [ ] Cross-check all routes against the Zod envelope schemas in `packages/shared`
      — confirm every response matches the declared schema
- [ ] IDOR review: for every route that accepts a user-supplied ID (diagram ID,
      share token, user ID), confirm the query includes an ownership check (`AND
owner_id = $userId`)

### Documentation

- [ ] Write `SECURITY.md` at the repo root:
  - Supported versions (which deployed versions receive security patches)
  - Responsible disclosure policy (suggested: 90-day coordinated disclosure window)
  - Contact method (security@ email or GitHub private advisory)
  - Acknowledgements section
- [ ] Update `README.md` Supply-chain section to mark Layer 1 as fully active
- [ ] Update `docs/PLAN.md` §9 to mark all eight layers as active

## Test Plan

### Supply-chain gate (restored)

- [ ] `npm ci` with `ignore-scripts=true` in place; confirm only allowlisted
      packages run build steps (terminal output shows only the allowlist runner
      logging "running rebuild for: esbuild")
- [ ] Attempt `npm install <malicious-stub>` with a package that has a postinstall
      script; confirm the script does not execute
- [ ] `lockfile-lint` passes — all `resolved` URLs are `https://registry.npmjs.org/`
- [ ] `npm audit --audit-level=moderate` exits 0
- [ ] `npm audit signatures` exits 0

### Security headers

- [ ] Automated Playwright assertion: every page response includes `Strict-Transport-Security`,
      `X-Content-Type-Options`, `X-Frame-Options`, and `Content-Security-Policy` headers
- [ ] CSP does not contain `'unsafe-eval'`
- [ ] `frame-ancestors 'none'` prevents embedding in iframes (verify with a test page)

### Rate limiting

- [ ] `POST /api/shares` returns 429 after exceeding the per-IP limit within the
      window, and includes `Retry-After` in the response
- [ ] Rate limit resets after the window expires (or verify via the reset timestamp
      in `Retry-After`)
- [ ] Authenticated rate limits (autosave, admin) are per-user, not per-IP

### Authentication bypass attempts

- [ ] Request to any authenticated endpoint without a JWT → 401
- [ ] Request with a JWT signed by a different key → 401
- [ ] Request with a valid JWT but wrong `aud` → 401
- [ ] Request with an expired JWT → 401
- [ ] Request with a valid JWT but wrong user role to an admin endpoint → 403

### IDOR

- [ ] Attempt to read User A's diagram as User B → 403 or 404
- [ ] Attempt to delete User A's diagram as User B → 403 or 404
- [ ] Attempt to resolve a revoked share token → 404

### Error handling

- [ ] Trigger a deliberate 500 error; confirm response body contains only the
      error envelope (no stack trace, no file path)

### CI gates

- [ ] `npm run check:audit` exits 0 (`--audit-level=high`)
- [ ] OSV-Scanner exits 0
- [ ] `npm audit signatures` exits 0
- [ ] `lockfile-lint` exits 0
- [ ] Security headers present on all Playwright-tested routes

## Acceptance Criteria

| Story                                         | How we verify                                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Supply-chain Layer 1 re-instated              | `npm ci` with `ignore-scripts=true`; only allowlisted postinstall scripts execute; CI gate passes              |
| OWASP Top 10 reviewed                         | All 10 items have a documented finding or "no issue found" entry; no high-severity unaddressed findings remain |
| Security headers on all routes                | Automated Playwright header assertions pass; `securityheaders.com` returns A or A+                             |
| Rate limiting functional                      | Integration tests confirm 429 after limit exceeded; `Retry-After` header present                               |
| No unauthenticated access to protected routes | All auth bypass tests pass                                                                                     |
| No stack traces in production 500 responses   | Error handling test confirms response body matches error envelope only                                         |
| `SECURITY.md` published                       | File exists at repo root with vulnerability disclosure policy                                                  |
| Dependency audit clean                        | `npm audit --audit-level=moderate` exits 0; OSV-Scanner clean; all licenses compatible                         |

## Rollout / Rollback

**Rollout:** Security changes are non-breaking. Rate limiting and header changes
deploy atomically with the Worker. `ignore-scripts=true` re-institution is a local
and CI configuration change only — it does not affect the deployed Worker.

**Rollback:** Security headers and rate limiting can each be toggled off via Worker
environment variables if a regression is discovered in production, without
re-deploying code. The `ignore-scripts` change is rolled back by removing the line
from `.npmrc` and updating CI.

## Open Questions

- [ ] Rate limiting strategy: Cloudflare Rate Limiting product (simple, billed per
      rule) vs. KV-backed sliding-window (more flexible, KV read/write cost per
      request). Recommendation: start with Cloudflare's native product for
      simplicity; migrate to KV-backed if per-user limits or complex bucketing are
      needed.
- [ ] What is the right `minimumReleaseAge` threshold for the Renovate config
      after launch — keep at 14 days or tighten to 7?
- [ ] Should `ignore-scripts=true` also be documented in a `CONTRIBUTING.md` so
      new contributors understand why `npm ci` alone is not enough and they need to
      run `npm run postinstall` manually?
- [ ] Vulnerability disclosure window: 90-day standard coordinated disclosure, or
      shorter given the small attack surface?
- [ ] Should CSP `style-src 'unsafe-inline'` be eliminated? This requires
      replacing any runtime CSS-in-JS with static class names; worth the effort
      before launch.
