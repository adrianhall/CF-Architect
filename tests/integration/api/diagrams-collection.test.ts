import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { MockDatabase } from "../../helpers/mock-db";
import { MockKV } from "../../helpers/mock-kv";
import { createMockContext } from "../../helpers/mock-context";
import { makeDiagramRow, jsonBody } from "../../helpers/fixtures";
import { diagrams } from "@lib/db/schema";
import { SEED_USER_ID } from "@lib/auth/types";

let mockDb: MockDatabase;
let mockKv: MockKV;

vi.mock("@lib/db/client", () => ({
  createDb: () => mockDb,
}));

beforeEach(() => {
  mockDb = new MockDatabase();
  mockDb.registerTable(diagrams);
  mockKv = new MockKV();
});

// Lazy import so the vi.mock takes effect first
const { GET, POST } = await import("@/pages/api/v1/diagrams/index");

function ctx(options: Parameters<typeof createMockContext>[0] = {}) {
  return createMockContext({
    db: mockDb,
    kv: mockKv,
    ...options,
  }) as APIContext;
}

// ---------------------------------------------------------------------------
// GET (list)
// ---------------------------------------------------------------------------

describe("GET /api/v1/diagrams", () => {
  it("returns empty list when no diagrams exist", async () => {
    const res = await GET(ctx());
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: [] });
  });

  it("returns diagrams sorted by updatedAt descending", async () => {
    mockDb.seed(diagrams, [
      makeDiagramRow({ id: "d1", updatedAt: "2026-01-01T00:00:00.000Z" }),
      makeDiagramRow({ id: "d2", updatedAt: "2026-02-01T00:00:00.000Z" }),
    ]);

    const res = await GET(ctx());
    const body = await jsonBody(res);

    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe("d2");
    expect(body.data[1].id).toBe("d1");
  });

  it("only returns diagrams owned by locals.user.id", async () => {
    mockDb.seed(diagrams, [
      makeDiagramRow({ id: "mine", ownerId: SEED_USER_ID }),
      makeDiagramRow({ id: "theirs", ownerId: "other-user" }),
    ]);

    const res = await GET(ctx());
    const body = await jsonBody(res);

    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("mine");
  });

  it("response has Content-Type application/json", async () => {
    const res = await GET(ctx());
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });
});

// ---------------------------------------------------------------------------
// POST (create)
// ---------------------------------------------------------------------------

describe("POST /api/v1/diagrams", () => {
  it("creates a diagram with default title when title omitted", async () => {
    const res = await POST(ctx({ method: "POST", body: {} }));
    const body = await jsonBody(res);

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.title).toBe("Untitled Diagram");
  });

  it("creates a diagram with provided title and description", async () => {
    const res = await POST(
      ctx({
        method: "POST",
        body: { title: "My Diagram", description: "Hello" },
      }),
    );
    const body = await jsonBody(res);

    expect(body.data.title).toBe("My Diagram");
    expect(body.data.description).toBe("Hello");
  });

  it("new diagram has a generated UUID id and correct ownerId", async () => {
    const res = await POST(ctx({ method: "POST", body: {} }));
    const body = await jsonBody(res);

    expect(body.data.id).toBeTruthy();
    expect(body.data.ownerId).toBe(SEED_USER_ID);
  });

  it("new diagram has default empty graph data", async () => {
    const res = await POST(ctx({ method: "POST", body: {} }));
    const body = await jsonBody(res);
    const graph = JSON.parse(body.data.graphData);

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("returns 404 for non-existent blueprintId", async () => {
    const res = await POST(
      ctx({ method: "POST", body: { blueprintId: "nonexistent" } }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid body (title too long)", async () => {
    const res = await POST(
      ctx({ method: "POST", body: { title: "x".repeat(256) } }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
