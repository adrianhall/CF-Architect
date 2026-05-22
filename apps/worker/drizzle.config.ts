import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * Local D1 is managed by wrangler's miniflare instance.
 * Remote D1 is the production database.
 *
 * Usage:
 *   npm run migrate          # local (default)
 *   npm run migrate -- --remote  # remote (production)
 *
 * Note: The database name must match `database_name` in wrangler.*.jsonc.
 */

const isRemote = process.argv.includes("--remote");

const config: Config = {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  driver: isRemote ? "d1-http" : undefined,
};

export default config;
