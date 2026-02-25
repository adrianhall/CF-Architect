/**
 * Astro middleware — runs on every incoming request before page/API route handlers.
 *
 * Responsibilities:
 * 1. Resolves the current user via the active {@link AuthStrategy} and sets
 *    `context.locals.user` so that downstream pages and API routes can access
 *    the authenticated user without repeating auth logic.
 *
 * In the MVP, the bypass strategy always returns the seed user (no login
 * required). Post-MVP, this will be replaced with an OIDC strategy that
 * validates session cookies and returns 401 for protected routes.
 */
import { defineMiddleware } from "astro:middleware";
import { bypassAuth } from "./lib/auth/bypass";

/**
 * Middleware request handler.
 *
 * @param context - Astro request context (includes `request`, `locals`, `params`, etc.).
 * @param next    - Callback to continue to the next middleware or route handler.
 * @returns The response from the downstream handler.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const user = await bypassAuth.resolveUser(
    context.request,
    context.locals.runtime.env,
  );

  if (user) {
    context.locals.user = user;
  }

  return next();
});
