# Phase 003: Authentication & Middleware

## Goal

Implement the Astro middleware that handles authentication, CSRF protection, user resolution, and admin authorization. In dev mode, a stub user bypasses CF Access. The production code path validates CF Access JWTs and auto-provisions users from GitHub identity data.

## Prerequisites

- Phase 002 complete (database layer, cache helpers, schema types).

## Deliverables

### 1. Dev Auth Stub

#### `src/lib/auth/dev-user.ts`

Implement the local development authentication stub exactly as specified in spec §8.3.

```typescript
const DEV_USER = {
  github_id: '0',
  github_username: 'dev-user',
  email: 'dev@localhost',
  display_name: 'Local Developer',
  avatar_url: null,
  role: 'admin' as const,
}
```

**`getOrCreateDevUser(db)`:**
- Query `users` table by `github_id = '0'`.
- If not found, insert with `crypto.randomUUID()` as id.
- Return the user row.
- Idempotent: safe to call on every request.
- No KV cache usage (avoids stale state during rapid dev iteration).

### 2. JWT Validation

#### `src/lib/auth/middleware.ts`

Implement CF Access JWT validation per spec §8.1:

**`validateCfAccessJwt(token, teamName, cache)`:**
- Fetch JWKS from `https://{teamName}.cloudflareaccess.com/cdn-cgi/access/certs`.
- Cache JWKS in KV under key `jwks:keys` with TTL 1 hour.
- On cache hit, use cached keys. On miss, fetch and cache.
- Validate JWT signature against JWKS keys.
- Verify `exp` claim (not expired).
- Extract and return `email` from JWT claims.
- Throw on invalid/expired JWT.

Use the Web Crypto API (`crypto.subtle`) for JWT verification — this is available in Workers runtime. Parse the JWT manually (split by `.`, base64url-decode header and payload, verify signature against JWKS RSA public key).

**Important:** The JWT from CF Access is a standard RS256 JWT. The JWKS endpoint returns RSA public keys. Use `crypto.subtle.importKey` with `RSASSA-PKCS1-v1_5` algorithm and `crypto.subtle.verify` for signature validation.

**`fetchCfAccessIdentity(teamName, cfAuthCookie)`:**
- Fetch `https://{teamName}.cloudflareaccess.com/cdn-cgi/access/get-identity` with the user's `CF_Authorization` cookie.
- Parse response and extract GitHub profile data: `github.id`, `github.login`, `github.avatar_url`, `name`, `email`.
- Return a structured object.
- This is called only on first login (user not in DB).

### 3. User Resolution & Auto-Provisioning

#### `src/lib/auth/roles.ts`

Implement `resolveUser()` exactly as specified in spec §8.2:

```typescript
export async function resolveUser(
  db: Kysely<Database>,
  cache: KVNamespace,
  cfAccessTeamName: string,
  initialAdminUsername: string,
  jwtEmail: string,
  cfAuthCookie: string,
): Promise<User>
```

Flow:
1. Check KV cache for `user:{email}`.
2. If cached, return cached user.
3. Query DB by email.
4. If found in DB, cache in KV (15 min TTL), return.
5. If not in DB (first login):
   a. Call `fetchCfAccessIdentity()` to get GitHub profile.
   b. Determine role: `'admin'` if `github_username` matches `initialAdminUsername` (case-insensitive) AND no admin exists yet in DB. Otherwise `'user'`.
   c. Insert new user into DB.
   d. Cache in KV.
   e. Return.

Also export a role-checking utility:

```typescript
/** Check if the user has admin role. */
export function isAdmin(user: User | null): boolean
```

### 4. Astro Middleware

#### `src/middleware.ts`

Implement the main middleware per spec §8 (pseudocode in spec §8):

```typescript
import { defineMiddleware } from 'astro:middleware'

const PUBLIC_ROUTES = ['/', '/share/']
const ADMIN_ROUTES = ['/admin', '/api/admin/']

export const onRequest = defineMiddleware(async (context, next) => {
  // ... (see spec §8 for full flow)
})
```

**Step-by-step flow:**

1. **Public route check**: If pathname matches `PUBLIC_ROUTES` (exact `/` or starts with `/share/`), set `locals.user = null`, call `next()`.

2. **CSRF origin check**: For `POST`/`PUT`/`DELETE` requests to paths starting with `/api/`:
   - Get the `Origin` header.
   - If `Origin` is present and its host does not match `url.host`, return 403.
   - If `Origin` is absent, allow (some clients like curl don't send it).

3. **Dev mode branch**: If `import.meta.env.DEV`:
   - Create DB client from `locals.runtime.env.DB`.
   - Call `getOrCreateDevUser(db)`.
   - Set `locals.user`.
   - Skip JWT validation entirely.

4. **Production branch**: If not dev:
   - Extract `CF_Authorization` cookie.
   - If missing, return 401.
   - Call `validateCfAccessJwt()` to get email.
   - Call `resolveUser()` to get or create user.
   - Set `locals.user`.

5. **Admin route check**: If pathname starts with any `ADMIN_ROUTES` prefix and `locals.user.role !== 'admin'`, return 403.

6. **Call `next()`**.

### 5. Middleware Type Safety

Ensure `src/env.d.ts` (from phase 001) properly types `Astro.locals.user` so downstream pages and API endpoints get type-checked access.

The middleware must set `locals.user` on every request path:
- Public routes: `null`
- Authenticated routes: full user object
- Failed auth: returns early with error Response (never reaches `next()`)

---

## Testing Requirements

### `tests/unit/lib/auth/dev-user.test.ts`
- Test `getOrCreateDevUser` creates a user on first call.
- Test `getOrCreateDevUser` returns existing user on second call (idempotent).
- Test created user has `role: 'admin'` and `github_id: '0'`.
- Test created user has a valid UUID `id`.

### `tests/unit/lib/auth/middleware.test.ts`
- Test `validateCfAccessJwt` throws on malformed JWT.
- Test `validateCfAccessJwt` throws on expired JWT.
- Test `validateCfAccessJwt` caches JWKS in KV.
- Test `validateCfAccessJwt` uses cached JWKS on second call.
- Test `fetchCfAccessIdentity` parses GitHub profile correctly.
- Test `fetchCfAccessIdentity` throws on non-200 response.

**Note:** Mock the `fetch()` calls to CF Access endpoints. Never make real external calls in tests.

### `tests/unit/lib/auth/roles.test.ts`
- Test `resolveUser` returns cached user from KV.
- Test `resolveUser` returns user from DB when not in KV, and caches it.
- Test `resolveUser` creates new user on first login (fetches identity).
- Test `resolveUser` assigns admin role when username matches and no admin exists.
- Test `resolveUser` assigns user role when username matches but admin already exists.
- Test `resolveUser` assigns user role when username doesn't match.
- Test `isAdmin` returns true for admin role, false for user role, false for null.

### `tests/unit/middleware.test.ts`
- Test public routes pass through with `user: null`.
- Test CSRF check blocks cross-origin POST to `/api/*`.
- Test CSRF check allows same-origin POST.
- Test CSRF check allows requests without Origin header.
- Test unauthenticated requests to protected routes get 401 (production mode mocking).
- Test admin routes return 403 for non-admin users.
- Test admin routes pass through for admin users.
- Test dev mode auto-creates user and sets locals.

---

## Testable Features

1. **Dev auth works**: Start `npm run dev`, browse to `http://localhost:4321`. The middleware should auto-create a dev user in local D1. Verify by checking the database: `wrangler d1 execute cf-architect-db --local --command "SELECT * FROM users"` — should show the dev-user row.

2. **Protected routes require auth**: In a test, simulate a request to `/canvas/new` without a cookie. In production mode (can test via unit test with mock), should get 401.

3. **Admin route gating**: In a test, simulate a non-admin user accessing `/admin`. Should get 403.

4. **CSRF protection**: In a test, simulate a POST to `/api/diagrams` with a mismatched `Origin` header. Should get 403.

5. **Dev server still works**: `npm run dev` starts and all existing pages load.

---

## Acceptance Criteria

- [ ] `src/lib/auth/dev-user.ts` implements `getOrCreateDevUser`
- [ ] `src/lib/auth/middleware.ts` implements `validateCfAccessJwt` and `fetchCfAccessIdentity`
- [ ] `src/lib/auth/roles.ts` implements `resolveUser` and `isAdmin`
- [ ] `src/middleware.ts` implements the full middleware flow
- [ ] Public routes (`/`, `/share/*`) set `user: null`
- [ ] CSRF origin check blocks cross-origin mutations to `/api/*`
- [ ] Dev mode stub creates admin user in local D1
- [ ] Admin routes check `role === 'admin'`
- [ ] All exports have JSDoc documentation
- [ ] Unit tests cover all auth functions and middleware logic
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and page loads (dev user auto-created)
- [ ] `npm run build` succeeds
