/**
 * Factory for building mock Astro APIContext objects for route handler tests.
 */
import { SEED_USER_ID } from "@lib/auth/types";
import type { AppUser } from "@lib/auth/types";
import { MockDatabase } from "./mock-db";
import { MockKV } from "./mock-kv";

const SEED_USER: AppUser = {
  id: SEED_USER_ID,
  email: null,
  displayName: "Default User",
  avatarUrl: null,
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
  /** Override the default seed user. */
  user?: AppUser;
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
    user = SEED_USER,
    db = new MockDatabase(),
    kv = new MockKV(),
  } = options;

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
          R2: {} as unknown as R2Bucket,
        },
      },
    },
  } as unknown;
}
