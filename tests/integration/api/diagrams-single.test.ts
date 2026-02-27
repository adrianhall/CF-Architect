import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { MockDatabase } from "../../helpers/mock-db";
import { MockKV } from "../../helpers/mock-kv";
import { createMockContext } from "../../helpers/mock-context";
import {
  makeDiagramRow,
  makeShareLinkRow,
  jsonBody,
} from "../../helpers/fixtures";
import { diagrams, shareLinks } from "@lib/db/schema";

let mockDb: MockDatabase;
let mockKv: MockKV;

vi.mock("@lib/db/client", () => ({
  createDb: () => mockDb,
}));

beforeEach(() => {
  mockDb = new MockDatabase();
  mockDb.registerTable(diagrams);
  mockDb.registerTable(shareLinks);
  mockKv = new MockKV();
});

const { GET, PATCH, DELETE } = await import("@/pages/api/v1/diagrams/[id]");

function ctx(options: Parameters<typeof createMockContext>[0] = {}) {
  return createMockContext({
    db: mockDb,
    kv: mockKv,
    ...options,
  }) as APIContext;
}

// ---------------------------------------------------------------------------
// GET (single)
// ---------------------------------------------------------------------------

describe("GET /api/v1/diagrams/:id", () => {
  it("returns the diagram matching params.id", async () => {
    const row = makeDiagramRow({ id: "d-get" });
    mockDb.seed(diagrams, [row]);

    const res = await GET(ctx({ params: { id: "d-get" } }));
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe("d-get");
  });

  it("returns 404 when diagram does not exist", async () => {
    const res = await GET(ctx({ params: { id: "missing" } }));
    const body = await jsonBody(res);

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when diagram belongs to a different user", async () => {
    mockDb.seed(diagrams, [
      makeDiagramRow({ id: "d-other", ownerId: "other-user" }),
    ]);

    const res = await GET(ctx({ params: { id: "d-other" } }));
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH (update metadata)
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/diagrams/:id", () => {
  it("updates title only", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-patch" })]);

    const res = await PATCH(
      ctx({
        method: "PATCH",
        params: { id: "d-patch" },
        body: { title: "New Title" },
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.data.title).toBe("New Title");
  });

  it("updates description only", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-patch" })]);

    const res = await PATCH(
      ctx({
        method: "PATCH",
        params: { id: "d-patch" },
        body: { description: "New desc" },
      }),
    );
    const body = await jsonBody(res);

    expect(body.data.description).toBe("New desc");
  });

  it("clears description with null", async () => {
    mockDb.seed(diagrams, [
      makeDiagramRow({ id: "d-patch", description: "old" }),
    ]);

    const res = await PATCH(
      ctx({
        method: "PATCH",
        params: { id: "d-patch" },
        body: { description: null },
      }),
    );
    const body = await jsonBody(res);

    expect(body.data.description).toBeNull();
  });

  it("updates the updatedAt timestamp", async () => {
    const old = "2020-01-01T00:00:00.000Z";
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-patch", updatedAt: old })]);

    const res = await PATCH(
      ctx({ method: "PATCH", params: { id: "d-patch" }, body: { title: "T" } }),
    );
    const body = await jsonBody(res);

    expect(body.data.updatedAt).not.toBe(old);
  });

  it("returns 404 for non-existent diagram", async () => {
    const res = await PATCH(
      ctx({ method: "PATCH", params: { id: "missing" }, body: { title: "T" } }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid body (empty title)", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-patch" })]);

    const res = await PATCH(
      ctx({ method: "PATCH", params: { id: "d-patch" }, body: { title: "" } }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/diagrams/:id", () => {
  it("returns 204 with empty body", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-del" })]);

    const res = await DELETE(
      ctx({ method: "DELETE", params: { id: "d-del" } }),
    );
    expect(res.status).toBe(204);
  });

  it("diagram is no longer retrievable after delete", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-del" })]);

    await DELETE(ctx({ method: "DELETE", params: { id: "d-del" } }));

    const res = await GET(ctx({ params: { id: "d-del" } }));
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent diagram", async () => {
    const res = await DELETE(
      ctx({ method: "DELETE", params: { id: "missing" } }),
    );
    expect(res.status).toBe(404);
  });

  it("deletes associated share links and KV entries when diagram has shares", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-del-cascade" })]);
    mockDb.seed(shareLinks, [
      makeShareLinkRow({
        id: "sl-1",
        diagramId: "d-del-cascade",
        token: "tok-aaa",
      }),
      makeShareLinkRow({
        id: "sl-2",
        diagramId: "d-del-cascade",
        token: "tok-bbb",
      }),
    ]);
    await mockKv.put(
      "share:tok-aaa",
      JSON.stringify({ diagramId: "d-del-cascade", expiresAt: null }),
    );
    await mockKv.put(
      "share:tok-bbb",
      JSON.stringify({ diagramId: "d-del-cascade", expiresAt: null }),
    );

    const res = await DELETE(
      ctx({ method: "DELETE", params: { id: "d-del-cascade" } }),
    );

    expect(res.status).toBe(204);
    expect(mockDb.getRows(shareLinks)).toHaveLength(0);
    expect(mockKv.has("share:tok-aaa")).toBe(false);
    expect(mockKv.has("share:tok-bbb")).toBe(false);
  });
});
