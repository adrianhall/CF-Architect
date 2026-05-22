/**
 * Vitest workspace configuration.
 *
 * In vitest 4.x, vitest.workspace.ts exports an array of project paths.
 * Each project's vitest.config.ts defines its own environment, coverage, etc.
 *
 * Istanbul is the required coverage provider for all projects because
 * @cloudflare/vitest-pool-workers does not support V8 coverage.
 *
 * Run with: npm run test:unit
 */
export default [
  "apps/web/vitest.config.ts",
  "packages/shared/vitest.config.ts",
  "apps/worker/vitest.config.ts",
  "scripts/vitest.config.ts",
];
