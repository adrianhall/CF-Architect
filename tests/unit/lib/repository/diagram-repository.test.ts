import { describe, it, expect, beforeEach } from "vitest";
import { DiagramRepository } from "@lib/repository/diagram-repository";
import { diagrams } from "@lib/db/schema";
import { createMockDatabase, MockDatabase } from "../../../helpers/mock-db";
import { SEED_USER_ID } from "@lib/auth/types";
import { makeDiagramRow } from "../../../helpers/fixtures";

let db: MockDatabase;
let repo: DiagramRepository;

beforeEach(() => {
  db = createMockDatabase();
  db.registerTable(diagrams);
  repo = new DiagramRepository(db as any);
});

// ---------------------------------------------------------------------------
// listByOwner
// ---------------------------------------------------------------------------

describe("listByOwner", () => {
  it("returns all diagrams for the given owner", async () => {
    db.seed(diagrams, [
      makeDiagramRow({ id: "d-1" }),
      makeDiagramRow({ id: "d-2" }),
    ]);

    const rows = await repo.listByOwner(SEED_USER_ID);
    expect(rows).toHaveLength(2);
  });

  it("excludes diagrams owned by other users", async () => {
    db.seed(diagrams, [
      makeDiagramRow({ id: "d-1" }),
      makeDiagramRow({ id: "d-other", ownerId: "other-user" }),
    ]);

    const rows = await repo.listByOwner(SEED_USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("d-1");
  });

  it("returns empty array when no diagrams exist", async () => {
    const rows = await repo.listByOwner(SEED_USER_ID);
    expect(rows).toHaveLength(0);
  });

  it("orders results by updatedAt descending", async () => {
    db.seed(diagrams, [
      makeDiagramRow({ id: "d-old", updatedAt: "2020-01-01T00:00:00.000Z" }),
      makeDiagramRow({ id: "d-new", updatedAt: "2025-01-01T00:00:00.000Z" }),
    ]);

    const rows = await repo.listByOwner(SEED_USER_ID);
    expect(rows[0].id).toBe("d-new");
    expect(rows[1].id).toBe("d-old");
  });
});

// ---------------------------------------------------------------------------
// getByIdAndOwner
// ---------------------------------------------------------------------------

describe("getByIdAndOwner", () => {
  it("returns the diagram when it exists and matches owner", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1" })]);

    const row = await repo.getByIdAndOwner("d-1", SEED_USER_ID);
    expect(row).toBeDefined();
    expect(row!.id).toBe("d-1");
  });

  it("returns undefined when diagram does not exist", async () => {
    const row = await repo.getByIdAndOwner("missing", SEED_USER_ID);
    expect(row).toBeUndefined();
  });

  it("returns undefined when diagram belongs to another user", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1", ownerId: "other-user" })]);

    const row = await repo.getByIdAndOwner("d-1", SEED_USER_ID);
    expect(row).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

describe("getById", () => {
  it("returns the diagram regardless of owner", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1", ownerId: "other-user" })]);

    const row = await repo.getById("d-1");
    expect(row).toBeDefined();
    expect(row!.id).toBe("d-1");
  });

  it("returns undefined when diagram does not exist", async () => {
    const row = await repo.getById("missing");
    expect(row).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getPublicFields
// ---------------------------------------------------------------------------

describe("getPublicFields", () => {
  it("returns only id, title, description, and graphData", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1", title: "My Diagram" })]);

    const row = await repo.getPublicFields("d-1");
    expect(row).toBeDefined();
    expect(row!.id).toBe("d-1");
    expect(row!.title).toBe("My Diagram");
    expect(row).toHaveProperty("description");
    expect(row).toHaveProperty("graphData");
    expect(row).not.toHaveProperty("ownerId");
    expect(row).not.toHaveProperty("createdAt");
  });

  it("returns undefined for non-existent diagram", async () => {
    const row = await repo.getPublicFields("missing");
    expect(row).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("create", () => {
  it("inserts a row and returns it with generated id and timestamps", async () => {
    const row = await repo.create({
      ownerId: SEED_USER_ID,
      title: "New Diagram",
    });

    expect(row.id).toBeTruthy();
    expect(row.ownerId).toBe(SEED_USER_ID);
    expect(row.title).toBe("New Diagram");
    expect(row.createdAt).toBeTruthy();
    expect(row.updatedAt).toBeTruthy();
    expect(db.getRows(diagrams)).toHaveLength(1);
  });

  it("defaults title to 'Untitled Diagram' when omitted", async () => {
    const row = await repo.create({ ownerId: SEED_USER_ID });
    expect(row.title).toBe("Untitled Diagram");
  });

  it("defaults graphData to empty graph when omitted", async () => {
    const row = await repo.create({ ownerId: SEED_USER_ID });
    const graph = JSON.parse(row.graphData);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("uses provided graphData when specified", async () => {
    const graphData = JSON.stringify({
      nodes: [{ id: "n1" }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    const row = await repo.create({ ownerId: SEED_USER_ID, graphData });
    expect(row.graphData).toBe(graphData);
  });

  it("sets blueprintId when provided", async () => {
    const row = await repo.create({
      ownerId: SEED_USER_ID,
      blueprintId: "simple-worker",
    });
    expect(row.blueprintId).toBe("simple-worker");
  });

  it("defaults description and blueprintId to null", async () => {
    const row = await repo.create({ ownerId: SEED_USER_ID });
    expect(row.description).toBeNull();
    expect(row.blueprintId).toBeNull();
    expect(row.thumbnailKey).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateMetadata
// ---------------------------------------------------------------------------

describe("updateMetadata", () => {
  it("updates the title and returns the updated row", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1" })]);

    const updated = await repo.updateMetadata("d-1", SEED_USER_ID, {
      title: "New Title",
    });
    expect(updated).toBeDefined();
    expect(updated!.title).toBe("New Title");
  });

  it("updates the description", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1" })]);

    const updated = await repo.updateMetadata("d-1", SEED_USER_ID, {
      description: "New Desc",
    });
    expect(updated!.description).toBe("New Desc");
  });

  it("clears description with null", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1", description: "old desc" })]);

    const updated = await repo.updateMetadata("d-1", SEED_USER_ID, {
      description: null,
    });
    expect(updated!.description).toBeNull();
  });

  it("updates the updatedAt timestamp", async () => {
    const oldDate = "2020-01-01T00:00:00.000Z";
    db.seed(diagrams, [makeDiagramRow({ id: "d-1", updatedAt: oldDate })]);

    const updated = await repo.updateMetadata("d-1", SEED_USER_ID, {
      title: "T",
    });
    expect(updated!.updatedAt).not.toBe(oldDate);
  });

  it("returns undefined for non-existent diagram", async () => {
    const result = await repo.updateMetadata("missing", SEED_USER_ID, {
      title: "T",
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined when diagram belongs to another user", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1", ownerId: "other-user" })]);

    const result = await repo.updateMetadata("d-1", SEED_USER_ID, {
      title: "T",
    });
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// saveGraphData
// ---------------------------------------------------------------------------

describe("saveGraphData", () => {
  it("updates graphData and returns the new updatedAt", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1" })]);

    const updatedAt = await repo.saveGraphData(
      "d-1",
      SEED_USER_ID,
      '{"nodes":[],"edges":[],"viewport":{"x":1,"y":2,"zoom":3}}',
    );
    expect(updatedAt).toBeTruthy();

    const row = await repo.getById("d-1");
    expect(JSON.parse(row!.graphData).viewport.zoom).toBe(3);
  });

  it("returns null for non-existent diagram", async () => {
    const result = await repo.saveGraphData("missing", SEED_USER_ID, "{}");
    expect(result).toBeNull();
  });

  it("returns null when diagram belongs to another user", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1", ownerId: "other-user" })]);

    const result = await repo.saveGraphData("d-1", SEED_USER_ID, "{}");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe("remove", () => {
  it("deletes the diagram and returns true", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1" })]);

    const result = await repo.remove("d-1", SEED_USER_ID);
    expect(result).toBe(true);
    expect(db.getRows(diagrams)).toHaveLength(0);
  });

  it("returns false for non-existent diagram", async () => {
    const result = await repo.remove("missing", SEED_USER_ID);
    expect(result).toBe(false);
  });

  it("returns false when diagram belongs to another user", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1", ownerId: "other-user" })]);

    const result = await repo.remove("d-1", SEED_USER_ID);
    expect(result).toBe(false);
    expect(db.getRows(diagrams)).toHaveLength(1);
  });
});
