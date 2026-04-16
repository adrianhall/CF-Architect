import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default defineConfig(async (_env) => {
  // Read all D1 migrations from the migrations directory at the Node.js level.
  // These are injected as a TEST_MIGRATIONS binding so that the worker-context
  // setup file can apply them via applyD1Migrations().
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
      include: ['tests/unit/**/*.test.{ts,tsx}'],
      exclude: ['node_modules', 'dist', 'tests/e2e'],
      setupFiles: ['./tests/apply-migrations.ts'],
      coverage: {
        // V8 coverage is not supported with @cloudflare/vitest-pool-workers (workerd runtime).
        // Istanbul instrumented coverage is the required alternative per CF docs.
        provider: 'istanbul' as const,
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/env.d.ts', 'src/**/*.astro'],
        thresholds: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  }
})
