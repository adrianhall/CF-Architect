import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/e2e'],
    coverage: {
      // V8 coverage is not supported with @cloudflare/vitest-pool-workers (workerd runtime).
      // Istanbul instrumented coverage is the required alternative per CF docs.
      provider: 'istanbul',
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
})
