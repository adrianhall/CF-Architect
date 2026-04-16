import type { User } from './db/schema'

/** TTL for user cache entries: 15 minutes in seconds. */
const USER_CACHE_TTL = 900

/** TTL for share cache entries: 1 hour in seconds. */
const SHARE_CACHE_TTL = 3600

/**
 * Cached share data stored in KV under the `share:{token}` key.
 * Contains enough information to render the share viewer without a D1 query.
 */
export interface ShareCacheData {
  /** UUID of the shared diagram. */
  diagramId: string
  /** JSON string of the tldraw store snapshot. */
  canvasData: string
  /** Diagram title. */
  title: string
  /** Diagram description. */
  description: string
}

/**
 * Build the KV key for a cached user lookup.
 *
 * @param email - The user's email address.
 * @returns KV key string.
 */
function userKey(email: string): string {
  return `user:${email}`
}

/**
 * Build the KV key for a cached share lookup.
 *
 * @param token - The share token.
 * @returns KV key string.
 */
function shareKey(token: string): string {
  return `share:${token}`
}

/**
 * Get a cached user by email.
 *
 * @param cache - The KV namespace binding.
 * @param email - The user's email address.
 * @returns The cached {@link User}, or `null` on a cache miss or error.
 */
export async function getCachedUser(cache: KVNamespace, email: string): Promise<User | null> {
  try {
    const raw = await cache.get(userKey(email))
    if (raw === null) return null
    return JSON.parse(raw) as User
  } catch (err) {
    console.error('[cache] getCachedUser error:', err)
    return null
  }
}

/**
 * Cache a user record by email.
 * Write failures are logged but do not throw.
 *
 * @param cache - The KV namespace binding.
 * @param email - The user's email address.
 * @param user - The {@link User} object to cache.
 */
export async function setCachedUser(cache: KVNamespace, email: string, user: User): Promise<void> {
  try {
    await cache.put(userKey(email), JSON.stringify(user), { expirationTtl: USER_CACHE_TTL })
  } catch (err) {
    console.error('[cache] setCachedUser error:', err)
  }
}

/**
 * Delete a cached user by email.
 * Used after role changes to invalidate the cached record.
 * Errors are logged but do not throw.
 *
 * @param cache - The KV namespace binding.
 * @param email - The user's email address.
 */
export async function deleteCachedUser(cache: KVNamespace, email: string): Promise<void> {
  try {
    await cache.delete(userKey(email))
  } catch (err) {
    console.error('[cache] deleteCachedUser error:', err)
  }
}

/**
 * Get cached share data by token.
 *
 * @param cache - The KV namespace binding.
 * @param token - The share token.
 * @returns The cached {@link ShareCacheData}, or `null` on a cache miss or error.
 */
export async function getCachedShare(
  cache: KVNamespace,
  token: string,
): Promise<ShareCacheData | null> {
  try {
    const raw = await cache.get(shareKey(token))
    if (raw === null) return null
    return JSON.parse(raw) as ShareCacheData
  } catch (err) {
    console.error('[cache] getCachedShare error:', err)
    return null
  }
}

/**
 * Cache share data by token.
 * Write failures are logged but do not throw.
 *
 * @param cache - The KV namespace binding.
 * @param token - The share token.
 * @param data - The {@link ShareCacheData} to cache.
 */
export async function setCachedShare(
  cache: KVNamespace,
  token: string,
  data: ShareCacheData,
): Promise<void> {
  try {
    await cache.put(shareKey(token), JSON.stringify(data), { expirationTtl: SHARE_CACHE_TTL })
  } catch (err) {
    console.error('[cache] setCachedShare error:', err)
  }
}

/**
 * Delete cached share data by token.
 * Used on diagram update or delete to invalidate stale share cache entries.
 * Errors are logged but do not throw.
 *
 * @param cache - The KV namespace binding.
 * @param token - The share token.
 */
export async function deleteCachedShare(cache: KVNamespace, token: string): Promise<void> {
  try {
    await cache.delete(shareKey(token))
  } catch (err) {
    console.error('[cache] deleteCachedShare error:', err)
  }
}
