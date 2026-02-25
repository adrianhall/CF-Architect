/**
 * Share-link lifecycle management.
 *
 * Handles creation, resolution, and revocation of read-only share links
 * for diagrams. Tokens are dual-written to both D1 (durable) and KV (fast
 * edge lookups). Resolution checks KV first, falling back to D1.
 */
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { createDb, type Database } from "./db/client";
import { shareLinks } from "./db/schema";
import { generateId, nowISO } from "./helpers";

/** Number of characters in a generated share token (nanoid URL-safe alphabet). */
const SHARE_TOKEN_LENGTH = 12;

/** Metadata stored in KV alongside the share token for fast resolution. */
interface ShareMeta {
  /** The diagram ID this token grants access to. */
  diagramId: string;
  /** ISO 8601 expiration timestamp, or null for no expiry. */
  expiresAt: string | null;
}

/**
 * Create a new share link for a diagram.
 *
 * Generates a cryptographically random URL-safe token, persists a row in
 * D1's `share_links` table, and writes the same metadata to KV for fast
 * edge resolution. If `expiresInSeconds` is provided, the KV entry will
 * auto-expire via `expirationTtl`.
 *
 * @param db               - Drizzle database client.
 * @param kv               - Cloudflare KV namespace binding.
 * @param diagramId        - UUID of the diagram to share.
 * @param createdBy        - UUID of the user creating the share link.
 * @param expiresInSeconds - Optional TTL in seconds. Omit for no expiry.
 * @returns An object containing the generated `token` and its `expiresAt` timestamp (or null).
 */
export async function createShareLink(
  db: Database,
  kv: KVNamespace,
  diagramId: string,
  createdBy: string,
  expiresInSeconds?: number,
) {
  const token = nanoid(SHARE_TOKEN_LENGTH);
  const now = nowISO();
  const expiresAt = expiresInSeconds
    ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    : null;

  const row = {
    id: generateId(),
    diagramId,
    token,
    createdBy,
    expiresAt,
    createdAt: now,
  };

  await db.insert(shareLinks).values(row);

  const kvMeta: ShareMeta = { diagramId, expiresAt };
  const kvOptions: KVNamespacePutOptions = {};
  if (expiresInSeconds) {
    kvOptions.expirationTtl = expiresInSeconds;
  }
  await kv.put(`share:${token}`, JSON.stringify(kvMeta), kvOptions);

  return { token, expiresAt };
}

/**
 * Resolve a share token to its diagram metadata.
 *
 * Looks up the token in KV first (fast, edge-local). If not found in KV
 * (e.g. due to eventual consistency lag), falls back to a D1 query. Returns
 * `null` if the token does not exist or has expired.
 *
 * @param kv    - Cloudflare KV namespace binding.
 * @param db    - Drizzle database client.
 * @param token - The share token from the URL path `/s/:token`.
 * @returns The share metadata (diagram ID and expiry), or `null` if invalid/expired.
 */
export async function resolveShareToken(
  kv: KVNamespace,
  db: Database,
  token: string,
): Promise<ShareMeta | null> {
  const kvVal = await kv.get(`share:${token}`);
  if (kvVal) {
    const meta: ShareMeta = JSON.parse(kvVal);
    if (meta.expiresAt && new Date(meta.expiresAt) < new Date()) {
      return null;
    }
    return meta;
  }

  const row = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, token))
    .get();

  if (!row) return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;

  return { diagramId: row.diagramId, expiresAt: row.expiresAt };
}

/**
 * Revoke a share link by deleting it from both D1 and KV.
 *
 * @param db    - Drizzle database client.
 * @param kv    - Cloudflare KV namespace binding.
 * @param token - The share token to revoke.
 */
export async function revokeShareLink(
  db: Database,
  kv: KVNamespace,
  token: string,
) {
  await db.delete(shareLinks).where(eq(shareLinks.token, token));
  await kv.delete(`share:${token}`);
}
