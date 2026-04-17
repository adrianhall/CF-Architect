/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { describe, it, expect, afterEach, vi } from 'vitest'
import { env } from 'cloudflare:workers'

import { handleRequest } from '../../src/lib/middleware-handler'
import type { MiddlewareArgs } from '../../src/lib/middleware-handler'
import type { User } from '../../src/lib/db/schema'

// ---------------------------------------------------------------------------
// Helpers — build plain MiddlewareArgs objects for testing
// ---------------------------------------------------------------------------

/**
 * Build a {@link MiddlewareArgs} object for a single test case.
 *
 * @param options.pathname - URL path (default `/canvas/new`).
 * @param options.method - HTTP method (default `GET`).
 * @param options.origin - Value for the `Origin` header (omit for absent).
 * @param options.cfAuthCookie - Value of the `CF_Authorization` cookie.
 */
function makeArgs(options: {
  pathname?: string
  method?: string
  origin?: string
  cfAuthCookie?: string
}): MiddlewareArgs {
  const pathname = options.pathname ?? '/canvas/new'
  const host = 'localhost:4321'
  return {
    url: new URL(`http://${host}${pathname}`),
    method: options.method ?? 'GET',
    originHeader: options.origin ?? null,
    cfAuthCookie: options.cfAuthCookie,
    locals: { user: null },
    env: {
      DB: env.DB,
      CACHE: env.CACHE,
      CF_ACCESS_TEAM_NAME: 'test-team',
      INITIAL_ADMIN_GITHUB_USERNAME: 'dev-user',
    },
  }
}

/** A simple `next()` stub that returns a 200 OK response. */
async function nextOk(): Promise<Response> {
  return new Response('OK', { status: 200 })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleRequest — public routes', () => {
  // /share/* is fully public — no auth attempt, user always null
  it('passes through GET /share/abc123 with user: null', async () => {
    const args = makeArgs({ pathname: '/share/abc123' })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(200)
    expect(args.locals.user).toBeNull()
  })

  it('passes through POST /share/abc123 with user: null (public)', async () => {
    const args = makeArgs({ pathname: '/share/abc123', method: 'POST' })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(200)
    expect(args.locals.user).toBeNull()
  })
})

describe('handleRequest — landing page redirect', () => {
  it('redirects GET / to /dashboard in dev mode (always authenticated)', async () => {
    const args = makeArgs({ pathname: '/' })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('redirects GET / to /dashboard when CF_Authorization cookie is present (prod mode)', async () => {
    const args = makeArgs({ pathname: '/', cfAuthCookie: 'some-token' })
    const res = await handleRequest(args, nextOk, false)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('passes through GET / with user: null when no cookie and not dev mode (landing page)', async () => {
    const args = makeArgs({ pathname: '/' })
    const res = await handleRequest(args, nextOk, false)
    expect(res.status).toBe(200)
    expect(args.locals.user).toBeNull()
  })
})

describe('handleRequest — CSRF origin check', () => {
  it('allows a same-origin POST to /api/diagrams', async () => {
    const args = makeArgs({
      pathname: '/api/diagrams',
      method: 'POST',
      origin: 'http://localhost:4321',
    })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(200)
  })

  it('blocks a cross-origin POST to /api/diagrams with 403', async () => {
    const args = makeArgs({
      pathname: '/api/diagrams',
      method: 'POST',
      origin: 'http://evil.example.com',
    })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('blocks a cross-origin PUT to /api/diagrams/123', async () => {
    const args = makeArgs({
      pathname: '/api/diagrams/123',
      method: 'PUT',
      origin: 'http://evil.example.com',
    })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(403)
  })

  it('blocks a cross-origin DELETE to /api/diagrams/123', async () => {
    const args = makeArgs({
      pathname: '/api/diagrams/123',
      method: 'DELETE',
      origin: 'http://evil.example.com',
    })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(403)
  })

  it('allows a POST with no Origin header (e.g. curl)', async () => {
    const args = makeArgs({ pathname: '/api/diagrams', method: 'POST' })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(200)
  })

  it('does not apply CSRF check to cross-origin GET requests', async () => {
    const args = makeArgs({
      pathname: '/api/diagrams',
      method: 'GET',
      origin: 'http://evil.example.com',
    })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(200)
  })

  it('blocks requests with a malformed Origin header', async () => {
    const args = makeArgs({
      pathname: '/api/diagrams',
      method: 'POST',
      origin: 'not-a-valid-url',
    })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(403)
  })
})

describe('handleRequest — dev mode', () => {
  it('auto-creates the dev user and sets locals.user', async () => {
    const args = makeArgs({ pathname: '/canvas/new' })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(200)
    expect(args.locals.user).not.toBeNull()
    expect(args.locals.user?.github_id).toBe('0')
    expect(args.locals.user?.role).toBe('admin')
  })

  it('is idempotent — calling twice resolves the same user', async () => {
    const args1 = makeArgs({ pathname: '/canvas/new' })
    const args2 = makeArgs({ pathname: '/canvas/new' })
    await handleRequest(args1, nextOk, true)
    await handleRequest(args2, nextOk, true)
    expect(args1.locals.user?.id).toBe(args2.locals.user?.id)
  })
})

describe('handleRequest — production mode', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 401 when CF_Authorization cookie is missing', async () => {
    const args = makeArgs({ pathname: '/canvas/new' })
    const res = await handleRequest(args, nextOk, false)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when the JWT validation fails', async () => {
    // Empty JWKS so kid lookup fails → validateCfAccessJwt throws
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ keys: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    const args = makeArgs({
      pathname: '/canvas/new',
      cfAuthCookie: 'invalid.jwt.token',
    })
    const res = await handleRequest(args, nextOk, false)
    expect(res.status).toBe(401)
  })
})

describe('handleRequest — admin route gate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('allows an admin user to access /admin (dev mode)', async () => {
    const args = makeArgs({ pathname: '/admin' })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(200)
  })

  it('allows an admin user to access /api/admin/users (dev mode)', async () => {
    const args = makeArgs({ pathname: '/api/admin/users', method: 'GET' })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(200)
  })

  it('returns 403 when a non-admin user accesses /admin (dev mode)', async () => {
    const nonAdminUser: User = {
      id: 'non-admin-001',
      github_id: '777',
      github_username: 'regular',
      email: 'regular@example.com',
      display_name: 'Regular User',
      avatar_url: null,
      role: 'user',
    }

    const devUserModule = await import('../../src/lib/auth/dev-user')
    const spy = vi.spyOn(devUserModule, 'getOrCreateDevUser').mockResolvedValue(nonAdminUser)

    const args = makeArgs({ pathname: '/admin' })
    const res = await handleRequest(args, nextOk, true)
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('FORBIDDEN')

    spy.mockRestore()
  })

  it('returns 403 when a non-admin accesses /api/admin/users (production mode)', async () => {
    const nonAdminUser: User = {
      id: 'non-admin-prod-001',
      github_id: '888',
      github_username: 'prodregular',
      email: 'prodregular@example.com',
      display_name: 'Prod Regular',
      avatar_url: null,
      role: 'user',
    }

    const jwtModule = await import('../../src/lib/auth/middleware')
    const rolesModule = await import('../../src/lib/auth/roles')

    const jwtSpy = vi
      .spyOn(jwtModule, 'validateCfAccessJwt')
      .mockResolvedValue('prodregular@example.com')
    const resolveSpy = vi.spyOn(rolesModule, 'resolveUser').mockResolvedValue(nonAdminUser)

    const args = makeArgs({
      pathname: '/api/admin/users',
      cfAuthCookie: 'fake-valid-jwt',
    })
    const res = await handleRequest(args, nextOk, false)
    expect(res.status).toBe(403)

    jwtSpy.mockRestore()
    resolveSpy.mockRestore()
  })
})
