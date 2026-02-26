import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { MockDatabase } from "../../helpers/mock-db";
import { MockKV } from "../../helpers/mock-kv";
import { createMockContext } from "../../helpers/mock-context";
import { makeDiagramRow, jsonBody } from "../../helpers/fixtures";
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

const { GET } = await import("@/pages/api/v1/share/[token]");

function ctx(options: Parameters<typeof createMockContext>[0] = {}) {
  return createMockContext({
    db: mockDb,
    kv: mockKv,
    ...options,
  }) as APIContext;
}

describe("GET /api/v1/share/:token", () => {
  it("returns diagram data for a valid token", async () => {
    mockDb.seed(diagrams, [
      makeDiagramRow({
        id: "d-shared",
        title: "Shared Diagram",
        description: "desc",
        graphData: '{"nodes":[]}',
      }),
    ]);
    await mockKv.put(
      "share:validtok",
      JSON.stringify({ diagramId: "d-shared", expiresAt: null }),
    );

    const res = await GET(ctx({ params: { token: "validtok" } }));
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe("d-shared");
    expect(body.data.title).toBe("Shared Diagram");
    expect(body.data.description).toBe("desc");
    expect(body.data.graphData).toBe('{"nodes":[]}');
  });

  it("returns 404 for an unknown token", async () => {
    const res = await GET(ctx({ params: { token: "unknown" } }));
    const body = await jsonBody(res);

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("returns 404 for an expired token", async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    await mockKv.put(
      "share:expiredtok",
      JSON.stringify({ diagramId: "d-shared", expiresAt: expired }),
    );

    const res = await GET(ctx({ params: { token: "expiredtok" } }));
    expect(res.status).toBe(404);
  });

  it("does not return ownerId, thumbnailKey, blueprintId, or timestamps", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-shared" })]);
    await mockKv.put(
      "share:selecttok",
      JSON.stringify({ diagramId: "d-shared", expiresAt: null }),
    );

    const res = await GET(ctx({ params: { token: "selecttok" } }));
    const body = await jsonBody(res);

    expect(body.data).not.toHaveProperty("ownerId");
    expect(body.data).not.toHaveProperty("thumbnailKey");
    expect(body.data).not.toHaveProperty("blueprintId");
    expect(body.data).not.toHaveProperty("createdAt");
    expect(body.data).not.toHaveProperty("updatedAt");
  });
});
