/**
 * TypeScript ambient declarations for the Astro + Cloudflare environment.
 *
 * Extends Astro's built-in types with the Cloudflare Workers runtime bindings
 * (D1, KV) and the application-specific `locals` properties injected by
 * the middleware.
 */

/// <reference types="astro/client" />

/** Cloudflare Workers runtime type from the Astro Cloudflare adapter. */
type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

/** Cloudflare Worker environment bindings available via `context.locals.runtime.env`. */
interface Env {
  /** D1 SQLite database for diagrams, users, and share links. */
  DB: D1Database;
  /** KV namespace for share-token fast lookups and short-lived caches. */
  KV: KVNamespace;
}

declare namespace App {
  /**
   * Astro request-scoped locals, extended with Cloudflare runtime and auth.
   *
   * Populated by the middleware on every request. Access via `Astro.locals`
   * in pages or `context.locals` in API routes.
   */
  interface Locals extends Runtime {
    /** The authenticated user for this request (always the seed user in MVP). */
    user: import("./lib/auth/types").AppUser;
  }
}
