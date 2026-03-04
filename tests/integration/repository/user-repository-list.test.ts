/**
 * Integration tests for UserRepository.list() against a real in-memory SQLite
 * database. The MockDatabase used elsewhere cannot simulate the subqueries,
 * left joins, aggregates, and dynamic conditions that list() relies on.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { UserRepository } from "@lib/repository/user-repository";
import { users, diagrams, shareLinks } from "@lib/db/schema";
import { createTestSqliteDb } from "../../helpers/sqlite-db";
import type { ListUsersOptions } from "@lib/repository";

type TestDb = ReturnType<typeof createTestSqliteDb>;

let db: TestDb;
let repo: UserRepository;

function seedUser(
  id: string,
  email: string,
  displayName: string,
  opts: { isAdmin?: boolean; createdAt?: string } = {},
) {
  const now = opts.createdAt ?? "2026-01-15T00:00:00.000Z";
  db.insert(users)
    .values({
      id,
      email,
      displayName,
      avatarUrl: null,
      isAdmin: opts.isAdmin ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

function seedDiagram(id: string, ownerId: string) {
  const now = "2026-01-15T00:00:00.000Z";
  db.insert(diagrams)
    .values({
      id,
      ownerId,
      title: "Test",
      description: null,
      graphData: "{}",
      thumbnailKey: null,
      blueprintId: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

function seedShareLink(id: string, diagramId: string, createdBy: string) {
  db.insert(shareLinks)
    .values({
      id,
      diagramId,
      token: `tok-${id}`,
      createdBy,
      expiresAt: null,
      createdAt: "2026-01-15T00:00:00.000Z",
    })
    .run();
}

const DEFAULTS: ListUsersOptions = {
  page: 1,
  pageSize: 20,
  sortBy: "email",
  sortOrder: "asc",
};

beforeEach(() => {
  db = createTestSqliteDb();
  repo = new UserRepository(db as any);
});

describe("UserRepository.list()", () => {
  it("returns an empty list when no users exist", async () => {
    const result = await repo.list(DEFAULTS);

    expect(result.users).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("returns all users with zero counts when they have no diagrams or shares", async () => {
    seedUser("u1", "alice@example.com", "Alice");
    seedUser("u2", "bob@example.com", "Bob");

    const result = await repo.list(DEFAULTS);

    expect(result.users).toHaveLength(2);
    expect(result.total).toBe(2);
    for (const user of result.users) {
      expect(user.diagramCount).toBe(0);
      expect(user.shareCount).toBe(0);
    }
  });

  it("computes correct diagramCount and shareCount per user", async () => {
    seedUser("u1", "alice@example.com", "Alice");
    seedUser("u2", "bob@example.com", "Bob");

    seedDiagram("d1", "u1");
    seedDiagram("d2", "u1");
    seedDiagram("d3", "u2");

    seedShareLink("s1", "d1", "u1");
    seedShareLink("s2", "d2", "u1");
    seedShareLink("s3", "d3", "u1");

    const result = await repo.list({ ...DEFAULTS, sortBy: "email" });

    const alice = result.users.find((u) => u.id === "u1")!;
    const bob = result.users.find((u) => u.id === "u2")!;

    expect(alice.diagramCount).toBe(2);
    expect(alice.shareCount).toBe(3);
    expect(bob.diagramCount).toBe(1);
    expect(bob.shareCount).toBe(0);
  });

  // -- Pagination -----------------------------------------------------------

  it("paginates results correctly", async () => {
    for (let i = 1; i <= 5; i++) {
      seedUser(`u${i}`, `user${i}@example.com`, `User ${i}`);
    }

    const page1 = await repo.list({ ...DEFAULTS, pageSize: 2, page: 1 });
    const page2 = await repo.list({ ...DEFAULTS, pageSize: 2, page: 2 });
    const page3 = await repo.list({ ...DEFAULTS, pageSize: 2, page: 3 });

    expect(page1.users).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page2.users).toHaveLength(2);
    expect(page3.users).toHaveLength(1);
  });

  it("returns empty page when offset exceeds total", async () => {
    seedUser("u1", "alice@example.com", "Alice");

    const result = await repo.list({ ...DEFAULTS, page: 10, pageSize: 20 });

    expect(result.users).toHaveLength(0);
    expect(result.total).toBe(1);
  });

  // -- Sorting --------------------------------------------------------------

  it("sorts by email ascending (default)", async () => {
    seedUser("u1", "charlie@example.com", "Charlie");
    seedUser("u2", "alice@example.com", "Alice");
    seedUser("u3", "bob@example.com", "Bob");

    const result = await repo.list({
      ...DEFAULTS,
      sortBy: "email",
      sortOrder: "asc",
    });

    const emails = result.users.map((u) => u.email);
    expect(emails).toEqual([
      "alice@example.com",
      "bob@example.com",
      "charlie@example.com",
    ]);
  });

  it("sorts by email descending", async () => {
    seedUser("u1", "alice@example.com", "Alice");
    seedUser("u2", "charlie@example.com", "Charlie");
    seedUser("u3", "bob@example.com", "Bob");

    const result = await repo.list({
      ...DEFAULTS,
      sortBy: "email",
      sortOrder: "desc",
    });

    const emails = result.users.map((u) => u.email);
    expect(emails).toEqual([
      "charlie@example.com",
      "bob@example.com",
      "alice@example.com",
    ]);
  });

  it("sorts by displayName", async () => {
    seedUser("u1", "a@example.com", "Zara");
    seedUser("u2", "b@example.com", "Abby");

    const result = await repo.list({
      ...DEFAULTS,
      sortBy: "displayName",
      sortOrder: "asc",
    });

    expect(result.users[0].displayName).toBe("Abby");
    expect(result.users[1].displayName).toBe("Zara");
  });

  it("sorts by createdAt", async () => {
    seedUser("u1", "old@example.com", "Old", {
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    seedUser("u2", "new@example.com", "New", {
      createdAt: "2026-06-01T00:00:00.000Z",
    });

    const asc = await repo.list({
      ...DEFAULTS,
      sortBy: "createdAt",
      sortOrder: "asc",
    });
    expect(asc.users[0].id).toBe("u1");

    const descResult = await repo.list({
      ...DEFAULTS,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(descResult.users[0].id).toBe("u2");
  });

  // -- Search ---------------------------------------------------------------

  it("filters users by partial email match", async () => {
    seedUser("u1", "alice@example.com", "Alice");
    seedUser("u2", "bob@corp.com", "Bob");
    seedUser("u3", "alice.jones@example.com", "Alice J");

    const result = await repo.list({ ...DEFAULTS, search: "alice" });

    expect(result.users).toHaveLength(2);
    expect(result.total).toBe(2);
    const ids = result.users.map((u) => u.id).sort();
    expect(ids).toEqual(["u1", "u3"]);
  });

  it("returns empty when search matches nothing", async () => {
    seedUser("u1", "alice@example.com", "Alice");

    const result = await repo.list({ ...DEFAULTS, search: "zzz" });

    expect(result.users).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("applies search and pagination together", async () => {
    for (let i = 1; i <= 5; i++) {
      seedUser(`u${i}`, `team${i}@corp.com`, `Team ${i}`);
    }
    seedUser("u99", "outsider@other.com", "Other");

    const result = await repo.list({
      ...DEFAULTS,
      search: "team",
      pageSize: 2,
      page: 1,
    });

    expect(result.users).toHaveLength(2);
    expect(result.total).toBe(5);
  });

  // -- Row shape ------------------------------------------------------------

  it("returns all expected fields on each user row", async () => {
    seedUser("u1", "alice@example.com", "Alice", { isAdmin: true });
    seedDiagram("d1", "u1");
    seedShareLink("s1", "d1", "u1");

    const result = await repo.list(DEFAULTS);
    const user = result.users[0];

    expect(user).toMatchObject({
      id: "u1",
      email: "alice@example.com",
      displayName: "Alice",
      avatarUrl: null,
      isAdmin: true,
      diagramCount: 1,
      shareCount: 1,
    });
    expect(user.createdAt).toBeTruthy();
    expect(user.updatedAt).toBeTruthy();
  });
});
