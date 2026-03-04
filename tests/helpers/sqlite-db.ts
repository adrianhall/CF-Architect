/**
 * In-memory SQLite test database backed by better-sqlite3 and Drizzle ORM.
 *
 * Applies the project's migration files to produce a schema that matches
 * production D1, then wraps the connection with Drizzle for use in tests
 * that need real SQL execution (subqueries, joins, aggregates, etc.).
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@lib/db/schema";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(HERE, "../../migrations");

const MIGRATION_FILES = ["0000_initial.sql", "0001_auth_overhaul.sql"];

function applyMigrations(sqlite: Database.Database): void {
  for (const file of MIGRATION_FILES) {
    const raw = readFileSync(resolve(MIGRATIONS_DIR, file), "utf-8");
    const blocks = raw.split("--> statement-breakpoint");
    for (const block of blocks) {
      const sql = block
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n")
        .trim();
      if (sql) sqlite.exec(sql);
    }
  }
}

/**
 * Create a fresh in-memory SQLite database with the full project schema
 * applied. Returns a Drizzle instance compatible (via `as any`) with the
 * D1-typed `Database` expected by repository classes.
 */
export function createTestSqliteDb() {
  const sqlite = new Database(":memory:");
  applyMigrations(sqlite);
  return drizzle(sqlite, { schema });
}
