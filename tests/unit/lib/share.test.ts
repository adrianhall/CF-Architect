import { describe, it, expect, beforeEach } from "vitest";
import {
  createShareLink,
  resolveShareToken,
  revokeShareLink,
} from "@lib/share";
import { shareLinks } from "@lib/db/schema";
import { createMockDatabase, MockDatabase } from "../../helpers/mock-db";
import { createMockKV, MockKV } from "../../helpers/mock-kv";
import { SEED_USER_ID } from "@lib/auth/types";

let db: MockDatabase;
let kv: MockKV;

beforeEach(() => {
  db = createMockDatabase();
  db.registerTable(shareLinks);
  kv = createMockKV();
});

// ---------------------------------------------------------------------------
// createShareLink
// ---------------------------------------------------------------------------

describe("createShareLink", () => {
  it("returns a token of length 12 and an expiresAt field", async () => {
    const result = await createShareLink(
      db as any,
      kv as unknown as KVNamespace,
      "diag-001",
      SEED_USER_ID,
    );
    expect(result.token).toHaveLength(12);
    expect(result).toHaveProperty("expiresAt");
  });

  it("inserts a row into the share_links table", async () => {
    await createShareLink(
      db as any,
      kv as unknown as KVNamespace,
      "diag-001",
      SEED_USER_ID,
    );
    const rows = db.getRows(shareLinks);
    expect(rows).toHaveLength(1);
    expect(rows[0].diagramId).toBe("diag-001");
    expect(rows[0].createdBy).toBe(SEED_USER_ID);
  });

  it("writes a KV entry at share:<token>", async () => {
    const result = await createShareLink(
      db as any,
      kv as unknown as KVNamespace,
      "diag-001",
      SEED_USER_ID,
    );
    const kvVal = await kv.get(`share:${result.token}`);
    expect(kvVal).toBeTruthy();
    const meta = JSON.parse(kvVal!);
    expect(meta.diagramId).toBe("diag-001");
  });

  it("sets expirationTtl on KV when expiresInSeconds is provided", async () => {
    const result = await createShareLink(
      db as any,
      kv as unknown as KVNamespace,
      "diag-001",
      SEED_USER_ID,
      3600,
    );
    expect(result.expiresAt).toBeTruthy();
    expect(kv.ttls.get(`share:${result.token}`)).toBe(3600);
  });

  it("returns expiresAt: null when no TTL is provided", async () => {
    const result = await createShareLink(
      db as any,
      kv as unknown as KVNamespace,
      "diag-001",
      SEED_USER_ID,
    );
    expect(result.expiresAt).toBeNull();
  });

  it("includes expiresAt in the KV metadata", async () => {
    const result = await createShareLink(
      db as any,
      kv as unknown as KVNamespace,
      "diag-001",
      SEED_USER_ID,
      60,
    );
    const meta = JSON.parse((await kv.get(`share:${result.token}`))!);
    expect(meta.expiresAt).toBe(result.expiresAt);
  });
});

// ---------------------------------------------------------------------------
// resolveShareToken
// ---------------------------------------------------------------------------

describe("resolveShareToken", () => {
  it("returns metadata from KV when present (fast path)", async () => {
    const meta = JSON.stringify({ diagramId: "diag-001", expiresAt: null });
    await kv.put("share:tok123", meta);

    const result = await resolveShareToken(
      kv as unknown as KVNamespace,
      db as any,
      "tok123",
    );
    expect(result).toEqual({ diagramId: "diag-001", expiresAt: null });
  });

  it("falls back to D1 when KV returns null", async () => {
    db.seed(shareLinks, [
      {
        id: "sl-1",
        diagramId: "diag-002",
        token: "fallback1",
        createdBy: SEED_USER_ID,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    const result = await resolveShareToken(
      kv as unknown as KVNamespace,
      db as any,
      "fallback1",
    );
    expect(result).toEqual({ diagramId: "diag-002", expiresAt: null });
  });

  it("returns null for an expired token found in KV", async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    await kv.put(
      "share:expiredtok",
      JSON.stringify({ diagramId: "diag-001", expiresAt: expired }),
    );

    const result = await resolveShareToken(
      kv as unknown as KVNamespace,
      db as any,
      "expiredtok",
    );
    expect(result).toBeNull();
  });

  it("returns null for an expired token found in D1", async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    db.seed(shareLinks, [
      {
        id: "sl-2",
        diagramId: "diag-001",
        token: "expdb",
        createdBy: SEED_USER_ID,
        expiresAt: expired,
        createdAt: new Date().toISOString(),
      },
    ]);

    const result = await resolveShareToken(
      kv as unknown as KVNamespace,
      db as any,
      "expdb",
    );
    expect(result).toBeNull();
  });

  it("returns null when token not found in KV or D1", async () => {
    const result = await resolveShareToken(
      kv as unknown as KVNamespace,
      db as any,
      "nonexistent",
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// revokeShareLink
// ---------------------------------------------------------------------------

describe("revokeShareLink", () => {
  it("deletes the row from D1", async () => {
    db.seed(shareLinks, [
      {
        id: "sl-3",
        diagramId: "diag-001",
        token: "revokeme",
        createdBy: SEED_USER_ID,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    await revokeShareLink(db as any, kv as unknown as KVNamespace, "revokeme");
    expect(db.getRows(shareLinks)).toHaveLength(0);
  });

  it("deletes the KV entry at share:<token>", async () => {
    await kv.put("share:revokeme", "{}");
    db.seed(shareLinks, [
      {
        id: "sl-4",
        diagramId: "diag-001",
        token: "revokeme",
        createdBy: SEED_USER_ID,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    await revokeShareLink(db as any, kv as unknown as KVNamespace, "revokeme");
    expect(await kv.get("share:revokeme")).toBeNull();
  });
});
