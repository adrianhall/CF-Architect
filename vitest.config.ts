import { defineConfig } from "vitest/config";

/**
 * Root Vitest configuration — vitest 4.x workspace via `projects`.
 *
 * Istanbul is the required coverage provider for all projects because
 * @cloudflare/vitest-pool-workers does not support V8 coverage.
 *
 * Run with: npm run test:unit
 */
export default defineConfig({
  test: {
    projects: [
      "apps/web/vitest.config.ts",
      "packages/shared/vitest.config.ts",
      "apps/worker/vitest.config.ts",
      "scripts/vitest.config.ts",
    ],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: [
        "apps/web/src/**/*.ts",
        "apps/web/src/**/*.tsx",
        "apps/worker/src/**/*.ts",
        "packages/shared/src/**/*.ts",
        "scripts/**/*.ts",
        "scripts/**/*.mjs",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "apps/web/src/routeTree.gen.ts",
        "apps/web/src/main.tsx",
        "apps/worker/src/db/migrations/**",
      ],
    },
  },
});
