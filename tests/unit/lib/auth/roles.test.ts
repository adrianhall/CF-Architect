/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { env } from 'cloudflare:workers'

import { resolveUser, isAdmin } from '../../../../src/lib/auth/roles'
import { createDb } from '../../../../src/lib/db/client'
import { setCachedUser } from '../../../../src/lib/cache'
import type { User } from '../../../../src/lib/db/schema'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A pre-built user row used across tests. */
const EXISTING_USER: User = {
  id: 'user-existing-001',
  github_id: '111',
  github_username: 'existinguser',
  email: 'existing@example.com',
  display_name: 'Existing User',
  avatar_url: null,
  role: 'user',
}

/** Mock CF Access identity returned by fetchCfAccessIdentity. */
const MOCK_IDENTITY = {
  githubId: '999',
  githubUsername: 'newuser',
  displayName: 'New User',
  avatarUrl: 'https://avatars.githubusercontent.com/u/999',
  email: 'new@example.com',
}

/** Stub fetch to return mock identity data. */
function stubIdentityFetch(identity = MOCK_IDENTITY) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            email: identity.email,
            name: identity.displayName,
            github: {
              id: Number(identity.githubId),
              login: identity.githubUsername,
              avatar_url: identity.avatarUrl,
            },
          }),
          { status: 200 },
        ),
    ),
  )
}

/** Insert a user row directly into the test D1 database. */
async function seedUser(user: User) {
  const db = createDb(env.DB)
  await db
    .insertInto('users')
    .values({
      id: user.id,
      github_id: user.github_id,
      github_username: user.github_username,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      role: user.role,
    })
    .execute()
}

// ---------------------------------------------------------------------------
// resolveUser
// ---------------------------------------------------------------------------

describe('resolveUser', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    // Clean up shared D1 state so each test starts with an empty users table.
    // Without this, admin rows from other test files (e.g. dev-user.test.ts)
    // cause the "no admin exists" check in resolveUser to give wrong results.
    const db = createDb(env.DB)
    await db.deleteFrom('users').execute()
    // Clear all user-email KV cache keys used across tests in this suite.
    // If a prior test cached a user, resolveUser would return it from KV
    // without reaching the DB admin-count logic, hiding the real behavior.
    await env.CACHE.delete(`user:${EXISTING_USER.email}`)
    await env.CACHE.delete('user:new@example.com')
    await env.CACHE.delete('user:admin@example.com')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a cached user from KV without touching the DB', async () => {
    const db = createDb(env.DB)
    await setCachedUser(env.CACHE, EXISTING_USER.email, EXISTING_USER)

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const user = await resolveUser(
      db,
      env.CACHE,
      'test-team',
      'admin-user',
      EXISTING_USER.email,
      'cookie',
    )

    expect(user.id).toBe(EXISTING_USER.id)
    expect(user.email).toBe(EXISTING_USER.email)
    // KV hit: no DB query, no identity fetch
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns a user from DB when not in KV cache, and caches it', async () => {
    const db = createDb(env.DB)
    await seedUser(EXISTING_USER)

    const user = await resolveUser(
      db,
      env.CACHE,
      'test-team',
      'admin-user',
      EXISTING_USER.email,
      'cookie',
    )

    expect(user.id).toBe(EXISTING_USER.id)
    expect(user.role).toBe('user')

    // Should now be in KV
    const cachedRaw = await env.CACHE.get(`user:${EXISTING_USER.email}`)
    expect(cachedRaw).not.toBeNull()
  })

  it('creates a new user on first login and caches them', async () => {
    const db = createDb(env.DB)
    stubIdentityFetch()

    const user = await resolveUser(
      db,
      env.CACHE,
      'test-team',
      'other-admin',
      'new@example.com',
      'cookie',
    )

    expect(user.github_username).toBe('newuser')
    expect(user.email).toBe('new@example.com')
    expect(user.role).toBe('user')
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/) // UUID

    // Should be persisted in DB
    const dbRow = await db
      .selectFrom('users')
      .where('email', '=', 'new@example.com')
      .selectAll()
      .executeTakeFirst()
    expect(dbRow).toBeDefined()
  })

  it('assigns admin role when username matches and no admin exists', async () => {
    const db = createDb(env.DB)
    stubIdentityFetch({ ...MOCK_IDENTITY, githubUsername: 'the-admin' })

    const user = await resolveUser(
      db,
      env.CACHE,
      'test-team',
      'the-admin', // matches
      'new@example.com',
      'cookie',
    )

    expect(user.role).toBe('admin')
  })

  it('assigns user role when username matches but an admin already exists', async () => {
    const db = createDb(env.DB)
    // Seed an existing admin
    await seedUser({
      ...EXISTING_USER,
      id: 'admin-pre-existing',
      role: 'admin',
      github_id: '555',
      email: 'admin@example.com',
    })

    stubIdentityFetch({ ...MOCK_IDENTITY, githubUsername: 'the-admin' })

    const user = await resolveUser(
      db,
      env.CACHE,
      'test-team',
      'the-admin', // matches but admin already exists
      'new@example.com',
      'cookie',
    )

    expect(user.role).toBe('user')
  })

  it('assigns user role when username does not match initialAdminUsername', async () => {
    const db = createDb(env.DB)
    stubIdentityFetch({ ...MOCK_IDENTITY, githubUsername: 'regular-person' })

    const user = await resolveUser(
      db,
      env.CACHE,
      'test-team',
      'the-admin', // does not match
      'new@example.com',
      'cookie',
    )

    expect(user.role).toBe('user')
  })

  it('performs case-insensitive comparison for admin username', async () => {
    const db = createDb(env.DB)
    stubIdentityFetch({ ...MOCK_IDENTITY, githubUsername: 'TheAdmin' })

    const user = await resolveUser(
      db,
      env.CACHE,
      'test-team',
      'theadmin', // different casing
      'new@example.com',
      'cookie',
    )

    // No existing admin => should be promoted to admin
    expect(user.role).toBe('admin')
  })
})

// ---------------------------------------------------------------------------
// isAdmin
// ---------------------------------------------------------------------------

describe('isAdmin', () => {
  it('returns true for a user with role admin', () => {
    const user: User = { ...EXISTING_USER, role: 'admin' }
    expect(isAdmin(user)).toBe(true)
  })

  it('returns false for a user with role user', () => {
    expect(isAdmin(EXISTING_USER)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isAdmin(null)).toBe(false)
  })
})
