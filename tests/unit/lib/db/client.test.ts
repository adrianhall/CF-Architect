/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import { Kysely } from 'kysely'

import { createDb } from '../../../../src/lib/db/client'
import type { Database } from '../../../../src/lib/db/schema'

// D1 migrations are applied globally via tests/apply-migrations.ts setup file,
// using the official applyD1Migrations() + readD1Migrations() pattern from
// @cloudflare/vitest-pool-workers. No per-file migration setup needed.

describe('createDb', () => {
  it('returns a Kysely instance', () => {
    const db = createDb(env.DB)
    expect(db).toBeInstanceOf(Kysely)
  })

  it('returns a Kysely instance typed to the Database schema', () => {
    // Type-level assertion: the following must compile without error.
    const db: Kysely<Database> = createDb(env.DB)
    expect(db).toBeDefined()
  })

  it('can execute a simple query against the local D1 database', async () => {
    const db = createDb(env.DB)
    const result = await db.selectFrom('users').selectAll().execute()
    expect(Array.isArray(result)).toBe(true)
  })

  it('can query all four schema tables without error', async () => {
    const db = createDb(env.DB)
    const [users, diagrams, tags, tokens] = await Promise.all([
      db.selectFrom('users').selectAll().execute(),
      db.selectFrom('diagrams').selectAll().execute(),
      db.selectFrom('diagram_tags').selectAll().execute(),
      db.selectFrom('share_tokens').selectAll().execute(),
    ])
    expect(Array.isArray(users)).toBe(true)
    expect(Array.isArray(diagrams)).toBe(true)
    expect(Array.isArray(tags)).toBe(true)
    expect(Array.isArray(tokens)).toBe(true)
  })
})
