/**
 * apps/worker/src/middleware/csrf.ts
 *
 * CSRF protection middleware.
 *
 * For every mutating request (POST, PUT, PATCH, DELETE) that is NOT on a
 * public path, enforces one of two checks:
 *
 *   1. Origin header matches the request host (same-origin browser requests).
 *   2. X-CSRF-Token header matches the CF_CSRF double-submit cookie value.
 *
 * Returns 403 FORBIDDEN if neither check passes.
 *
 * On every response (if the cookie is absent), a fresh CF_CSRF token is set
 * so the SPA always has a valid value before making its first mutating request.
 * See D07 in docs/DECISION_LOG.md.
 */

import type { MiddlewareHandler } from "hono";
import { err } from "../lib/envelope.js";
import { CF_ACCESS_POLICIES } from "./auth.js";

const CSRF_COOKIE = "CF_CSRF";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

function parseCsrfCookie(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const pair of cookieHeader.split(";")) {
    const [name, ...rest] = pair.split("=");
    if (name?.trim() === CSRF_COOKIE) {
      return rest.join("=").trim();
    }
  }
  return undefined;
}

async function generateCsrfToken(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url without padding
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildCsrfCookieHeader(token: string, secure: boolean): string {
  const parts = [`${CSRF_COOKIE}=${token}`, "SameSite=Strict", "Path=/", "Max-Age=86400"];
  if (secure) parts.push("Secure");
  // NOT HttpOnly — the SPA must read this to set the X-CSRF-Token header.
  return parts.join("; ");
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export const csrfMiddleware: MiddlewareHandler = async (c, next) => {
  const method = c.req.method.toUpperCase();
  const pathname = new URL(c.req.url).pathname;

  // Skip non-mutating methods
  if (!MUTATING_METHODS.has(method)) {
    await next();
    return setCsrfCookieIfAbsent(c);
  }

  // Skip public paths (e.g. /_auth/callback which is a POST)
  const isPublic = CF_ACCESS_POLICIES.some((p) => p.pattern.test(pathname) && !p.authenticate);
  if (isPublic) {
    await next();
    return setCsrfCookieIfAbsent(c);
  }

  // -------------------------------------------------------------------------
  // CSRF check: Origin header match OR double-submit cookie match
  // -------------------------------------------------------------------------
  const originHeader = c.req.header("origin");
  // Use the request URL's own host rather than the Host header — the Host
  // header may be absent in test environments where requests are constructed
  // without it, and in production the Worker URL is more reliable.
  const requestHost = new URL(c.req.url).host;

  let passes = false;

  if (originHeader) {
    try {
      const originHost = new URL(originHeader).host;
      passes = originHost === requestHost;
    } catch {
      passes = false;
    }
  }

  if (!passes) {
    // Fall back to double-submit cookie check
    const csrfToken = c.req.header("x-csrf-token");
    const csrfCookie = parseCsrfCookie(c.req.header("cookie"));
    passes = !!(csrfToken && csrfCookie && csrfToken === csrfCookie);
  }

  if (!passes) {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    return c.json(
      err("FORBIDDEN", "CSRF check failed: provide Origin or X-CSRF-Token header", undefined, {
        requestId,
      }),
      403,
    );
  }

  await next();
  return setCsrfCookieIfAbsent(c);
};

// ---------------------------------------------------------------------------
// Helper: set CF_CSRF cookie on response if not already present
// ---------------------------------------------------------------------------

async function setCsrfCookieIfAbsent(c: Parameters<MiddlewareHandler>[0]): Promise<void> {
  const existingCookie = parseCsrfCookie(c.req.header("cookie"));
  if (!existingCookie) {
    const token = await generateCsrfToken();
    const isSecure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", buildCsrfCookieHeader(token, isSecure), { append: true });
  }
}
