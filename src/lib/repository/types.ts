/**
 * Shared type definitions for the repository layer.
 *
 * These types describe the shapes returned by repository methods and are
 * intentionally decoupled from Drizzle internals so that consumers (API
 * routes, Astro pages) depend only on plain data interfaces.
 */

/** Full diagram row as stored in D1. */
export interface DiagramRow {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  graphData: string;
  thumbnailKey: string | null;
  blueprintId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Subset of diagram fields exposed to unauthenticated shared views. */
export interface PublicDiagramFields {
  id: string;
  title: string;
  description: string | null;
  graphData: string;
}

/** Metadata stored in KV alongside a share token for fast edge resolution. */
export interface ShareMeta {
  diagramId: string;
  expiresAt: string | null;
}

/** Result returned when a new share link is created. */
export interface ShareLinkResult {
  token: string;
  expiresAt: string | null;
}

/** Info about an existing, non-expired share link. */
export interface ShareLinkInfo {
  token: string;
  expiresAt: string | null;
}

/** Full share link row as stored in D1. */
export interface ShareLinkRow {
  id: string;
  diagramId: string;
  token: string;
  createdBy: string;
  expiresAt: string | null;
  createdAt: string;
}

/** Fields accepted when creating a new diagram. */
export interface CreateDiagramFields {
  ownerId: string;
  title?: string;
  description?: string | null;
  graphData?: string;
  blueprintId?: string | null;
}

/** Fields that can be updated on an existing diagram. */
export interface UpdateDiagramFields {
  title?: string;
  description?: string | null;
}
