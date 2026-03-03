import { describe, it, expect, beforeEach } from "vitest";
import { ShareRepository } from "@lib/repository/share-repository";
import { diagrams, shareLinks } from "@lib/db/schema";
import { createMockDatabase, MockDatabase } from "../../../helpers/mock-db";
import { createMockKV, MockKV } from "../../../helpers/mock-kv";
import {
  TEST_USER_ID,
  makeDiagramRow,
  makeShareLinkRow,
} from "../../../helpers/fixtures";

let db: MockDatabase;
let kv: MockKV;
let repo: ShareRepository;

beforeEach(() => {
  db = createMockDatabase();
  db.registerTable(diagrams);
  db.registerTable(shareLinks);
  kv = createMockKV();
  repo = new ShareRepository(db as any, kv as unknown as KVNamespace);
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("create", () => {
  it("returns a token of length 12 and expiresAt", async () => {
    const result = await repo.create("diag-001", TEST_USER_ID);
    expect(result.token).toHaveLength(12);
    expect(result).toHaveProperty("expiresAt");
  });

  it("inserts a row into the share_links table", async () => {
    await repo.create("diag-001", TEST_USER_ID);
    const rows = db.getRows(shareLinks);
    expect(rows).toHaveLength(1);
    expect(rows[0].diagramId).toBe("diag-001");
    expect(rows[0].createdBy).toBe(TEST_USER_ID);
  });

  it("writes a KV entry at share:<token>", async () => {
    const result = await repo.create("diag-001", TEST_USER_ID);
    const kvVal = await kv.get(`share:${result.token}`);
    expect(kvVal).toBeTruthy();
    const meta = JSON.parse(kvVal!);
    expect(meta.diagramId).toBe("diag-001");
  });

  it("sets expirationTtl on KV when expiresInSeconds is provided", async () => {
    const result = await repo.create("diag-001", TEST_USER_ID, 3600);
    expect(result.expiresAt).toBeTruthy();
    expect(kv.ttls.get(`share:${result.token}`)).toBe(3600);
  });

  it("returns expiresAt: null when no TTL is provided", async () => {
    const result = await repo.create("diag-001", TEST_USER_ID);
    expect(result.expiresAt).toBeNull();
  });

  it("includes expiresAt in the KV metadata", async () => {
    const result = await repo.create("diag-001", TEST_USER_ID, 60);
    const meta = JSON.parse((await kv.get(`share:${result.token}`))!);
    expect(meta.expiresAt).toBe(result.expiresAt);
  });
});

// ---------------------------------------------------------------------------
// resolve
// ---------------------------------------------------------------------------

describe("resolve", () => {
  it("returns metadata from KV when present (fast path)", async () => {
    const meta = JSON.stringify({ diagramId: "diag-001", expiresAt: null });
    await kv.put("share:tok123", meta);

    const result = await repo.resolve("tok123");
    expect(result).toEqual({ diagramId: "diag-001", expiresAt: null });
  });

  it("falls back to D1 when KV returns null", async () => {
    db.seed(shareLinks, [
      makeShareLinkRow({
        id: "sl-1",
        diagramId: "diag-002",
        token: "fallback1",
      }),
    ]);

    const result = await repo.resolve("fallback1");
    expect(result).toEqual({ diagramId: "diag-002", expiresAt: null });
  });

  it("returns null for an expired token found in KV", async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    await kv.put(
      "share:expiredtok",
      JSON.stringify({ diagramId: "diag-001", expiresAt: expired }),
    );

    const result = await repo.resolve("expiredtok");
    expect(result).toBeNull();
  });

  it("returns null for an expired token found in D1", async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    db.seed(shareLinks, [
      makeShareLinkRow({
        id: "sl-2",
        token: "expdb",
        expiresAt: expired,
      }),
    ]);

    const result = await repo.resolve("expdb");
    expect(result).toBeNull();
  });

  it("returns null when token not found in KV or D1", async () => {
    const result = await repo.resolve("nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// revoke
// ---------------------------------------------------------------------------

describe("revoke", () => {
  it("deletes the row from D1", async () => {
    db.seed(shareLinks, [makeShareLinkRow({ id: "sl-3", token: "revokeme" })]);

    await repo.revoke("revokeme");
    expect(db.getRows(shareLinks)).toHaveLength(0);
  });

  it("deletes the KV entry", async () => {
    await kv.put("share:revokeme", "{}");
    db.seed(shareLinks, [makeShareLinkRow({ id: "sl-4", token: "revokeme" })]);

    await repo.revoke("revokeme");
    expect(await kv.get("share:revokeme")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getUnexpiredShareLinkInfo
// ---------------------------------------------------------------------------

describe("getUnexpiredShareLinkInfo", () => {
  it("returns token and expiresAt for a valid link", async () => {
    db.seed(shareLinks, [
      makeShareLinkRow({ diagramId: "d-1", token: "tok-active" }),
    ]);

    const info = await repo.getUnexpiredShareLinkInfo("d-1");
    expect(info).toEqual({ token: "tok-active", expiresAt: null });
  });

  it("returns link info when expiresAt is in the future", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    db.seed(shareLinks, [
      makeShareLinkRow({
        diagramId: "d-1",
        token: "tok-future",
        expiresAt: future,
      }),
    ]);

    const info = await repo.getUnexpiredShareLinkInfo("d-1");
    expect(info).not.toBeNull();
    expect(info!.token).toBe("tok-future");
  });

  it("returns null when the link is expired", async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    db.seed(shareLinks, [
      makeShareLinkRow({
        diagramId: "d-1",
        token: "tok-expired",
        expiresAt: expired,
      }),
    ]);

    const info = await repo.getUnexpiredShareLinkInfo("d-1");
    expect(info).toBeNull();
  });

  it("returns null when no link exists for the diagram", async () => {
    const info = await repo.getUnexpiredShareLinkInfo("d-missing");
    expect(info).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getByTokenDiagramAndCreator
// ---------------------------------------------------------------------------

describe("getByTokenDiagramAndCreator", () => {
  it("returns the share link row when all fields match", async () => {
    db.seed(shareLinks, [
      makeShareLinkRow({
        id: "sl-5",
        diagramId: "d-1",
        token: "tok-auth",
        createdBy: TEST_USER_ID,
      }),
    ]);

    const row = await repo.getByTokenDiagramAndCreator(
      "tok-auth",
      "d-1",
      TEST_USER_ID,
    );
    expect(row).toBeDefined();
    expect(row!.id).toBe("sl-5");
  });

  it("returns undefined when token does not match", async () => {
    db.seed(shareLinks, [
      makeShareLinkRow({ diagramId: "d-1", token: "tok-auth" }),
    ]);

    const row = await repo.getByTokenDiagramAndCreator(
      "wrong-token",
      "d-1",
      TEST_USER_ID,
    );
    expect(row).toBeUndefined();
  });

  it("returns undefined when diagram does not match", async () => {
    db.seed(shareLinks, [
      makeShareLinkRow({ diagramId: "d-1", token: "tok-auth" }),
    ]);

    const row = await repo.getByTokenDiagramAndCreator(
      "tok-auth",
      "d-other",
      TEST_USER_ID,
    );
    expect(row).toBeUndefined();
  });

  it("returns undefined when creator does not match", async () => {
    db.seed(shareLinks, [
      makeShareLinkRow({ diagramId: "d-1", token: "tok-auth" }),
    ]);

    const row = await repo.getByTokenDiagramAndCreator(
      "tok-auth",
      "d-1",
      "other-user",
    );
    expect(row).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// revokeAllForDiagram
// ---------------------------------------------------------------------------

describe("revokeAllForDiagram", () => {
  it("deletes all share links and KV entries for a diagram", async () => {
    db.seed(shareLinks, [
      makeShareLinkRow({ id: "sl-a", diagramId: "d-1", token: "tok-a" }),
      makeShareLinkRow({ id: "sl-b", diagramId: "d-1", token: "tok-b" }),
    ]);
    await kv.put(
      "share:tok-a",
      JSON.stringify({ diagramId: "d-1", expiresAt: null }),
    );
    await kv.put(
      "share:tok-b",
      JSON.stringify({ diagramId: "d-1", expiresAt: null }),
    );

    await repo.revokeAllForDiagram("d-1");

    expect(db.getRows(shareLinks)).toHaveLength(0);
    expect(kv.has("share:tok-a")).toBe(false);
    expect(kv.has("share:tok-b")).toBe(false);
  });

  it("does not affect share links for other diagrams", async () => {
    db.seed(shareLinks, [
      makeShareLinkRow({ id: "sl-a", diagramId: "d-1", token: "tok-a" }),
      makeShareLinkRow({ id: "sl-c", diagramId: "d-2", token: "tok-c" }),
    ]);

    await repo.revokeAllForDiagram("d-1");

    expect(db.getRows(shareLinks)).toHaveLength(1);
    expect(db.getRows(shareLinks)[0].token).toBe("tok-c");
  });

  it("is a no-op when there are no share links", async () => {
    await repo.revokeAllForDiagram("d-missing");
    expect(db.getRows(shareLinks)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// loadDiagramFromShareLink
// ---------------------------------------------------------------------------

describe("loadDiagramFromShareLink", () => {
  it("resolves a token and returns public diagram fields", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1", title: "Shared Diagram" })]);
    await kv.put(
      "share:tok-load",
      JSON.stringify({ diagramId: "d-1", expiresAt: null }),
    );

    const result = await repo.loadDiagramFromShareLink("tok-load");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("d-1");
    expect(result!.title).toBe("Shared Diagram");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("graphData");
    expect(result).not.toHaveProperty("ownerId");
  });

  it("returns null when the token is invalid", async () => {
    const result = await repo.loadDiagramFromShareLink("bad-token");
    expect(result).toBeNull();
  });

  it("returns null when the token is expired", async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    await kv.put(
      "share:tok-exp",
      JSON.stringify({ diagramId: "d-1", expiresAt: expired }),
    );

    const result = await repo.loadDiagramFromShareLink("tok-exp");
    expect(result).toBeNull();
  });

  it("returns null when the diagram no longer exists", async () => {
    await kv.put(
      "share:tok-orphan",
      JSON.stringify({ diagramId: "d-deleted", expiresAt: null }),
    );

    const result = await repo.loadDiagramFromShareLink("tok-orphan");
    expect(result).toBeNull();
  });

  it("falls back to D1 when KV misses and returns diagram", async () => {
    db.seed(diagrams, [makeDiagramRow({ id: "d-1" })]);
    db.seed(shareLinks, [
      makeShareLinkRow({ diagramId: "d-1", token: "tok-d1" }),
    ]);

    const result = await repo.loadDiagramFromShareLink("tok-d1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("d-1");
  });
});
