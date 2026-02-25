/**
 * D1 database client factory.
 *
 * Wraps Cloudflare's D1 binding with Drizzle ORM, providing type-safe
 * query building against the schema defined in `./schema.ts`.
 */
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Create a Drizzle ORM instance backed by a D1 database binding.
 *
 * @param d1 - The Cloudflare D1 database binding (typically `env.DB`).
 * @returns A Drizzle client with full schema awareness for type-safe queries.
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

/** Type alias for the Drizzle client returned by {@link createDb}. */
export type Database = ReturnType<typeof createDb>;
