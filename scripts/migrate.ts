/**
 * scripts/migrate.ts
 *
 * Applies Drizzle migrations to the D1 database.
 *
 * Usage:
 *   npm run migrate           # local miniflare D1 (default)
 *   npm run migrate -- --remote   # remote (production) D1
 *
 * The `--remote` flag is forwarded directly to `wrangler d1 migrations apply`.
 *
 * The database name is read from wrangler.jsonc (generated) for remote and
 * wrangler.test.jsonc for local development. In CI, local migrations use
 * the test fixture.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const isRemote = process.argv.includes("--remote");

// Choose the wrangler config to read the database name from.
// Remote deploys use the real wrangler.jsonc (must exist after provision).
// Local / CI use the committed test fixture.
const wranglerConfig = isRemote
  ? resolve(ROOT, "wrangler.jsonc")
  : resolve(ROOT, "wrangler.test.jsonc");

if (isRemote && !existsSync(wranglerConfig)) {
  console.error(
    "migrate: wrangler.jsonc not found.\n" + "Run `npm run provision` first to generate it.",
  );
  process.exit(1);
}

const dbName = isRemote ? "cf-arch-production" : "cf-arch-test";
const remoteFlag = isRemote ? "--remote" : "--local";
const configFlag = `--config ${wranglerConfig}`;

const cmd = ["npx wrangler d1 migrations apply", dbName, remoteFlag, configFlag]
  .filter(Boolean)
  .join(" ");

console.log(`migrate: running: ${cmd}`);

try {
  execSync(cmd, { stdio: "inherit", cwd: ROOT });
  console.log("migrate: done.");
} catch (err) {
  console.error(`migrate: failed: ${String(err)}`);
  process.exit(1);
}
