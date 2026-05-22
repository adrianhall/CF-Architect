/**
 * packages/shared/src/catalog/index.ts
 *
 * Catalog factory.
 *
 * `getCatalog()` assembles and validates the complete service catalog at
 * module load time. Any schema violation throws synchronously — ensuring that
 * a misconfigured catalog entry is caught at startup rather than silently
 * serving invalid data.
 *
 * The assembled catalog is frozen to prevent accidental mutation at runtime.
 */

import { CatalogSchema } from "./types.js";
import type { Catalog } from "./types.js";
import { CATEGORIES } from "./categories.js";
import { EDGE_TYPES } from "./edge-types.js";
import { SERVICES } from "./services.js";
import { ALIASES } from "./aliases.js";

const CATALOG_VERSION = "1.0.0";

// Assemble and validate once at module load time.
// CatalogSchema.parse() throws a ZodError if the data is invalid.
const _catalog: Catalog = CatalogSchema.parse({
  version: CATALOG_VERSION,
  services: SERVICES,
  categories: CATEGORIES,
  edgeTypes: EDGE_TYPES,
  aliases: ALIASES,
});

// Deep-freeze to prevent accidental mutation.
Object.freeze(_catalog);
Object.freeze(_catalog.services);
Object.freeze(_catalog.categories);
Object.freeze(_catalog.edgeTypes);
Object.freeze(_catalog.aliases);

/**
 * Returns the validated, immutable service catalog.
 *
 * Safe to call multiple times — always returns the same frozen object.
 * Throws synchronously at import time if any catalog entry is invalid.
 */
export function getCatalog(): Catalog {
  return _catalog;
}
