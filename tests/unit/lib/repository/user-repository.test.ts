import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRepository } from "@lib/repository/user-repository";
import { users } from "@lib/db/schema";
import { createMockDatabase, MockDatabase } from "../../../helpers/mock-db";

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
