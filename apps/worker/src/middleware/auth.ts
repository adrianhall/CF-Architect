/**
 * apps/worker/src/middleware/auth.ts
 *
 * Phase 02 — Authentication middleware and path policies.
 *
 * Exports:
 *   AUTH_POLICIES  — PathPolicy[] shared by developerAuthentication and cloudflareAccess.
 *   attachUserContext — Hono middleware that runs after cloudflareAccess:
 *                       upserts the user row on first login, promotes to admin if the
 *                       email matches SEED_ADMIN_EMAIL (first INSERT only), decodes the
 *                       JWT to extract `exp`, and attaches userId/userRole/userExp to
 *                       the Hono context.
 */

import type { MiddlewareHandler } from "hono";
import type { PathPolicy, AuthVariables } from "@adrianhall/cloudflare-auth";
import { err } from "../lib/envelope.js";
import { upsertUser } from "../db/queries/index.js";

// ---------------------------------------------------------------------------
// Extend Hono context variables
// ---------------------------------------------------------------------------

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    userRole: "user" | "admin";
    /** JWT expiry in Unix seconds — sourced from the JWT `exp` claim. */
    userExp: number;
  }
}

// ---------------------------------------------------------------------------
// Path policies
// ---------------------------------------------------------------------------

/**
 * Policies for `developerAuthentication`.
 *
 * IMPORTANT: `/_auth/*` is intentionally excluded here. The library checks
 * policies before it checks whether the path is its own login/callback handler.
 * If `/_auth/*` were listed as public, the middleware would skip to `next()`
 * before it could serve the login form — resulting in a 404.
 *
 * Rules are evaluated in order — first match wins.
 */
export const AUTH_POLICIES: PathPolicy[] = [
  { pattern: /^\/api\/health$/, authenticate: false },
  { pattern: /^\/api\/version$/, authenticate: false },
  // Catalog endpoint is public — no auth required (Phase 03)
  { pattern: /^\/api\/catalog$/, authenticate: false },
  // Share viewer (Phase 07) — read-only public access
  { pattern: /^\/share\//, authenticate: false },
  // Everything else under /api/ requires authentication
  { pattern: /^\/api\//, authenticate: true },
];

/**
 * Extended policies for `cloudflareAccess` and `attachUserContext`.
 *
 * Adds `/_auth/*` as an explicit public path so `cloudflareAccess` does not
 * require a JWT for the login/callback endpoints (the dev middleware handles
 * those paths itself and never reaches `cloudflareAccess`).
 */
export const CF_ACCESS_POLICIES: PathPolicy[] = [
  { pattern: /^\/_auth\//, authenticate: false },
  ...AUTH_POLICIES,
];

// ---------------------------------------------------------------------------
// attachUserContext middleware
// ---------------------------------------------------------------------------

type Bindings = {
  DB: D1Database;
  SEED_ADMIN_EMAIL?: string;
};

type Variables = AuthVariables & {
  requestId: string;
  userId: string;
  userRole: "user" | "admin";
  userExp: number;
};

/**
 * Runs after `cloudflareAccess`. On every protected request:
 *
 * 1. Reads `userEmail` and `userSub` set by `cloudflareAccess`.
 * 2. Calls `upsertUser` to create the row on first login or update `lastLoginAt`.
 * 3. If the email matches `SEED_ADMIN_EMAIL` **and** the row was just inserted,
 *    promotes to admin (D05 in DECISION_LOG.md).
 * 4. Decodes the JWT payload from the `cf-access-jwt-assertion` header to extract
 *    `exp` (safe — the JWT was already verified by `cloudflareAccess`).
 * 5. Sets `userId`, `userRole`, `userExp` on the Hono context.
 *
 * Public paths (matching `authenticate: false` in AUTH_POLICIES) are skipped.
 */
export const attachUserContext: MiddlewareHandler<{
  Bindings: Bindings;
  Variables: Variables;
}> = async (c, next) => {
  const pathname = new URL(c.req.url).pathname;

  // Skip for public paths — cloudflareAccess has already bypassed JWT validation
  // for these; userEmail/userSub are not set.
  const isPublic = CF_ACCESS_POLICIES.some((p) => p.pattern.test(pathname) && !p.authenticate);
  if (isPublic) {
    return next();
  }

  const email = c.get("userEmail");
  const sub = c.get("userSub");

  // Defensive: cloudflareAccess should have already returned 401 if auth is
  // required and the JWT is missing, but guard here just in case.
  if (!email || !sub) {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    return c.json(err("UNAUTHENTICATED", "Authentication required", undefined, { requestId }), 401);
  }

  // Upsert the user — creates the row on first login, updates lastLoginAt on
  // subsequent logins, and promotes to admin only on the first INSERT.
  const userRow = await upsertUser({
    d1: c.env.DB,
    sub,
    email,
    seedAdminEmail: c.env.SEED_ADMIN_EMAIL ?? null,
  });

  // Decode the JWT payload to extract `exp`.
  // The JWT has already been cryptographically verified by cloudflareAccess;
  // we only need the payload claims here.
  let exp = Math.floor(Date.now() / 1000) + 86400; // 24 h fallback
  const jwtHeader = c.req.header("cf-access-jwt-assertion");
  if (jwtHeader) {
    try {
      const parts = jwtHeader.split(".");
      if (parts.length === 3 && parts[1]) {
        const payload = JSON.parse(atob(parts[1])) as { exp?: number };
        if (typeof payload.exp === "number") {
          exp = payload.exp;
        }
      }
    } catch {
      // Malformed payload — fall back to the 24 h estimate above
    }
  }

  c.set("userId", userRow.id);
  c.set("userRole", userRow.role as "user" | "admin");
  c.set("userExp", exp);

  return next();
};
