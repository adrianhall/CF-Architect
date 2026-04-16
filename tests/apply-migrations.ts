/**
 * Vitest setup file that applies D1 migrations to the ephemeral test database.
 *
 * Setup files run outside isolated storage and may be run multiple times.
 * `applyD1Migrations()` only applies migrations that haven't already been
 * applied, so it is safe to call unconditionally.
 *
 * The `TEST_MIGRATIONS` binding is injected by `vitest.config.ts` via
 * `readD1Migrations()` at the Node.js level.
 *
 * @see https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/#d1
 */
/// <reference types="@cloudflare/vitest-pool-workers/types" />
import type { D1Migration } from '@cloudflare/vitest-pool-workers'
import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

// The TEST_MIGRATIONS binding is injected at runtime by miniflare via
// vitest.config.ts but is not part of the generated Cloudflare.Env type.
// We cast through unknown to avoid adding a global type augmentation.
const migrations = (env as unknown as Record<string, unknown>).TEST_MIGRATIONS as D1Migration[]

await applyD1Migrations(env.DB, migrations)
