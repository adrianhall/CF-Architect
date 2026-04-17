import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineProject } from 'vitest/config'

/**
 * Vitest project configuration for server-side tests running in the
 * Cloudflare workerd runtime via miniflare.
 *
 * Tests in `tests/unit/` exercise code that depends on D1/KV bindings,
 * Cloudflare Workers APIs, and other server-side logic.
 *
 * This config is referenced by the root `vitest.config.ts` via `test.projects`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default defineProject(async (_env) => {
  const migrationsPath = path.join(__dirname, 'src/lib/db/migrations')
  const migrations = await readD1Migrations(migrationsPath)

  return {
    plugins: [
      cloudflareTest({
        main: './tests/test-worker.ts',
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      name: 'workerd',
      include: ['tests/unit/**/*.test.{ts,tsx}'],
      exclude: ['node_modules', 'dist', 'tests/e2e'],
      setupFiles: ['./tests/apply-migrations.ts'],
    },
  }
})
