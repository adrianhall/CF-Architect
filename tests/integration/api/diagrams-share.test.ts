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
import { SEED_USER_ID } from "@lib/auth/types";

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

const { POST, DELETE } = await import("@/pages/api/v1/diagrams/[id]/share");

function ctx(options: Parameters<typeof createMockContext>[0] = {}) {
  return createMockContext({
    db: mockDb,
    kv: mockKv,
    ...options,
  }) as APIContext;
}

// ---------------------------------------------------------------------------
// POST (create share)
// ---------------------------------------------------------------------------

describe("POST /api/v1/diagrams/:id/share", () => {
  it("returns 201 with token, expiresAt, and url", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-share" })]);

    const res = await POST(
      ctx({
        method: "POST",
        url: "http://localhost:4321/api/v1/diagrams/d-share/share",
        params: { id: "d-share" },
        body: {},
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.token).toBeTruthy();
    expect(body.data).toHaveProperty("expiresAt");
    expect(body.data.url).toContain(`/s/${body.data.token}`);
  });

  it("token is a non-empty string", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-share" })]);

    const res = await POST(
      ctx({
        method: "POST",
        url: "http://localhost:4321/api/v1/diagrams/d-share/share",
        params: { id: "d-share" },
        body: {},
      }),
    );
    const body = await jsonBody(res);

    expect(typeof body.data.token).toBe("string");
    expect(body.data.token.length).toBeGreaterThan(0);
  });

  it("accepts optional expiresIn parameter", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-share" })]);

    const res = await POST(
      ctx({
        method: "POST",
        url: "http://localhost:4321/api/v1/diagrams/d-share/share",
        params: { id: "d-share" },
        body: { expiresIn: 3600 },
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(201);
    expect(body.data.expiresAt).toBeTruthy();
  });

  it("returns existing share link on subsequent calls (idempotent)", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-share" })]);

    const res1 = await POST(
      ctx({
        method: "POST",
        url: "http://localhost:4321/api/v1/diagrams/d-share/share",
        params: { id: "d-share" },
        body: {},
      }),
    );
    const body1 = await jsonBody(res1);
    expect(res1.status).toBe(201);

    const res2 = await POST(
      ctx({
        method: "POST",
        url: "http://localhost:4321/api/v1/diagrams/d-share/share",
        params: { id: "d-share" },
        body: {},
      }),
    );
    const body2 = await jsonBody(res2);

    expect(res2.status).toBe(200);
    expect(body2.data.token).toBe(body1.data.token);
    expect(body2.data.url).toBe(body1.data.url);
  });

  it("returns 404 for non-existent diagram", async () => {
    const res = await POST(
      ctx({
        method: "POST",
        url: "http://localhost:4321/api/v1/diagrams/missing/share",
        params: { id: "missing" },
        body: {},
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid expiresIn", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-share" })]);

    const res = await POST(
      ctx({
        method: "POST",
        url: "http://localhost:4321/api/v1/diagrams/d-share/share",
        params: { id: "d-share" },
        body: { expiresIn: -1 },
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ---------------------------------------------------------------------------
// DELETE (revoke share)
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/diagrams/:id/share", () => {
  it("returns 204 on successful revocation", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-share" })]);
    mockDb.seed(shareLinks, [
      makeShareLinkRow({
        diagramId: "d-share",
        token: "tok123",
        createdBy: SEED_USER_ID,
      }),
    ]);
    await mockKv.put(
      "share:tok123",
      JSON.stringify({ diagramId: "d-share", expiresAt: null }),
    );

    const res = await DELETE(
      ctx({
        method: "DELETE",
        url: "http://localhost:4321/api/v1/diagrams/d-share/share?token=tok123",
        params: { id: "d-share" },
      }),
    );

    expect(res.status).toBe(204);
  });

  it("returns 400 when token query parameter is missing", async () => {
    const res = await DELETE(
      ctx({
        method: "DELETE",
        url: "http://localhost:4321/api/v1/diagrams/d-share/share",
        params: { id: "d-share" },
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when token does not exist", async () => {
    mockDb.seed(diagrams, [makeDiagramRow({ id: "d-share" })]);

    const res = await DELETE(
      ctx({
        method: "DELETE",
        url: "http://localhost:4321/api/v1/diagrams/d-share/share?token=nonexistent",
        params: { id: "d-share" },
      }),
    );

    expect(res.status).toBe(404);
  });
});
