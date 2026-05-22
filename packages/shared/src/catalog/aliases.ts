/**
 * packages/shared/src/catalog/aliases.ts
 *
 * Alias map for renamed/merged Cloudflare service type IDs.
 *
 * Format: { "old-type-id": "current-type-id" }
 *
 * Rules:
 *  - Never delete an entry once published — diagrams in the field reference old IDs.
 *  - The value must be a typeId that exists in SERVICES.
 *  - Add a comment explaining why the alias exists.
 *
 * See packages/shared/src/catalog/CONTRIBUTING.md for the renaming workflow.
 */

import type { AliasMap } from "./types.js";

/**
 * Stable alias map.
 * Empty in Phase 03 — no legacy v1 service IDs require mapping yet.
 * Add entries here when a typeId is renamed.
 */
export const ALIASES: AliasMap = {
  // Example (do not uncomment unless the rename has shipped):
  // "workers-kv-legacy": "workers-kv",
};

// ---------------------------------------------------------------------------
// resolveTypeId
// ---------------------------------------------------------------------------

/**
 * Resolves an old or aliased typeId to the current canonical typeId.
 *
 * If `id` is in the alias map, the mapped value is returned.
 * If `id` is not in the map, it is returned unchanged (idempotent).
 *
 * @example
 * resolveTypeId("workers-kv-legacy", aliases) // → "workers-kv"
 * resolveTypeId("workers-kv", aliases)         // → "workers-kv" (unchanged)
 * resolveTypeId("unknown-id", aliases)         // → "unknown-id" (pass-through)
 */
export function resolveTypeId(id: string, aliases: AliasMap): string {
  const resolved = aliases[id];
  return resolved !== undefined ? resolved : id;
}
