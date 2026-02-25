import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { createDb, type Database } from "./db/client";
import { shareLinks } from "./db/schema";
import { generateId, nowISO } from "./helpers";

const SHARE_TOKEN_LENGTH = 12;

interface ShareMeta {
  diagramId: string;
  expiresAt: string | null;
}

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

export async function revokeShareLink(
  db: Database,
  kv: KVNamespace,
  token: string,
) {
  await db.delete(shareLinks).where(eq(shareLinks.token, token));
  await kv.delete(`share:${token}`);
}
