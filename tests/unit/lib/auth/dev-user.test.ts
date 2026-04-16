/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:workers'

import { getOrCreateDevUser } from '../../../../src/lib/auth/dev-user'
import { createDb } from '../../../../src/lib/db/client'

describe('getOrCreateDevUser', () => {
  it('creates a dev user on first call', async () => {
    const db = createDb(env.DB)
    const user = await getOrCreateDevUser(db)
    expect(user).toBeDefined()
    expect(user.github_id).toBe('0')
    expect(user.github_username).toBe('dev-user')
    expect(user.email).toBe('dev@localhost')
    expect(user.display_name).toBe('Local Developer')
    expect(user.avatar_url).toBeNull()
  })

  it('is idempotent — returns the same user on repeated calls', async () => {
    const db = createDb(env.DB)
    const first = await getOrCreateDevUser(db)
    const second = await getOrCreateDevUser(db)
    expect(second.id).toBe(first.id)
    expect(second.email).toBe(first.email)
  })

  it('created user has role: admin', async () => {
    const db = createDb(env.DB)
    const user = await getOrCreateDevUser(db)
    expect(user.role).toBe('admin')
  })

  it('created user has a valid UUID id', async () => {
    const db = createDb(env.DB)
    const user = await getOrCreateDevUser(db)
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('returned user does not include created_at or updated_at fields', async () => {
    const db = createDb(env.DB)
    const user = await getOrCreateDevUser(db)
    // The User type omits timestamp fields; verify they are not present
    expect(Object.keys(user)).not.toContain('created_at')
    expect(Object.keys(user)).not.toContain('updated_at')
  })
})
