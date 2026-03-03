/**
 * Factory for building mock Astro APIContext objects for route handler tests.
 */
import type { AppUser } from "@lib/auth/types";
import { TEST_USER_ID } from "./fixtures";
import { MockDatabase } from "./mock-db";
import { MockKV } from "./mock-kv";

const TEST_USER: AppUser = {
  id: TEST_USER_ID,
  email: "test@example.com",
  displayName: "Test User",
  avatarUrl: null,
  isAdmin: false,
};

export interface MockContextOptions {
  /** HTTP method (defaults to GET). */
  method?: string;
  /** Full request URL (defaults to http://localhost:4321/). */
  url?: string;
  /** JSON request body (will be serialized). */
  body?: unknown;
  /** Route params (e.g. { id: "abc" }). */
  params?: Record<string, string>;
  /** Override the default test user. Pass `undefined` to simulate unauthenticated. */
  user?: AppUser | undefined;
  /** MockDatabase instance to wire into locals.runtime.env.DB. */
  db?: MockDatabase;
  /** MockKV instance to wire into locals.runtime.env.KV. */
  kv?: MockKV;
}

/**
 * Build a minimal APIContext-shaped object suitable for calling route handlers.
 *
 * The returned object has `request`, `params`, and `locals` matching what
 * Astro injects. The `locals.runtime.env` is wired to the provided mock DB
 * and mock KV instances.
 */
export function createMockContext(options: MockContextOptions = {}) {
  const {
    method = "GET",
    url = "http://localhost:4321/",
    body,
    params = {},
    db = new MockDatabase(),
    kv = new MockKV(),
  } = options;

  const user = "user" in options ? options.user : TEST_USER;

  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }

  const request = new Request(url, init);

  return {
    request,
    params,
    locals: {
      user,
      runtime: {
        env: {
          DB: db as unknown as D1Database,
          KV: kv as unknown as KVNamespace,
        },
      },
    },
  } as unknown;
}
