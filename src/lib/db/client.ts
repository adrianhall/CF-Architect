import { Kysely } from 'kysely'
import { D1Dialect } from 'kysely-d1'

import type { Database } from './schema'

/**
 * Create a Kysely database client from a D1 binding.
 *
 * @param d1 - The D1Database binding from `Astro.locals.runtime.env.DB`.
 * @returns A fully typed Kysely instance for the CF-Architect schema.
 */
export function createDb(d1: D1Database): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new D1Dialect({ database: d1 }),
  })
}
