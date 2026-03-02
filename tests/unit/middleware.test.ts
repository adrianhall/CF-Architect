import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("astro:middleware", () => ({
  defineMiddleware: (handler: any) => handler,
}));

vi.mock("@lib/auth/bypass", () => ({
  bypassAuth: {
    resolveUser: vi.fn(),
  },
}));

import { onRequest } from "../../src/middleware";
import { bypassAuth } from "@lib/auth/bypass";

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockResolveUser = vi.mocked(bypassAuth.resolveUser);

function createContext() {
  return {
    request: new Request("http://localhost:4321/"),
    locals: {
      user: undefined as any,
      runtime: { env: { DB: {}, KV: {} } },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("onRequest middleware", () => {
  it("sets context.locals.user when resolveUser returns a user", async () => {
    const user = {
      id: "u1",
      email: null,
      displayName: "Test",
      avatarUrl: null,
    };
    mockResolveUser.mockResolvedValue(user);
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(new Response("ok"));

    await onRequest(ctx as any, next);

    expect(mockResolveUser).toHaveBeenCalledWith(
      ctx.request,
      ctx.locals.runtime.env,
    );
    expect(ctx.locals.user).toBe(user);
    expect(next).toHaveBeenCalled();
  });

  it("does not set user when resolveUser returns null", async () => {
    mockResolveUser.mockResolvedValue(null);
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(new Response("ok"));

    await onRequest(ctx as any, next);

    expect(ctx.locals.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("returns the response from next()", async () => {
    mockResolveUser.mockResolvedValue(null);
    const ctx = createContext();
    const response = new Response("downstream");
    const next = vi.fn().mockResolvedValue(response);

    const result = await onRequest(ctx as any, next);

    expect(result).toBe(response);
  });
});
