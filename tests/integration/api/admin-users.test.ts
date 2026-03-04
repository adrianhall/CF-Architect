import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createMockContext } from "../../helpers/mock-context";
import { TEST_USER_ID, jsonBody } from "../../helpers/fixtures";
import type { AppUser } from "@lib/auth/types";

const ADMIN_USER: AppUser = {
  id: TEST_USER_ID,
  email: "admin@example.com",
  displayName: "Admin",
  avatarUrl: null,
  isAdmin: true,
};

const mockList = vi.fn();
const mockDelete = vi.fn();
const mockSetAdmin = vi.fn();

vi.mock("@lib/repository", () => ({
  createRepositories: () => ({
    users: {
      list: (...args: unknown[]) => mockList(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      setAdmin: (...args: unknown[]) => mockSetAdmin(...args),
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function ctx(options: Parameters<typeof createMockContext>[0] = {}) {
  const context = createMockContext({
    user: ADMIN_USER,
    ...options,
  }) as APIContext;
  const urlString = options?.url ?? "http://localhost:4321/";
  (context as any).url = new URL(urlString);
  return context;
}

// ---------------------------------------------------------------------------
// GET /api/v1/admin/users
// ---------------------------------------------------------------------------

const { GET } = await import("@/pages/api/v1/admin/users/index");

describe("GET /api/v1/admin/users", () => {
  it("returns paginated user list", async () => {
    const mockResult = {
      users: [
        {
          id: "u1",
          email: "alice@example.com",
          displayName: "Alice",
          avatarUrl: null,
          isAdmin: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          diagramCount: 3,
          shareCount: 1,
        },
      ],
      total: 1,
    };
    mockList.mockResolvedValue(mockResult);

    const res = await GET(
      ctx({ url: "http://localhost:4321/api/v1/admin/users" }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.users).toHaveLength(1);
    expect(body.data.total).toBe(1);
  });

  it("passes query parameters to the repository", async () => {
    mockList.mockResolvedValue({ users: [], total: 0 });

    await GET(
      ctx({
        url: "http://localhost:4321/api/v1/admin/users?page=2&pageSize=10&sortBy=displayName&sortOrder=desc&search=alice",
      }),
    );

    expect(mockList).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      sortBy: "displayName",
      sortOrder: "desc",
      search: "alice",
    });
  });

  it("uses defaults for missing query parameters", async () => {
    mockList.mockResolvedValue({ users: [], total: 0 });

    await GET(ctx({ url: "http://localhost:4321/api/v1/admin/users" }));

    expect(mockList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      sortBy: "email",
      sortOrder: "asc",
      search: undefined,
    });
  });

  it("rejects invalid sortBy with default", async () => {
    mockList.mockResolvedValue({ users: [], total: 0 });

    await GET(
      ctx({
        url: "http://localhost:4321/api/v1/admin/users?sortBy=INVALID",
      }),
    );

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: "email" }),
    );
  });

  it("rejects invalid sortOrder with default", async () => {
    mockList.mockResolvedValue({ users: [], total: 0 });

    await GET(
      ctx({
        url: "http://localhost:4321/api/v1/admin/users?sortOrder=INVALID",
      }),
    );

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: "asc" }),
    );
  });

  it("clamps pageSize to maximum of 100", async () => {
    mockList.mockResolvedValue({ users: [], total: 0 });

    await GET(
      ctx({
        url: "http://localhost:4321/api/v1/admin/users?pageSize=500",
      }),
    );

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 100 }),
    );
  });

  it("clamps page to minimum of 1", async () => {
    mockList.mockResolvedValue({ users: [], total: 0 });

    await GET(
      ctx({
        url: "http://localhost:4321/api/v1/admin/users?page=-5",
      }),
    );

    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });

  it("falls back to defaults for non-numeric page and pageSize", async () => {
    mockList.mockResolvedValue({ users: [], total: 0 });

    await GET(
      ctx({
        url: "http://localhost:4321/api/v1/admin/users?page=abc&pageSize=xyz",
      }),
    );

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/admin/users/:id
// ---------------------------------------------------------------------------

const { DELETE, PATCH } = await import("@/pages/api/v1/admin/users/[id]");

describe("DELETE /api/v1/admin/users/:id", () => {
  it("returns 401 when user is not authenticated", async () => {
    const res = await DELETE(
      ctx({ method: "DELETE", params: { id: "u1" }, user: undefined }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("prevents self-deletion", async () => {
    const res = await DELETE(
      ctx({ method: "DELETE", params: { id: TEST_USER_ID } }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("SELF_ACTION");
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes another user successfully", async () => {
    mockDelete.mockResolvedValue(true);

    const res = await DELETE(
      ctx({ method: "DELETE", params: { id: "other-user" } }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.deleted).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith("other-user");
  });

  it("returns 404 when user does not exist", async () => {
    mockDelete.mockResolvedValue(false);

    const res = await DELETE(
      ctx({ method: "DELETE", params: { id: "nonexistent" } }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/users/:id
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/admin/users/:id", () => {
  it("returns 401 when user is not authenticated", async () => {
    const res = await PATCH(
      ctx({
        method: "PATCH",
        params: { id: "u1" },
        body: { isAdmin: true },
        user: undefined,
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("prevents self-demotion", async () => {
    const res = await PATCH(
      ctx({
        method: "PATCH",
        params: { id: TEST_USER_ID },
        body: { isAdmin: false },
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("SELF_ACTION");
    expect(mockSetAdmin).not.toHaveBeenCalled();
  });

  it("allows self-promotion (no-op but not blocked)", async () => {
    const updatedUser = { ...ADMIN_USER, isAdmin: true };
    mockSetAdmin.mockResolvedValue(updatedUser);

    const res = await PATCH(
      ctx({
        method: "PATCH",
        params: { id: TEST_USER_ID },
        body: { isAdmin: true },
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("promotes another user to admin", async () => {
    const updatedUser = {
      id: "other-user",
      email: "user@example.com",
      displayName: "User",
      avatarUrl: null,
      isAdmin: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    mockSetAdmin.mockResolvedValue(updatedUser);

    const res = await PATCH(
      ctx({
        method: "PATCH",
        params: { id: "other-user" },
        body: { isAdmin: true },
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.isAdmin).toBe(true);
    expect(mockSetAdmin).toHaveBeenCalledWith("other-user", true);
  });

  it("demotes another user", async () => {
    const updatedUser = {
      id: "other-user",
      email: "user@example.com",
      displayName: "User",
      avatarUrl: null,
      isAdmin: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    mockSetAdmin.mockResolvedValue(updatedUser);

    const res = await PATCH(
      ctx({
        method: "PATCH",
        params: { id: "other-user" },
        body: { isAdmin: false },
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.data.isAdmin).toBe(false);
    expect(mockSetAdmin).toHaveBeenCalledWith("other-user", false);
  });

  it("returns 404 when user does not exist", async () => {
    mockSetAdmin.mockResolvedValue(undefined);

    const res = await PATCH(
      ctx({
        method: "PATCH",
        params: { id: "nonexistent" },
        body: { isAdmin: true },
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid body", async () => {
    const res = await PATCH(
      ctx({
        method: "PATCH",
        params: { id: "other-user" },
        body: { isAdmin: "not-a-boolean" },
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for empty body", async () => {
    const res = await PATCH(
      ctx({
        method: "PATCH",
        params: { id: "other-user" },
        body: {},
      }),
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
