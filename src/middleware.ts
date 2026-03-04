/**
 * Astro middleware — runs on every incoming request before page/API route handlers.
 *
 * Responsibilities:
 * 1. Determines whether the requested route is protected or public.
 * 2. For protected routes, verifies the Cloudflare Access JWT and populates
 *    `context.locals.user` with the authenticated user from D1.
 * 3. In dev mode (DEV_MODE env var), injects a dev user when no JWT is present.
 * 4. Returns 401 for unauthenticated requests to protected routes in production.
 */
import { defineMiddleware } from "astro:middleware";
import { cloudflareAccessAuth } from "./lib/auth/cloudflare-access";
import { createRepositories } from "./lib/repository";

const PROTECTED_PATTERNS = [
  /^\/dashboard/,
  /^\/diagram\//,
  /^\/api\/v1\//,
  /^\/admin/,
];

const ADMIN_PATTERNS = [/^\/admin/, /^\/api\/v1\/admin\//];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PATTERNS.some((p) => p.test(pathname));
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_PATTERNS.some((p) => p.test(pathname));
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  if (!isProtectedRoute(pathname)) {
    return next();
  }

  const env = context.locals.runtime.env;

  const user = await cloudflareAccessAuth.resolveUser(context.request, env);

  if (user) {
    context.locals.user = user;
  } else if (env.DEV_MODE) {
    const { users } = createRepositories(env);
    const devUser = await users.upsert("dev@localhost", "Dev User", null);
    context.locals.user = {
      id: devUser.id,
      email: devUser.email,
      displayName: devUser.displayName,
      avatarUrl: devUser.avatarUrl,
      isAdmin: devUser.isAdmin,
    };
    console.warn("[Auth] Using mock user for development.");
  } else {
    return new Response("Unauthorized", { status: 401 });
  }

  if (isAdminRoute(pathname) && !context.locals.user.isAdmin) {
    const isApi = pathname.startsWith("/api/");
    if (isApi) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: "FORBIDDEN", message: "Admin access required" },
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return context.redirect("/dashboard", 302);
  }

  return next();
});
