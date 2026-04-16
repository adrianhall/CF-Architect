import type { Kysely } from 'kysely'

import type { Database, User } from '../db/schema'
import { mapUserRow } from '../db/mappers'

/**
 * Static dev-mode user record.
 * Seeded into D1 on first request so FK relationships work correctly.
 * This is the authoritative definition per spec §8.3.
 */
const DEV_USER = {
  github_id: '0',
  github_username: 'dev-user',
  email: 'dev@localhost',
  display_name: 'Local Developer',
  avatar_url: null,
  role: 'admin' as const,
}

/**
 * Look up or create the local development stub user in D1.
 *
 * Behaviour (spec §8.3):
 * - Queries `users` by `github_id = '0'`.
 * - If the row does not exist, inserts it with a fresh UUID.
 * - Returns the persisted row so downstream FK operations work.
 * - Idempotent — safe to call on every request.
 * - KV cache is intentionally NOT used to avoid stale data during rapid dev iteration.
 *
 * This function is ONLY called when `import.meta.env.DEV` is `true`.
 * The entire import is tree-shaken out of production bundles.
 *
 * @param db - Kysely client created from `locals.runtime.env.DB`.
 * @returns The dev {@link User} row (with id, timestamps stripped to the `User` shape).
 */
export async function getOrCreateDevUser(db: Kysely<Database>): Promise<User> {
  const existing = await db
    .selectFrom('users')
    .where('github_id', '=', DEV_USER.github_id)
    .selectAll()
    .executeTakeFirst()

  if (existing) {
    return mapUserRow(existing)
  }

  const inserted = await db
    .insertInto('users')
    .values({
      id: crypto.randomUUID(),
      ...DEV_USER,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return mapUserRow(inserted)
}
