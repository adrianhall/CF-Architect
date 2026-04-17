import { defineConfig } from 'vitest/config'

/**
 * Root Vitest configuration.
 *
 * Defines two test projects that run in a single Vitest process:
 *   - `workerd` — server-side tests in `tests/unit/` using Cloudflare workerd pool (miniflare).
 *   - `dom`     — React component tests in `tests/component/` using jsdom environment.
 *
 * Coverage is collected globally across both projects with Istanbul and
 * enforces 80% thresholds on statements, branches, functions, and lines.
 *
 * Ref: https://vitest.dev/guide/projects
 */
export default defineConfig({
  test: {
    projects: ['./vitest.config.workerd.ts', './vitest.config.dom.ts'],
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
})
