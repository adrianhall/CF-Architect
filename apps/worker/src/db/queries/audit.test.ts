import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { upsertUser } from "./users.js";
import { insertAuditEntry, listAuditEntries } from "./audit.js";

async function seedUser(sub: string, email: string) {
  return upsertUser({ d1: env.DB, sub, email });
}

describe("insertAuditEntry + listAuditEntries", () => {
  let actorSub: string;

  beforeEach(async () => {
    actorSub = `actor-${crypto.randomUUID()}`;
    await seedUser(actorSub, `actor-${actorSub.slice(0, 8)}@example.com`);
  });

  it("inserts an audit row and returns it in the list", async () => {
    const targetId = `target-${crypto.randomUUID()}`;
    await insertAuditEntry({
      d1: env.DB,
      actorId: actorSub,
      action: "promote",
      targetId,
      payload: { previousRole: "user" },
    });

    const result = await listAuditEntries({ d1: env.DB, page: 1, limit: 50 });
    const entry = result.entries.find((e) => e.targetId === targetId);

    expect(entry).toBeDefined();
    expect(entry?.action).toBe("promote");
    expect(entry?.actorId).toBe(actorSub);
    expect(entry?.payloadJson).toContain("previousRole");
  });

  it("lists entries in descending order by at", async () => {
    const targets = [`t-${crypto.randomUUID()}`, `t-${crypto.randomUUID()}`];
    for (const targetId of targets) {
      await insertAuditEntry({
        d1: env.DB,
        actorId: actorSub,
        action: "delete",
        targetId,
      });
      // Tiny delay so timestamps differ.
      await new Promise((r) => setTimeout(r, 2));
    }

    const result = await listAuditEntries({ d1: env.DB, page: 1, limit: 50 });
    const timestamps = result.entries.map((e) => e.at);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]!).toBeGreaterThanOrEqual(timestamps[i]!);
    }
  });

  it("includes the actor email in the response", async () => {
    const targetId = `t-email-${crypto.randomUUID()}`;
    await insertAuditEntry({
      d1: env.DB,
      actorId: actorSub,
      action: "demote",
      targetId,
    });

    const result = await listAuditEntries({ d1: env.DB, page: 1, limit: 50 });
    const entry = result.entries.find((e) => e.targetId === targetId);
    expect(entry?.actorEmail).toMatch(/@example\.com$/);
  });

  it("paginates correctly", async () => {
    // Insert 5 entries for a fresh actor.
    const freshActor = `actor-page-${crypto.randomUUID()}`;
    await seedUser(freshActor, `paginator-${freshActor.slice(0, 8)}@example.com`);

    for (let i = 0; i < 5; i++) {
      await insertAuditEntry({
        d1: env.DB,
        actorId: freshActor,
        action: "promote",
        targetId: `page-target-${i}`,
      });
    }

    const page1 = await listAuditEntries({ d1: env.DB, page: 1, limit: 3 });
    const page2 = await listAuditEntries({ d1: env.DB, page: 2, limit: 3 });

    expect(page1.entries.length).toBe(3);
    const ids1 = new Set(page1.entries.map((e) => e.id));
    page2.entries.forEach((e) => expect(ids1.has(e.id)).toBe(false));
  });
});
