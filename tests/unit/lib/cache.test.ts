/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:workers'

import {
  getCachedUser,
  setCachedUser,
  deleteCachedUser,
  getCachedShare,
  setCachedShare,
  deleteCachedShare,
} from '../../../src/lib/cache'
import type { User } from '../../../src/lib/db/schema'
import type { ShareCacheData } from '../../../src/lib/cache'

/** Sample user fixture for cache tests. */
const TEST_USER: User = {
  id: 'user-001',
  github_id: '12345',
  github_username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345',
  role: 'user',
}

/** Sample share data fixture for cache tests. */
const TEST_SHARE: ShareCacheData = {
  diagramId: 'diagram-001',
  canvasData: '{"shapes":[]}',
  title: 'My Diagram',
  description: 'A test diagram',
}

describe('user cache', () => {
  it('getCachedUser returns null on cache miss', async () => {
    const result = await getCachedUser(env.CACHE, 'nobody@example.com')
    expect(result).toBeNull()
  })

  it('setCachedUser + getCachedUser round-trip returns the stored user', async () => {
    await setCachedUser(env.CACHE, TEST_USER.email, TEST_USER)
    const result = await getCachedUser(env.CACHE, TEST_USER.email)
    expect(result).toEqual(TEST_USER)
  })

  it('deleteCachedUser removes the cached entry', async () => {
    await setCachedUser(env.CACHE, TEST_USER.email, TEST_USER)
    await deleteCachedUser(env.CACHE, TEST_USER.email)
    const result = await getCachedUser(env.CACHE, TEST_USER.email)
    expect(result).toBeNull()
  })

  it('getCachedUser preserves all user fields', async () => {
    await setCachedUser(env.CACHE, TEST_USER.email, TEST_USER)
    const result = await getCachedUser(env.CACHE, TEST_USER.email)
    expect(result?.id).toBe(TEST_USER.id)
    expect(result?.github_id).toBe(TEST_USER.github_id)
    expect(result?.github_username).toBe(TEST_USER.github_username)
    expect(result?.role).toBe(TEST_USER.role)
    expect(result?.avatar_url).toBe(TEST_USER.avatar_url)
  })
})

describe('share cache', () => {
  it('getCachedShare returns null on cache miss', async () => {
    const result = await getCachedShare(env.CACHE, 'no-such-token-xyz')
    expect(result).toBeNull()
  })

  it('setCachedShare + getCachedShare round-trip returns the stored share data', async () => {
    const token = 'test-share-token-abc123'
    await setCachedShare(env.CACHE, token, TEST_SHARE)
    const result = await getCachedShare(env.CACHE, token)
    expect(result).toEqual(TEST_SHARE)
  })

  it('deleteCachedShare removes the cached entry', async () => {
    const token = 'delete-me-token-xyz'
    await setCachedShare(env.CACHE, token, TEST_SHARE)
    await deleteCachedShare(env.CACHE, token)
    const result = await getCachedShare(env.CACHE, token)
    expect(result).toBeNull()
  })

  it('getCachedShare preserves all ShareCacheData fields', async () => {
    const token = 'full-fields-token-abc'
    await setCachedShare(env.CACHE, token, TEST_SHARE)
    const result = await getCachedShare(env.CACHE, token)
    expect(result?.diagramId).toBe(TEST_SHARE.diagramId)
    expect(result?.canvasData).toBe(TEST_SHARE.canvasData)
    expect(result?.title).toBe(TEST_SHARE.title)
    expect(result?.description).toBe(TEST_SHARE.description)
  })
})

/** Helper to create a KVNamespace stub where every method rejects. */
function brokenCache(): KVNamespace {
  const fail = () => Promise.reject(new Error('KV offline'))
  return { get: fail, put: fail, delete: fail } as unknown as KVNamespace
}

describe('error handling', () => {
  it('getCachedUser returns null when KV.get throws', async () => {
    const result = await getCachedUser(brokenCache(), 'test@example.com')
    expect(result).toBeNull()
  })

  it('setCachedUser swallows errors without throwing', async () => {
    await expect(
      setCachedUser(brokenCache(), 'test@example.com', TEST_USER),
    ).resolves.toBeUndefined()
  })

  it('deleteCachedUser swallows errors without throwing', async () => {
    await expect(deleteCachedUser(brokenCache(), 'test@example.com')).resolves.toBeUndefined()
  })

  it('getCachedShare returns null when KV.get throws', async () => {
    const result = await getCachedShare(brokenCache(), 'some-token')
    expect(result).toBeNull()
  })

  it('setCachedShare swallows errors without throwing', async () => {
    await expect(setCachedShare(brokenCache(), 'some-token', TEST_SHARE)).resolves.toBeUndefined()
  })

  it('deleteCachedShare swallows errors without throwing', async () => {
    await expect(deleteCachedShare(brokenCache(), 'some-token')).resolves.toBeUndefined()
  })
})
