/**
 * Cloudflare environment bindings accessor.
 *
 * Single seam for obtaining the typed `Env` bindings (D1, KV, vars) on every
 * request. All route handlers and middleware call `getEnv(locals)` rather than
 * reaching into `locals.runtime.env` directly.
 *
 * This indirection exists so that the upcoming Astro 6 / @astrojs/cloudflare
 * v13 migration (Phase 3) only needs to change this one file. In v13, the
 * adapter removes `locals.runtime` in favour of a direct module import:
 *
 *   import { env } from "cloudflare:workers";
 *
 * When that change is made, every call site that already uses `getEnv(locals)`
 * will continue to compile and run without modification.
 */
export function getEnv(locals: App.Locals): Env {
  return locals.runtime.env;
}
