# Phase 009: Production Auth, E2E Tests & Polish

## Goal

Complete the production authentication code path (CF Access JWT validation with real JWKS), write comprehensive E2E tests with Playwright, audit JSDoc coverage, fill any remaining test coverage gaps, and ensure all five phase completion gates pass cleanly.

## Prerequisites

- Phase 008 complete (all three sides of the application functional in dev mode).

## Deliverables

### 1. Production Auth Hardening

#### Verify `src/lib/auth/middleware.ts`

The JWT validation and identity fetch were implemented in phase 003. This phase ensures the production code path is robust and well-tested:

**JWKS Caching:**
- Verify JWKS is cached in KV under `jwks:keys` with a 1-hour TTL.
- Verify cache miss triggers a fetch to `https://{team}.cloudflareaccess.com/cdn-cgi/access/certs`.
- Verify cache hit skips the fetch.
- Handle stale JWKS: If JWT validation fails with a cached JWKS, retry once with a fresh fetch (the signing key may have rotated).

**JWT Validation Details:**
- Parse JWT: split by `.`, base64url-decode header and payload.
- Verify header `alg` is `RS256`.
- Match `kid` in JWT header to a key in JWKS.
- Import the RSA public key with `crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])`.
- Verify signature with `crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, data)`.
- Validate `exp` claim: reject if expired.
- Extract `email` from payload claims.

**Identity Fetch Resilience:**
- Handle non-200 responses from the identity endpoint.
- Handle malformed JSON responses.
- Handle missing fields in the identity response (fall back to email-only if GitHub data is missing).
- Log errors but don't expose internal details to the client.

#### Verify `src/lib/auth/roles.ts`

- Confirm `resolveUser()` correctly handles the full flow: cache → DB → identity fetch → provision.
- Confirm the initial admin provisioning logic works: first user with matching GitHub username gets admin role.
- Confirm subsequent users with the same username don't get promoted (admin already exists).

### 2. CSRF Middleware Verification

Verify the CSRF origin check in `src/middleware.ts`:
- Mutations to `/api/*` with a mismatched `Origin` header are rejected (403).
- Requests without an `Origin` header are allowed (not all clients send it).
- Same-origin requests pass through.
- GET/HEAD requests are never checked (safe methods).
- Requests to non-API paths are not checked.

### 3. Wrangler Configuration for Deploy

#### Update `wrangler.jsonc`

Ensure the config is ready for production deploy:
- `database_id` and KV `id` fields have clear placeholder markers: `"<from-terraform-output-d1-database-id>"` and `"<from-terraform-output-kv-namespace-id>"`.
- `vars` section includes `CF_ACCESS_TEAM_NAME` and `INITIAL_ADMIN_GITHUB_USERNAME` with placeholder markers.
- Add a comment explaining how to fill in values from `terraform output`.
- Include `d1_migrations` path configuration if not already present (for `wrangler d1 migrations apply`).

The `wrangler.jsonc` should look like:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "compatibility_date": "2026-04-14",
  "compatibility_flags": ["global_fetch_strictly_public"],
  "name": "cf-architect",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS"
  },
  "observability": { "enabled": true },
  "d1_databases": [{
    "binding": "DB",
    "database_name": "cf-architect-db",
    "database_id": "<from-terraform-output-d1-database-id>"
  }],
  "kv_namespaces": [{
    "binding": "CACHE",
    "id": "<from-terraform-output-kv-namespace-id>"
  }],
  "vars": {
    "CF_ACCESS_TEAM_NAME": "<your-team-name>",
    "INITIAL_ADMIN_GITHUB_USERNAME": "<your-github-username>"
  }
}
```

### 4. E2E Tests

#### `tests/e2e/dashboard.test.ts`

Test the dashboard flow:
- Navigate to `/`. Verify landing page renders.
- In dev mode (mock auth): Verify dashboard renders with user info.
- Verify "New Diagram" button navigates to `/canvas/new`.
- Verify empty state when no diagrams.
- Create a diagram via API, return to dashboard, verify card appears.
- Verify diagram card has title, description, thumbnail placeholder.
- Click a diagram card, verify navigation to `/canvas/{id}`.

#### `tests/e2e/canvas.test.ts`

Test the canvas editor flow:
- Navigate to `/canvas/new`. Verify tldraw canvas renders.
- Open service toolbar. Verify all categories and services listed.
- Search for a service in the toolbar.
- Drag a service onto the canvas (or use `editor.createShape()` via page evaluation).
- Verify shape appears on canvas.
- Edit the title in the top bar.
- Click Save. Verify save succeeds (status indicator changes).
- Navigate away and back. Verify diagram persists.
- Test the Share button opens the share dialog.

#### `tests/e2e/share.test.ts`

Test the share viewer flow:
- Create a diagram with shapes via the canvas editor.
- Generate a share link via the Share dialog.
- Open the share link in a new page/context (simulating anonymous access).
- Verify the diagram renders in read-only mode.
- Verify shapes are visible.
- Test export PNG button triggers download.
- Test export SVG button triggers download.
- Navigate to an invalid share URL. Verify 404 page.

#### `tests/e2e/admin.test.ts`

Test the admin panel flow:
- Navigate to `/admin`. Verify stats dashboard renders.
- Navigate to `/admin/users`. Verify user table renders.
- Search for a user.
- Change a user's role (if test data has multiple users).
- Navigate to `/admin/blueprints`.
- Promote a diagram to blueprint.
- Verify it appears in the blueprint list.
- Demote it. Verify it's removed.

#### `tests/e2e/auth.test.ts`

Test authentication behavior:
- Verify `/canvas/new` is accessible in dev mode (mock auth).
- Verify `/admin` is accessible in dev mode (mock admin user).
- Verify `/share/{token}` works without authentication.

### 5. Unit Test Coverage Gaps

Audit the full test suite and fill coverage gaps to meet 80% on all metrics (statements, branches, functions, lines).

Common areas that may need additional tests:
- Edge cases in pagination (page beyond total, limit = 0).
- Error paths in API endpoints (DB errors, malformed input).
- Cache miss/hit paths in middleware.
- The dev auth stub's idempotent behavior.
- Mapper functions with null/missing fields.
- Share token expiry edge cases (exact boundary).

Run `npm run test:coverage` and analyze the coverage report to identify specific uncovered lines/branches.

### 6. JSDoc Audit

Review every `.ts`, `.tsx`, and `.astro` file in `src/`:
- Every exported function, type, interface, constant, and class must have a JSDoc comment.
- JSDoc must describe purpose, parameters, and return values.
- Internal helpers must have at least a short comment explaining intent.

Pay particular attention to:
- Astro page frontmatter (add comments explaining the page's purpose and data fetching).
- React component files (document props interfaces and component behavior).
- API endpoint files (document the endpoint, method, auth requirements).

### 7. Code Quality Pass

- Run `npm run check` and fix any remaining issues.
- Ensure no `any` types remain.
- Ensure no `@ts-ignore` or `@ts-expect-error` without justification.
- Verify import grouping (external first, then internal, blank line between).
- Check for any `TODO` or `FIXME` comments and resolve or document.

### 8. Build & Deploy Verification

- Run `npm run build` and verify no errors.
- Run `npm run dev` and manually test all three sides of the application:
  1. Canvas editor: create, edit, save, auto-save
  2. Share viewer: view, export PNG, export SVG
  3. Admin panel: stats, users, blueprints
- Verify `terraform validate` passes in `terraform/` (does not require terraform apply).
- Document the deploy flow in a brief comment in `package.json` or verify the existing setup.

---

## Testing Requirements

### E2E Tests
- `tests/e2e/dashboard.test.ts` — 5+ test cases
- `tests/e2e/canvas.test.ts` — 5+ test cases
- `tests/e2e/share.test.ts` — 5+ test cases
- `tests/e2e/admin.test.ts` — 5+ test cases
- `tests/e2e/auth.test.ts` — 3+ test cases

### Unit Test Coverage
- Run `npm run test:coverage` and verify 80%+ on statements, branches, functions, lines.
- Fill any gaps identified in the coverage report.

### Integration Tests for Auth
- `tests/unit/lib/auth/middleware.test.ts` — Expand with:
  - Test JWKS cache key rotation (cached JWKS fails, refetch succeeds).
  - Test malformed JWT formats (missing segments, bad base64).
  - Test expired JWT rejection.
  - Test valid JWT extraction of email claim.

---

## Testable Features

1. **Full canvas flow**: Create new diagram → add services → connect with arrows → save → return to dashboard → see card → edit again → changes persist.

2. **Full share flow**: Create diagram → share → copy URL → open in incognito → see read-only view → export PNG → export SVG.

3. **Full admin flow**: Open admin → see stats → manage users → promote/demote → manage blueprints → promote/demote.

4. **Blueprint flow**: Admin promotes diagram → User sees blueprint in "Browse Blueprints" → User creates new diagram from blueprint → Blueprint content is cloned.

5. **Auth flow**: All protected routes are inaccessible without auth (in production mode). Public routes work anonymously.

6. **Error handling**: API errors show as toast notifications. Save failures show persistent warning. Invalid URLs show 404.

7. **All tests pass**: `npm run test:coverage` shows 100% pass rate and 80%+ coverage.

8. **Check passes**: `npm run check` exits 0.

9. **Build succeeds**: `npm run build` completes without errors.

10. **Terraform validates**: `cd terraform && terraform validate` exits 0.

---

## Acceptance Criteria

- [ ] Production JWT validation handles key rotation, expiry, malformed tokens
- [ ] Identity fetch handles errors gracefully
- [ ] CSRF origin check works correctly for all methods
- [ ] `wrangler.jsonc` has clear placeholder markers for deploy values
- [ ] E2E tests exist for dashboard, canvas, share, admin, and auth flows
- [ ] All E2E tests pass with `npm run test:e2e`
- [ ] Unit test coverage meets 80% threshold on all metrics
- [ ] Every export in `src/` has JSDoc documentation
- [ ] No unresolved `TODO`/`FIXME` comments
- [ ] No `any` types in the codebase
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and all features work
- [ ] `npm run build` succeeds
- [ ] `terraform validate` passes
