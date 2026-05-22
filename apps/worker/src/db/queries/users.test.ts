import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { upsertUser, getUserById, setUserRole, deleteUser, listUsers } from "./users.js";

// The vitest-pool-workers pool exposes env.DB as a real in-memory D1 instance
// that has the migrations applied (configured in apps/worker/vitest.config.ts).

describe("upsertUser", () => {
  it("creates a new user row on first call", async () => {
    const user = await upsertUser({
      d1: env.DB,
      sub: "sub-create-test",
      email: "create@example.com",
      name: "Create Test",
    });

    expect(user.id).toBe("sub-create-test");
    expect(user.email).toBe("create@example.com");
    expect(user.name).toBe("Create Test");
    expect(user.role).toBe("user");
    expect(user.createdAt).toBeGreaterThan(0);
    expect(user.lastLoginAt).toBe(user.createdAt);
  });

  it("is idempotent — second call updates lastLoginAt only, not role", async () => {
    const sub = "sub-idempotent";
    const first = await upsertUser({ d1: env.DB, sub, email: "idempotent@example.com" });

    // Promote manually then re-upsert — role must not change.
    await setUserRole({ d1: env.DB, targetId: sub, role: "admin" });

    // Small delay to ensure timestamps differ.
    await new Promise((r) => setTimeout(r, 2));

    const second = await upsertUser({ d1: env.DB, sub, email: "idempotent@example.com" });

    expect(second.role).toBe("admin"); // must not overwrite
    expect(second.lastLoginAt).toBeGreaterThanOrEqual(first.lastLoginAt);
  });

  it("promotes to admin only on first INSERT when seedAdminEmail matches", async () => {
    const sub = "sub-seed-admin";
    const email = "seedadmin@example.com";

    const user = await upsertUser({
      d1: env.DB,
      sub,
      email,
      seedAdminEmail: "SEEDADMIN@EXAMPLE.COM", // case-insensitive
    });

    expect(user.role).toBe("admin");
  });

  it("does NOT re-promote on subsequent login even if seedAdminEmail matches", async () => {
    const sub = "sub-no-repromote";
    const email = "norepromote@example.com";

    // First login — creates row and promotes.
    await upsertUser({ d1: env.DB, sub, email, seedAdminEmail: email });

    // Demote manually.
    await setUserRole({ d1: env.DB, targetId: sub, role: "user" });

    // Second login — must NOT re-promote.
    const user = await upsertUser({ d1: env.DB, sub, email, seedAdminEmail: email });

    expect(user.role).toBe("user");
  });

  it("does not promote when seedAdminEmail does not match", async () => {
    const user = await upsertUser({
      d1: env.DB,
      sub: "sub-no-match",
      email: "nomatch@example.com",
      seedAdminEmail: "different@example.com",
    });

    expect(user.role).toBe("user");
  });
});

describe("getUserById", () => {
  it("returns null for an unknown id", async () => {
    const result = await getUserById({ d1: env.DB, id: "nonexistent" });
    expect(result).toBeNull();
  });

  it("returns the row for a known id", async () => {
    await upsertUser({ d1: env.DB, sub: "sub-get", email: "get@example.com" });
    const result = await getUserById({ d1: env.DB, id: "sub-get" });
    expect(result).not.toBeNull();
    expect(result?.email).toBe("get@example.com");
  });
});

describe("setUserRole", () => {
  it("updates the role and returns the updated row", async () => {
    await upsertUser({ d1: env.DB, sub: "sub-role", email: "role@example.com" });
    const updated = await setUserRole({ d1: env.DB, targetId: "sub-role", role: "admin" });
    expect(updated?.role).toBe("admin");
  });
});

describe("deleteUser", () => {
  it("removes the user row", async () => {
    await upsertUser({ d1: env.DB, sub: "sub-delete", email: "delete@example.com" });
    await deleteUser({ d1: env.DB, targetId: "sub-delete" });
    const result = await getUserById({ d1: env.DB, id: "sub-delete" });
    expect(result).toBeNull();
  });
});

describe("listUsers", () => {
  beforeEach(async () => {
    // Seed a small set for list tests.
    for (const [sub, email, name] of [
      ["sub-list-a", "alice@example.com", "Alice"],
      ["sub-list-b", "bob@example.com", "Bob"],
      ["sub-list-c", "carol@example.com", "Carol"],
    ]) {
      await upsertUser({ d1: env.DB, sub, email, name });
    }
  });

  it("returns all rows with total count", async () => {
    const result = await listUsers({
      d1: env.DB,
      page: 1,
      limit: 100,
      sort: "email",
      order: "asc",
    });
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.rows.length).toBeGreaterThanOrEqual(3);
  });

  it("filters by query string (email match)", async () => {
    const result = await listUsers({
      d1: env.DB,
      page: 1,
      limit: 100,
      sort: "email",
      order: "asc",
      q: "alice",
    });
    expect(result.rows.every((r) => r.email.includes("alice"))).toBe(true);
  });

  it("paginates correctly", async () => {
    const page1 = await listUsers({
      d1: env.DB,
      page: 1,
      limit: 2,
      sort: "email",
      order: "asc",
    });
    const page2 = await listUsers({
      d1: env.DB,
      page: 2,
      limit: 2,
      sort: "email",
      order: "asc",
    });
    expect(page1.rows.length).toBe(2);
    // IDs on page 2 must not overlap with page 1.
    const ids1 = new Set(page1.rows.map((r) => r.id));
    page2.rows.forEach((r) => expect(ids1.has(r.id)).toBe(false));
  });
});
