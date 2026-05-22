import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read migration SQL files at config-load time (Node.js context).
// Passed to the Worker environment as a `TEST_MIGRATIONS` binding so that
// `test/apply-migrations.ts` can call applyD1Migrations() inside the runtime.
const migrationsPath = resolve(__dirname, "src/db/migrations");
const migrations = await readD1Migrations(migrationsPath);

// wrangler.test.jsonc lives at the repo root, not inside apps/worker
const wranglerConfig = resolve(__dirname, "../../wrangler.test.jsonc");

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        // Uses the committed test fixture (repo root) so tests run without
        // a real Cloudflare account or a generated wrangler.jsonc.
        configPath: wranglerConfig,
      },
      miniflare: {
        // Inject migrations as a test-only binding so apply-migrations.ts
        // can call applyD1Migrations(env.DB, env.TEST_MIGRATIONS).
        bindings: { TEST_MIGRATIONS: migrations },
      },
    }),
  ],
  test: {
    name: "worker",
    include: ["src/**/*.test.ts"],
    // Apply D1 migrations before each test file runs.
    setupFiles: ["./test/apply-migrations.ts"],
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/db/migrations/**"],
    },
  },
});
