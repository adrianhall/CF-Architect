import type { Kysely } from 'kysely'

import { getCachedUser, setCachedUser } from '../cache'
import { mapUserRow } from '../db/mappers'
import type { Database, User } from '../db/schema'
import { fetchCfAccessIdentity } from './middleware'

/**
 * Look up or auto-provision a user given a validated CF Access JWT email.
 *
 * Resolution order (spec §8.2):
 * 1. Check KV cache for `user:{email}` — return immediately on hit.
 * 2. Query the `users` table by email — if found, cache and return.
 * 3. First login: call `fetchCfAccessIdentity` to get GitHub profile data.
 *    - Determine role: `'admin'` if `github_username` matches `initialAdminUsername`
 *      (case-insensitive) AND no admin row exists yet in the DB.
 *    - Insert new user row.
 * 4. Cache the resolved user in KV (15-minute TTL via `setCachedUser`).
 * 5. Return the user.
 *
 * @param db - Kysely client for the D1 database.
 * @param cache - KV namespace for the user cache.
 * @param cfAccessTeamName - CF Access team subdomain (e.g. `'my-org'`).
 * @param initialAdminUsername - GitHub username that should receive the `'admin'` role on first login.
 * @param jwtEmail - Email extracted from the validated CF Access JWT.
 * @param cfAuthCookie - Raw `CF_Authorization` cookie value, forwarded to the identity endpoint.
 * @returns The resolved (or newly created) {@link User}.
 * @throws If the CF Access identity endpoint call fails on first login.
 */
export async function resolveUser(
  db: Kysely<Database>,
  cache: KVNamespace,
  cfAccessTeamName: string,
  initialAdminUsername: string,
  jwtEmail: string,
  cfAuthCookie: string,
): Promise<User> {
  // 1. KV cache hit
  const cached = await getCachedUser(cache, jwtEmail)
  if (cached !== null) {
    return cached
  }

  // 2. DB lookup by email
  const dbRow = await db
    .selectFrom('users')
    .where('email', '=', jwtEmail)
    .selectAll()
    .executeTakeFirst()

  if (dbRow !== undefined) {
    const user = mapUserRow(dbRow)
    await setCachedUser(cache, jwtEmail, user)
    return user
  }

  // 3. First login — fetch GitHub identity from CF Access
  const identity = await fetchCfAccessIdentity(cfAccessTeamName, cfAuthCookie)

  // Determine role: admin only if username matches (case-insensitive) AND no admin exists yet
  let role: 'admin' | 'user' = 'user'
  if (
    initialAdminUsername &&
    identity.githubUsername.toLowerCase() === initialAdminUsername.toLowerCase()
  ) {
    const adminCount = await db
      .selectFrom('users')
      .where('role', '=', 'admin')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirstOrThrow()

    if (Number(adminCount.count) === 0) {
      role = 'admin'
    }
  }

  // 4. Insert new user
  const inserted = await db
    .insertInto('users')
    .values({
      id: crypto.randomUUID(),
      github_id: identity.githubId,
      github_username: identity.githubUsername,
      email: identity.email || jwtEmail,
      display_name: identity.displayName,
      avatar_url: identity.avatarUrl,
      role,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  const newUser = mapUserRow(inserted)

  // 5. Cache and return
  await setCachedUser(cache, jwtEmail, newUser)
  return newUser
}

/**
 * Check whether a user has the `'admin'` role.
 *
 * Safe to call with `null` (returns `false`).
 *
 * @param user - The {@link User} object, or `null` for unauthenticated requests.
 * @returns `true` if the user exists and has `role === 'admin'`.
 */
export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin'
}
