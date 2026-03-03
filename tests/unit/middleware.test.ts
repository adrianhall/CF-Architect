import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("astro:middleware", () => ({
  defineMiddleware: (handler: any) => handler,
}));

const mockResolveUser = vi.fn();
vi.mock("@lib/auth/cloudflare-access", () => ({
  cloudflareAccessAuth: {
    resolveUser: (...args: any[]) => mockResolveUser(...args),
  },
}));

const mockUpsert = vi.fn();
vi.mock("@lib/repository", () => ({
  createRepositories: () => ({
    users: { upsert: mockUpsert },
  }),
}));

import { onRequest } from "../../src/middleware";

function createContext(url: string, env: Record<string, unknown> = {}) {
  return {
    request: new Request(url),
    locals: {
      user: undefined as any,
      runtime: {
        env: {
          DB: {},
          KV: {},
          ...env,
        },
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("onRequest middleware", () => {
  describe("public routes", () => {
    it("calls next() for the homepage without auth", async () => {
      const ctx = createContext("http://localhost:4321/");
      const next = vi.fn().mockResolvedValue(new Response("ok"));

      await onRequest(ctx as any, next);

      expect(next).toHaveBeenCalled();
      expect(mockResolveUser).not.toHaveBeenCalled();
    });

    it("calls next() for /blueprints without auth", async () => {
      const ctx = createContext("http://localhost:4321/blueprints");
      const next = vi.fn().mockResolvedValue(new Response("ok"));

      await onRequest(ctx as any, next);

      expect(next).toHaveBeenCalled();
      expect(mockResolveUser).not.toHaveBeenCalled();
    });

    it("calls next() for /s/token without auth", async () => {
      const ctx = createContext("http://localhost:4321/s/abc123");
      const next = vi.fn().mockResolvedValue(new Response("ok"));

      await onRequest(ctx as any, next);

      expect(next).toHaveBeenCalled();
      expect(mockResolveUser).not.toHaveBeenCalled();
    });
  });

  describe("protected routes with valid JWT", () => {
    it("sets locals.user from resolved user on /dashboard", async () => {
      const user = {
        id: "u1",
        email: "user@example.com",
        displayName: "User",
        avatarUrl: null,
        isAdmin: false,
      };
      mockResolveUser.mockResolvedValue(user);
      const ctx = createContext("http://localhost:4321/dashboard");
      const next = vi.fn().mockResolvedValue(new Response("ok"));

      await onRequest(ctx as any, next);

      expect(ctx.locals.user).toBe(user);
      expect(next).toHaveBeenCalled();
    });

    it("sets locals.user on /api/v1/ routes", async () => {
      const user = {
        id: "u1",
        email: "user@example.com",
        displayName: "User",
        avatarUrl: null,
        isAdmin: false,
      };
      mockResolveUser.mockResolvedValue(user);
      const ctx = createContext("http://localhost:4321/api/v1/diagrams");
      const next = vi.fn().mockResolvedValue(new Response("ok"));

      await onRequest(ctx as any, next);

      expect(ctx.locals.user).toBe(user);
      expect(next).toHaveBeenCalled();
    });

    it("sets locals.user on /diagram/:id routes", async () => {
      const user = {
        id: "u1",
        email: "user@example.com",
        displayName: "User",
        avatarUrl: null,
        isAdmin: false,
      };
      mockResolveUser.mockResolvedValue(user);
      const ctx = createContext("http://localhost:4321/diagram/abc-123");
      const next = vi.fn().mockResolvedValue(new Response("ok"));

      await onRequest(ctx as any, next);

      expect(ctx.locals.user).toBe(user);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("protected routes with DEV_MODE", () => {
    it("upserts dev user and logs warning when JWT missing and DEV_MODE is set", async () => {
      mockResolveUser.mockResolvedValue(null);
      const devUser = {
        id: "dev-id",
        email: "dev@localhost",
        displayName: "Dev User",
        avatarUrl: null,
        isAdmin: true,
      };
      mockUpsert.mockResolvedValue(devUser);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const ctx = createContext("http://localhost:4321/dashboard", {
        DEV_MODE: "true",
      });
      const next = vi.fn().mockResolvedValue(new Response("ok"));

      await onRequest(ctx as any, next);

      expect(mockUpsert).toHaveBeenCalledWith(
        "dev@localhost",
        "Dev User",
        null,
      );
      expect(ctx.locals.user).toEqual(devUser);
      expect(next).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        "[Auth] Using mock user for development.",
      );

      warnSpy.mockRestore();
    });
  });

  describe("protected routes in production (no JWT, no DEV_MODE)", () => {
    it("returns 401 when JWT is missing and DEV_MODE is not set", async () => {
      mockResolveUser.mockResolvedValue(null);
      const ctx = createContext("http://localhost:4321/dashboard");
      const next = vi.fn().mockResolvedValue(new Response("ok"));

      const result = await onRequest(ctx as any, next);

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 for /api/v1/ routes without auth", async () => {
      mockResolveUser.mockResolvedValue(null);
      const ctx = createContext("http://localhost:4321/api/v1/diagrams");
      const next = vi.fn().mockResolvedValue(new Response("ok"));

      const result = await onRequest(ctx as any, next);

      expect((result as Response).status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
