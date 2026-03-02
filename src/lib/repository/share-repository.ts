/**
 * Repository for all `share_links` table and KV operations.
 *
 * Encapsulates share-link creation, resolution, and revocation so that
 * API route handlers never interact with D1 or KV directly for share
 * link concerns.
 */
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { type Database } from "../db/client";
import { diagrams, shareLinks } from "../db/schema";
import { generateId, nowISO } from "../helpers";
import type {
  ShareMeta,
  ShareLinkResult,
  ShareLinkInfo,
  ShareLinkRow,
  PublicDiagramFields,
} from "./types";

const SHARE_TOKEN_LENGTH = 12;

const ShareMetaSchema = z.object({
  diagramId: z.string(),
  expiresAt: z.string().nullable(),
});

export class ShareRepository {
  constructor(
    private db: Database,
    private kv: KVNamespace,
  ) {}

  /**
   * Create a new share link for a diagram.
   *
   * Generates a random URL-safe token, persists a row in D1, and writes
   * metadata to KV for fast edge resolution.
   */
  async create(
    diagramId: string,
    createdBy: string,
    expiresInSeconds?: number,
  ): Promise<ShareLinkResult> {
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

    await this.db.insert(shareLinks).values(row);

    const kvMeta: ShareMeta = { diagramId, expiresAt };
    const kvOptions: KVNamespacePutOptions = {};
    if (expiresInSeconds) {
      kvOptions.expirationTtl = expiresInSeconds;
    }
    await this.kv.put(`share:${token}`, JSON.stringify(kvMeta), kvOptions);

    return { token, expiresAt };
  }

  /**
   * Resolve a share token to its diagram metadata.
   *
   * Checks KV first (fast path), then falls back to D1. Returns `null`
   * if the token does not exist or has expired.
   */
  async resolve(token: string): Promise<ShareMeta | null> {
    const kvVal = await this.kv.get(`share:${token}`);
    if (kvVal) {
      const meta = ShareMetaSchema.parse(JSON.parse(kvVal) as unknown);
      if (meta.expiresAt && new Date(meta.expiresAt) < new Date()) {
        return null;
      }
      return meta;
    }

    const row = await this.db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.token, token))
      .get();

    if (!row) return null;
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;

    return { diagramId: row.diagramId, expiresAt: row.expiresAt };
  }

  /** Delete a share link from both D1 and KV. */
  async revoke(token: string): Promise<void> {
    await this.db.delete(shareLinks).where(eq(shareLinks.token, token));
    await this.kv.delete(`share:${token}`);
  }

  /**
   * Find an active (non-expired) share link for a diagram.
   *
   * Returns the token and expiry info if one exists, or `null` if there
   * is no current share link for this diagram.
   */
  async getUnexpiredShareLinkInfo(
    diagramId: string,
  ): Promise<ShareLinkInfo | null> {
    const link = await this.db
      .select({ token: shareLinks.token, expiresAt: shareLinks.expiresAt })
      .from(shareLinks)
      .where(eq(shareLinks.diagramId, diagramId))
      .get();

    if (!link) return null;
    if (link.expiresAt && new Date(link.expiresAt) <= new Date()) return null;

    return { token: link.token, expiresAt: link.expiresAt };
  }

  /** Look up a share link by token, diagram, and creator for authorization. */
  async getByTokenDiagramAndCreator(
    token: string,
    diagramId: string,
    createdBy: string,
  ): Promise<ShareLinkRow | undefined> {
    const row = await this.db
      .select()
      .from(shareLinks)
      .where(
        and(
          eq(shareLinks.token, token),
          eq(shareLinks.diagramId, diagramId),
          eq(shareLinks.createdBy, createdBy),
        ),
      )
      .get();

    return row as ShareLinkRow | undefined;
  }

  /**
   * Cascade-delete all share links for a diagram, including their KV
   * entries. Call this before deleting the diagram row itself.
   */
  async revokeAllForDiagram(diagramId: string): Promise<void> {
    const links = await this.db
      .select({ token: shareLinks.token })
      .from(shareLinks)
      .where(eq(shareLinks.diagramId, diagramId));

    for (const link of links) {
      await this.kv.delete(`share:${link.token}`);
    }

    await this.db.delete(shareLinks).where(eq(shareLinks.diagramId, diagramId));
  }

  /**
   * Resolve a share token and load the associated diagram's public fields
   * in a single operation. Returns `null` if the token is invalid/expired
   * or the diagram no longer exists.
   */
  async loadDiagramFromShareLink(
    token: string,
  ): Promise<PublicDiagramFields | null> {
    const meta = await this.resolve(token);
    if (!meta) return null;

    const row = await this.db
      .select({
        id: diagrams.id,
        title: diagrams.title,
        description: diagrams.description,
        graphData: diagrams.graphData,
      })
      .from(diagrams)
      .where(eq(diagrams.id, meta.diagramId))
      .get();

    return (row as PublicDiagramFields | undefined) ?? null;
  }
}
