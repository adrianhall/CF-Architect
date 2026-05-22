import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrationsPath = resolve(__dirname, "src/db/migrations");
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
        d1Databases: ["DB"],
        d1Persist: false,
        // Apply migrations to the in-memory D1 before tests run
        migrations: await readD1Migrations(migrationsPath),
      },
    }),
  ],
  test: {
    name: "worker",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/db/migrations/**"],
    },
  },
});
