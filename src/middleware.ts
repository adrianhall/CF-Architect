/**
 * Astro middleware entry point (spec §8).
 *
 * This file is the thin adapter between Astro's middleware API and the
 * framework-agnostic handler in `./lib/middleware-handler.ts`.
 *
 * `defineMiddleware` from `astro:middleware` auto-types `context` and `next`
 * so no additional type imports from `astro` are needed.
 * Ref: https://docs.astro.build/en/guides/middleware/#middleware-types
 *
 * Cloudflare bindings are accessed via `cloudflare:workers` (v13+ adapter).
 * Ref: https://docs.astro.build/en/guides/integrations-guide/cloudflare/#removed-astrolocalsruntime-api
 */

import { defineMiddleware } from 'astro:middleware'
import { env } from 'cloudflare:workers'

import { handleRequest } from './lib/middleware-handler'

/**
 * Astro middleware — delegates to {@link handleRequest} after extracting
 * the plain values it needs from the Astro context.
 */
export const onRequest = defineMiddleware((context, next) =>
  handleRequest(
    {
      url: context.url,
      method: context.request.method,
      originHeader: context.request.headers.get('Origin'),
      cfAuthCookie: context.cookies.get('CF_Authorization')?.value,
      locals: context.locals,
      env,
    },
    next,
    import.meta.env.DEV,
  ),
)
