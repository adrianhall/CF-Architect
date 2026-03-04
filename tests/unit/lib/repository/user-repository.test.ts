import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRepository } from "@lib/repository/user-repository";
import { users, diagrams, shareLinks } from "@lib/db/schema";
import { createMockDatabase, MockDatabase } from "../../../helpers/mock-db";
import { makeDiagramRow, makeShareLinkRow } from "../../../helpers/fixtures";

let db: MockDatabase;
let repo: UserRepository;

vi.mock("@lib/helpers", async (importOriginal) => {
  const original = await importOriginal<typeof import("@lib/helpers")>();
  let callCount = 0;
  return {
    ...original,
    generateId: () => `generated-uuid-${++callCount}`,
  };
});

beforeEach(() => {
  db = createMockDatabase();
  db.registerTable(users);
  db.registerTable(diagrams);
  db.registerTable(shareLinks);
  repo = new UserRepository(db as any);
});

describe("upsert", () => {
  it("creates a new user when email is not found", async () => {
    const user = await repo.upsert("alice@example.com", "Alice", null);

    expect(user.id).toBeTruthy();
    expect(user.email).toBe("alice@example.com");
    expect(user.displayName).toBe("Alice");
    expect(user.avatarUrl).toBeNull();
    expect(user.createdAt).toBeTruthy();
    expect(user.updatedAt).toBeTruthy();
    expect(db.getRows(users)).toHaveLength(1);
  });

  it("first user gets isAdmin true", async () => {
    const user = await repo.upsert("admin@example.com", "Admin", null);
    expect(user.isAdmin).toBe(true);
  });

  it("second user gets isAdmin false", async () => {
    await repo.upsert("first@example.com", "First", null);
    const second = await repo.upsert("second@example.com", "Second", null);
    expect(second.isAdmin).toBe(false);
  });

  it("returns existing user and updates profile when email already exists", async () => {
    const first = await repo.upsert("bob@example.com", "Bob", null);
    const updated = await repo.upsert(
      "bob@example.com",
      "Robert",
      "https://avatar.example.com/bob.png",
    );

    expect(updated.id).toBe(first.id);
    expect(updated.displayName).toBe("Robert");
    expect(updated.avatarUrl).toBe("https://avatar.example.com/bob.png");
    expect(db.getRows(users)).toHaveLength(1);
  });

  it("does not change isAdmin on subsequent upserts", async () => {
    const admin = await repo.upsert("admin@example.com", "Admin", null);
    expect(admin.isAdmin).toBe(true);

    const sameAdmin = await repo.upsert(
      "admin@example.com",
      "Admin Updated",
      null,
    );
    expect(sameAdmin.isAdmin).toBe(true);
  });

  it("second call with same email does not duplicate rows", async () => {
    await repo.upsert("dup@example.com", "Dup", null);
    await repo.upsert("dup@example.com", "Dup Again", null);
    expect(db.getRows(users)).toHaveLength(1);
  });
});

describe("getById", () => {
  it("returns the user when found", async () => {
    const created = await repo.upsert("alice@example.com", "Alice", null);
    const found = await repo.getById(created.id);

    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
    expect(found!.email).toBe("alice@example.com");
  });

  it("returns undefined when user does not exist", async () => {
    const found = await repo.getById("nonexistent-id");
    expect(found).toBeUndefined();
  });
});

describe("delete", () => {
  it("returns false when user does not exist", async () => {
    const result = await repo.delete("nonexistent-id");
    expect(result).toBe(false);
  });

  it("removes the user row and returns true", async () => {
    const user = await repo.upsert("alice@example.com", "Alice", null);
    const result = await repo.delete(user.id);

    expect(result).toBe(true);
    expect(db.getRows(users)).toHaveLength(0);
  });

  it("cascade-deletes diagrams owned by the user", async () => {
    const user = await repo.upsert("alice@example.com", "Alice", null);
    db.seed(diagrams, [
      makeDiagramRow({ id: "d-1", ownerId: user.id }),
      makeDiagramRow({ id: "d-2", ownerId: user.id }),
    ]);

    await repo.delete(user.id);

    expect(db.getRows(diagrams)).toHaveLength(0);
  });

  it("cascade-deletes share links on the user's diagrams", async () => {
    const user = await repo.upsert("alice@example.com", "Alice", null);
    db.seed(diagrams, [makeDiagramRow({ id: "d-1", ownerId: user.id })]);
    db.seed(shareLinks, [
      makeShareLinkRow({ id: "sl-1", diagramId: "d-1", createdBy: user.id }),
    ]);

    await repo.delete(user.id);

    expect(db.getRows(shareLinks)).toHaveLength(0);
    expect(db.getRows(diagrams)).toHaveLength(0);
  });

  it("does not delete other users or their diagrams", async () => {
    const alice = await repo.upsert("alice@example.com", "Alice", null);
    await repo.upsert("bob@example.com", "Bob", null);
    db.seed(diagrams, [
      makeDiagramRow({ id: "d-alice", ownerId: alice.id }),
      makeDiagramRow({ id: "d-bob", ownerId: "other-user" }),
    ]);

    await repo.delete(alice.id);

    expect(db.getRows(users)).toHaveLength(1);
    expect(db.getRows(diagrams)).toHaveLength(1);
    expect(db.getRows(diagrams)[0].id).toBe("d-bob");
  });
});

describe("setAdmin", () => {
  it("returns undefined when user does not exist", async () => {
    const result = await repo.setAdmin("nonexistent-id", true);
    expect(result).toBeUndefined();
  });

  it("promotes a regular user to admin", async () => {
    await repo.upsert("first@example.com", "First", null);
    const user = await repo.upsert("bob@example.com", "Bob", null);
    expect(user.isAdmin).toBe(false);

    const updated = await repo.setAdmin(user.id, true);

    expect(updated).toBeDefined();
    expect(updated!.isAdmin).toBe(true);
  });

  it("demotes an admin to regular user", async () => {
    const admin = await repo.upsert("admin@example.com", "Admin", null);
    expect(admin.isAdmin).toBe(true);

    const updated = await repo.setAdmin(admin.id, false);

    expect(updated).toBeDefined();
    expect(updated!.isAdmin).toBe(false);
  });

  it("returns a valid updatedAt timestamp", async () => {
    const user = await repo.upsert("bob@example.com", "Bob", null);

    const updated = await repo.setAdmin(user.id, true);

    expect(updated!.updatedAt).toBeTruthy();
    expect(new Date(updated!.updatedAt).toISOString()).toBe(updated!.updatedAt);
  });

  it("persists the change in the database", async () => {
    const user = await repo.upsert("bob@example.com", "Bob", null);
    await repo.setAdmin(user.id, true);

    const row = db.getRows(users).find((r) => r.id === user.id);
    expect(row!.isAdmin).toBe(true);
  });
});
