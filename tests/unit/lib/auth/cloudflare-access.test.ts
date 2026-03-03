import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJwtVerify = vi.fn();
vi.mock("jose", () => ({
  createRemoteJWKSet: () => "mock-jwks",
  jwtVerify: (...args: any[]) => mockJwtVerify(...args),
}));

const mockUpsert = vi.fn();
vi.mock("@lib/repository", () => ({
  createRepositories: () => ({
    users: { upsert: mockUpsert },
  }),
}));

import { cloudflareAccessAuth } from "@lib/auth/cloudflare-access";

const TEST_ENV = {
  CF_ACCESS_TEAM_DOMAIN: "myteam",
  DB: {} as D1Database,
  KV: {} as KVNamespace,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cloudflareAccessAuth.resolveUser", () => {
  it("returns null when Cf-Access-Jwt-Assertion header is missing", async () => {
    const request = new Request("http://localhost:4321/dashboard");
    const result = await cloudflareAccessAuth.resolveUser(
      request,
      TEST_ENV as any,
    );
    expect(result).toBeNull();
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  it("verifies the JWT and upserts the user on success", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        email: "user@example.com",
        name: "Test User",
      },
    });
    const dbUser = {
      id: "db-uuid-1",
      email: "user@example.com",
      displayName: "Test User",
      avatarUrl: null,
      isAdmin: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockUpsert.mockResolvedValue(dbUser);

    const request = new Request("http://localhost:4321/dashboard", {
      headers: { "cf-access-jwt-assertion": "valid.jwt.token" },
    });

    const result = await cloudflareAccessAuth.resolveUser(
      request,
      TEST_ENV as any,
    );

    expect(mockJwtVerify).toHaveBeenCalledWith("valid.jwt.token", "mock-jwks", {
      issuer: "https://myteam.cloudflareaccess.com",
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      "user@example.com",
      "Test User",
      null,
    );
    expect(result).toEqual({
      id: "db-uuid-1",
      email: "user@example.com",
      displayName: "Test User",
      avatarUrl: null,
      isAdmin: false,
    });
  });

  it("returns null when JWT verification fails", async () => {
    mockJwtVerify.mockRejectedValue(new Error("Invalid signature"));

    const request = new Request("http://localhost:4321/dashboard", {
      headers: { "cf-access-jwt-assertion": "bad.jwt.token" },
    });

    const result = await cloudflareAccessAuth.resolveUser(
      request,
      TEST_ENV as any,
    );
    expect(result).toBeNull();
  });

  it("returns null when JWT payload has no email", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: "some-id" },
    });

    const request = new Request("http://localhost:4321/dashboard", {
      headers: { "cf-access-jwt-assertion": "no-email.jwt.token" },
    });

    const result = await cloudflareAccessAuth.resolveUser(
      request,
      TEST_ENV as any,
    );
    expect(result).toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("falls back to custom.name when name is not in payload root", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        email: "custom@example.com",
        custom: { name: "Custom Name" },
      },
    });
    const dbUser = {
      id: "db-uuid-2",
      email: "custom@example.com",
      displayName: "Custom Name",
      avatarUrl: null,
      isAdmin: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockUpsert.mockResolvedValue(dbUser);

    const request = new Request("http://localhost:4321/dashboard", {
      headers: { "cf-access-jwt-assertion": "custom.jwt.token" },
    });

    const result = await cloudflareAccessAuth.resolveUser(
      request,
      TEST_ENV as any,
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      "custom@example.com",
      "Custom Name",
      null,
    );
    expect(result).not.toBeNull();
  });

  it("passes null displayName when neither name nor custom.name exists", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { email: "noname@example.com" },
    });
    const dbUser = {
      id: "db-uuid-3",
      email: "noname@example.com",
      displayName: null,
      avatarUrl: null,
      isAdmin: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockUpsert.mockResolvedValue(dbUser);

    const request = new Request("http://localhost:4321/dashboard", {
      headers: { "cf-access-jwt-assertion": "minimal.jwt.token" },
    });

    await cloudflareAccessAuth.resolveUser(request, TEST_ENV as any);
    expect(mockUpsert).toHaveBeenCalledWith("noname@example.com", null, null);
  });
});
