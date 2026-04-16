/**
 * Minimal no-op worker entrypoint for the vitest cloudflare pool.
 *
 * The vitest-pool-workers plugin needs a resolvable `main` entry to start the
 * workerd runtime. The real Astro entrypoint (`@astrojs/cloudflare/entrypoints/server`)
 * is not a real file path — it's resolved by Astro's build pipeline — so it
 * can't be used here. This stub gives the pool a valid module while still
 * exposing the D1/KV bindings configured in wrangler.jsonc.
 */
export default {
  async fetch(): Promise<Response> {
    return new Response('test worker')
  },
}
