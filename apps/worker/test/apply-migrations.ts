/**
 * apps/worker/test/apply-migrations.ts
 *
 * Vitest setupFile — applies D1 migrations before each test file.
 *
 * The `TEST_MIGRATIONS` binding is injected by vitest.config.ts via
 * `miniflare.bindings`. `applyD1Migrations` is idempotent: it tracks which
 * migrations have already been applied and only runs new ones.
 */
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Top-level await is supported in Workers module format.
// This runs once before the first test in each file.
await applyD1Migrations(
  (env as { DB: D1Database; TEST_MIGRATIONS: D1Migration[] }).DB,
  (env as { DB: D1Database; TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS,
);
