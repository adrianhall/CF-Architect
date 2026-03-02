/**
 * Repository for all `diagrams` table operations.
 *
 * Encapsulates every D1 query that touches the diagrams table so that API
 * route handlers never build Drizzle queries directly.
 */
import { eq, and, desc } from "drizzle-orm";
import { type Database } from "../db/client";
import { diagrams } from "../db/schema";
import { generateId, nowISO } from "../helpers";
import type {
  DiagramRow,
  PublicDiagramFields,
  CreateDiagramFields,
  UpdateDiagramFields,
} from "./types";

export class DiagramRepository {
  constructor(private db: Database) {}

  /** List all diagrams for a user, ordered by most recently updated. */
  async listByOwner(ownerId: string): Promise<DiagramRow[]> {
    const rows = await this.db
      .select()
      .from(diagrams)
      .where(eq(diagrams.ownerId, ownerId))
      .orderBy(desc(diagrams.updatedAt));

    return rows as DiagramRow[];
  }

  /** Load a single diagram scoped to its owner. */
  async getByIdAndOwner(
    id: string,
    ownerId: string,
  ): Promise<DiagramRow | undefined> {
    const row = await this.db
      .select()
      .from(diagrams)
      .where(and(eq(diagrams.id, id), eq(diagrams.ownerId, ownerId)))
      .get();

    return row as DiagramRow | undefined;
  }

  /** Load a single diagram by ID without an owner check (internal use). */
  async getById(id: string): Promise<DiagramRow | undefined> {
    const row = await this.db
      .select()
      .from(diagrams)
      .where(eq(diagrams.id, id))
      .get();

    return row as DiagramRow | undefined;
  }

  /** Load only the fields safe to expose on shared/public views. */
  async getPublicFields(id: string): Promise<PublicDiagramFields | undefined> {
    const row = await this.db
      .select({
        id: diagrams.id,
        title: diagrams.title,
        description: diagrams.description,
        graphData: diagrams.graphData,
      })
      .from(diagrams)
      .where(eq(diagrams.id, id))
      .get();

    return row as PublicDiagramFields | undefined;
  }

  /** Insert a new diagram and return the created row. */
  async create(input: CreateDiagramFields): Promise<DiagramRow> {
    const now = nowISO();
    const row: DiagramRow = {
      id: generateId(),
      ownerId: input.ownerId,
      title: input.title ?? "Untitled Diagram",
      description: input.description ?? null,
      graphData:
        input.graphData ??
        JSON.stringify({
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        }),
      thumbnailKey: null,
      blueprintId: input.blueprintId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(diagrams).values(row);
    return row;
  }

  /**
   * Update title and/or description. Returns the updated row, or
   * `undefined` if the diagram does not exist or is not owned by the user.
   */
  async updateMetadata(
    id: string,
    ownerId: string,
    fields: UpdateDiagramFields,
  ): Promise<DiagramRow | undefined> {
    const existing = await this.getByIdAndOwner(id, ownerId);
    if (!existing) return undefined;

    const updates: Record<string, unknown> = { updatedAt: nowISO() };
    if (fields.title !== undefined) updates.title = fields.title;
    if (fields.description !== undefined)
      updates.description = fields.description;

    await this.db.update(diagrams).set(updates).where(eq(diagrams.id, id));

    return (await this.db
      .select()
      .from(diagrams)
      .where(eq(diagrams.id, id))
      .get()) as DiagramRow | undefined;
  }

  /**
   * Autosave graph data. Returns the new `updatedAt` timestamp, or `null`
   * if the diagram does not exist or is not owned by the user.
   */
  async saveGraphData(
    id: string,
    ownerId: string,
    graphData: string,
  ): Promise<string | null> {
    const existing = await this.db
      .select({ id: diagrams.id })
      .from(diagrams)
      .where(and(eq(diagrams.id, id), eq(diagrams.ownerId, ownerId)))
      .get();

    if (!existing) return null;

    const now = nowISO();
    await this.db
      .update(diagrams)
      .set({ graphData, updatedAt: now })
      .where(eq(diagrams.id, id));

    return now;
  }

  /**
   * Delete a diagram row. Returns `true` if the diagram existed (and was
   * removed), `false` otherwise. Callers are responsible for cascading
   * share-link cleanup via {@link ShareRepository.revokeAllForDiagram}.
   */
  async remove(id: string, ownerId: string): Promise<boolean> {
    const existing = await this.getByIdAndOwner(id, ownerId);
    if (!existing) return false;

    await this.db.delete(diagrams).where(eq(diagrams.id, id));
    return true;
  }
}
