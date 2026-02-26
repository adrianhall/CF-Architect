import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { MockDatabase } from "../../helpers/mock-db";
import { MockKV } from "../../helpers/mock-kv";
import { createMockContext } from "../../helpers/mock-context";
import {
  makeDiagramRow,
  SAMPLE_GRAPH_DATA,
  jsonBody,
} from "../../helpers/fixtures";
import { diagrams } from "@lib/db/schema";

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

const { PUT } = await import("@/pages/api/v1/diagrams/[id]/graph");

function ctx(options: Parameters<typeof createMockContext>[0] = {}) {
  return createMockContext({
    db: mockDb,
    kv: mockKv,
    ...options,
  }) as APIContext;
}

describe("PUT /api/v1/diagrams/:id/graph", () => {
  it("updates graphData on the diagram", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-graph" })]);

    await PUT(
      ctx({
        method: "PUT",
        params: { id: "d-graph" },
        body: { graphData: SAMPLE_GRAPH_DATA },
      }),
    );

    const row = mockDb.getRows(diagrams).find((r) => r.id === "d-graph");
    expect(row?.graphData).toBe(SAMPLE_GRAPH_DATA);
  });

  it("updates the updatedAt timestamp", async () => {
    const old = "2020-01-01T00:00:00.000Z";
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-graph", updatedAt: old })]);

    await PUT(
      ctx({
        method: "PUT",
        params: { id: "d-graph" },
        body: { graphData: "{}" },
      }),
    );

    const row = mockDb.getRows(diagrams).find((r) => r.id === "d-graph");
    expect(row?.updatedAt).not.toBe(old);
  });

  it("returns { ok: true, data: { updatedAt } }", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-graph" })]);

    const res = await PUT(
      ctx({
        method: "PUT",
        params: { id: "d-graph" },
        body: { graphData: "{}" },
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.updatedAt).toBeTruthy();
  });

  it("is idempotent (same payload twice produces same result)", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-graph" })]);
    const payload = { graphData: SAMPLE_GRAPH_DATA };

    const res1 = await PUT(
      ctx({ method: "PUT", params: { id: "d-graph" }, body: payload }),
    );
    const res2 = await PUT(
      ctx({ method: "PUT", params: { id: "d-graph" }, body: payload }),
    );

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const row = mockDb.getRows(diagrams).find((r) => r.id === "d-graph");
    expect(row?.graphData).toBe(SAMPLE_GRAPH_DATA);
  });

  it("returns 404 for non-existent diagram", async () => {
    const res = await PUT(
      ctx({
        method: "PUT",
        params: { id: "missing" },
        body: { graphData: "{}" },
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing graphData", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-graph" })]);

    const res = await PUT(
      ctx({ method: "PUT", params: { id: "d-graph" }, body: {} }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for non-string graphData", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-graph" })]);

    const res = await PUT(
      ctx({
        method: "PUT",
        params: { id: "d-graph" },
        body: { graphData: 123 },
      }),
    );
    expect(res.status).toBe(400);
  });
});
