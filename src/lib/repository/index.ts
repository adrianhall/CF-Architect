/**
 * Repository layer entry point.
 *
 * Provides {@link createRepositories}, the single factory that API routes
 * and Astro pages use to obtain repository instances wired to the current
 * request's Cloudflare bindings.
 */
import { createDb } from "../db/client";
import { DiagramRepository } from "./diagram-repository";
import { ShareRepository } from "./share-repository";

export { DiagramRepository } from "./diagram-repository";
export { ShareRepository } from "./share-repository";
export type {
  DiagramRow,
  PublicDiagramFields,
  ShareMeta,
  ShareLinkResult,
  ShareLinkInfo,
  ShareLinkRow,
  CreateDiagramFields,
  UpdateDiagramFields,
} from "./types";

/**
 * Create repository instances wired to the given Cloudflare bindings.
 *
 * Call once per request with `locals.runtime.env` (in API routes) or
 * `Astro.locals.runtime.env` (in Astro pages).
 */
export function createRepositories(env: { DB: D1Database; KV: KVNamespace }) {
  const db = createDb(env.DB);
  return {
    diagrams: new DiagramRepository(db),
    shares: new ShareRepository(db, env.KV),
  };
}
