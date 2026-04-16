/**
 * Core middleware request handler (spec §8).
 *
 * This module contains all authentication, CSRF, and admin-gate logic
 * extracted into a function that depends only on standard Web API types
 * and `cloudflare:workers`-compatible bindings. It deliberately does NOT
 * import from `astro:middleware` so that unit tests running in the workerd
 * vitest pool can exercise it without the Astro build pipeline.
 *
 * The thin Astro middleware shim in `src/middleware.ts` delegates here.
 */

import { createDb } from './db/client'
import type { User } from './db/schema'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Subset of Cloudflare bindings the middleware needs.
 * Passed in from the Astro shim so tests can supply pool-provided bindings.
 */
export interface MiddlewareEnv {
  /** D1 database binding. */
  DB: D1Database
  /** KV namespace used for user and JWKS caching. */
  CACHE: KVNamespace
  /** CF Access team subdomain (e.g. `'my-org'`). */
  CF_ACCESS_TEAM_NAME: string
  /** GitHub username that receives the initial admin role. */
  INITIAL_ADMIN_GITHUB_USERNAME: string
}

/**
 * Pre-extracted request data passed from the Astro middleware shim.
 * Every field is a plain Web API / TypeScript type — no Astro types.
 */
export interface MiddlewareArgs {
  /** Full request URL (used for pathname and host matching). */
  url: URL
  /** HTTP method (GET, POST, PUT, DELETE, …). */
  method: string
  /** Value of the `Origin` request header, or `null` if absent. */
  originHeader: string | null
  /** Value of the `CF_Authorization` cookie, or `undefined` if absent. */
  cfAuthCookie: string | undefined
  /**
   * Mutable locals object — the handler sets `.user` on this.
   * In the Astro runtime this is `context.locals`.
   */
  locals: { user: User | null }
  /** Cloudflare bindings needed by the middleware. */
  env: MiddlewareEnv
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Route prefixes that require the authenticated user to have `role === 'admin'`.
 * The middleware returns 403 to non-admin users who reach these paths.
 */
const ADMIN_ROUTES = ['/admin', '/api/admin/']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a plain JSON error Response.
 *
 * @param status - HTTP status code.
 * @param code - Machine-readable error code string.
 * @param message - Human-readable message.
 * @returns A `Response` with `Content-Type: application/json`.
 */
function authErrorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Core request handler that drives the middleware flow (spec §8).
 *
 * Flow:
 * 1. Public route check: set `locals.user = null`, call `next()`.
 * 2. CSRF origin check: block cross-origin mutations to `/api/*`.
 * 3. Dev branch (`isDevMode`): auto-create the stub admin user.
 * 4. Prod branch: validate CF Access JWT, resolve or provision the user.
 * 5. Admin route check: return 403 if the user lacks admin role.
 * 6. Call `next()`.
 *
 * @param args - Pre-extracted request data (see {@link MiddlewareArgs}).
 * @param next - Continuation that renders the page / calls the next middleware.
 * @param isDevMode - `true` to use the dev auth stub (maps to `import.meta.env.DEV`).
 * @returns A `Response` — either an error response or the result of `next()`.
 */
export async function handleRequest(
  args: MiddlewareArgs,
  next: () => Promise<Response>,
  isDevMode: boolean,
): Promise<Response> {
  const { url, method, originHeader, cfAuthCookie, locals, env } = args
  const pathname = url.pathname

  // ------------------------------------------------------------------
  // 1. Public route passthrough — no auth required
  //    Exact `/` (landing) or any path starting with `/share/` (viewer).
  // ------------------------------------------------------------------
  const isPublic = pathname === '/' || pathname.startsWith('/share/')
  if (isPublic) {
    locals.user = null
    return next()
  }

  // ------------------------------------------------------------------
  // 2. CSRF origin check — mutation requests to /api/* only
  // ------------------------------------------------------------------
  const isMutation = ['POST', 'PUT', 'DELETE'].includes(method)
  if (isMutation && pathname.startsWith('/api/')) {
    if (originHeader !== null) {
      let originHost: string
      try {
        originHost = new URL(originHeader).host
      } catch {
        // Malformed Origin — treat as cross-origin and block
        return authErrorResponse(403, 'FORBIDDEN', 'Forbidden')
      }
      if (originHost !== url.host) {
        return authErrorResponse(403, 'FORBIDDEN', 'Forbidden')
      }
    }
    // Absent Origin header is allowed (e.g. curl, server-to-server)
  }

  // ------------------------------------------------------------------
  // 3. Dev mode — bypass CF Access, inject stub admin user
  // ------------------------------------------------------------------
  if (isDevMode) {
    // Lazy import so the entire module is tree-shaken in production builds
    const { getOrCreateDevUser } = await import('./auth/dev-user')
    const db = createDb(env.DB)
    locals.user = await getOrCreateDevUser(db)
  } else {
    // ------------------------------------------------------------------
    // 4. Production — validate CF Access JWT and resolve user
    // ------------------------------------------------------------------
    if (!cfAuthCookie) {
      return authErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }

    const { validateCfAccessJwt } = await import('./auth/middleware')
    const { resolveUser } = await import('./auth/roles')

    let email: string
    try {
      email = await validateCfAccessJwt(cfAuthCookie, env.CF_ACCESS_TEAM_NAME, env.CACHE)
    } catch {
      return authErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
    }

    const db = createDb(env.DB)
    locals.user = await resolveUser(
      db,
      env.CACHE,
      env.CF_ACCESS_TEAM_NAME,
      env.INITIAL_ADMIN_GITHUB_USERNAME,
      email,
      cfAuthCookie,
    )
  }

  // ------------------------------------------------------------------
  // 5. Admin route gate
  // ------------------------------------------------------------------
  const requiresAdmin = ADMIN_ROUTES.some((route) => pathname.startsWith(route))
  if (requiresAdmin && locals.user?.role !== 'admin') {
    return authErrorResponse(403, 'FORBIDDEN', 'Forbidden')
  }

  // ------------------------------------------------------------------
  // 6. Proceed
  // ------------------------------------------------------------------
  return next()
}
