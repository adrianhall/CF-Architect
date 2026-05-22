/**
 * apps/worker/test/auth-helper.ts
 *
 * Test helpers for creating authenticated requests in worker integration tests.
 * Uses signDevJwt from @adrianhall/cloudflare-auth to mint tokens that the
 * cloudflareAccess middleware accepts (HMAC-verified dev JWTs).
 */

import { signDevJwt } from "@adrianhall/cloudflare-auth";
import { env } from "cloudflare:workers";
import { upsertUser } from "../src/db/queries/index.js";

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

/**
 * Mint a dev JWT for the given email/sub and return headers that will pass
 * both `developerAuthentication` and `cloudflareAccess` in tests.
 */
export async function devAuthHeaders(
  email: string,
  sub?: string,
  lifetimeSeconds = 86400,
): Promise<Record<string, string>> {
  const resolvedSub = sub ?? `dev-${email}`;
  const token = await signDevJwt(email, { lifetime: lifetimeSeconds });
  return {
    // cloudflareAccess reads the JWT from this header (or the cookie).
    // Setting the header directly skips the developerAuthentication login flow.
    "cf-access-jwt-assertion": token,
    "cf-access-authenticated-user-email": email,
    "cf-access-user": resolvedSub,
    // Origin header passes CSRF check for the same host
    Origin: "http://localhost",
  };
}

// ---------------------------------------------------------------------------
// DB seed helpers
// ---------------------------------------------------------------------------

/**
 * Insert a user row directly into D1 and return the sub.
 * Used to pre-seed users before route tests that depend on them.
 */
export async function seedUser(params: {
  email: string;
  sub?: string;
  role?: "user" | "admin";
  seedAdminEmail?: string;
}) {
  const { email, role, seedAdminEmail } = params;
  const sub = params.sub ?? `dev-${email}`;

  const user = await upsertUser({
    d1: (env as { DB: D1Database }).DB,
    sub,
    email,
    seedAdminEmail: seedAdminEmail ?? null,
  });

  // Promote to admin directly if role is specified and not already admin
  if (role === "admin" && user.role !== "admin") {
    const { setUserRole } = await import("../src/db/queries/index.js");
    await setUserRole({ d1: (env as { DB: D1Database }).DB, targetId: sub, role: "admin" });
  }

  return { ...user, role: role ?? user.role, sub };
}
