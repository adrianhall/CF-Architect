/**
 * Diagram thumbnail SVG endpoint.
 *
 * `GET /api/diagrams/[id]/thumbnail` — Returns the cached SVG thumbnail
 * for a diagram with security headers (spec §7.1).
 *
 * The CSP header prevents script execution if a user navigates directly
 * to the thumbnail URL. This is defense-in-depth against direct navigation.
 * Ref: spec §7.1 thumbnail
 */

/** Disable prerendering — this is a live server endpoint. */
export const prerender = false

import type { APIContext } from 'astro'
import { env } from 'cloudflare:workers'

import { errorResponse } from '../../../../lib/api'
import { createDb } from '../../../../lib/db/client'

/**
 * Get the SVG thumbnail for a diagram (owner only).
 *
 * Returns the raw SVG string with `Content-Type: image/svg+xml` and a
 * restrictive `Content-Security-Policy` header.
 *
 * @param context - Astro API context with `locals.user` and `params.id`.
 * @returns SVG response with security headers, or an error response.
 */
export async function GET(context: APIContext): Promise<Response> {
  const user = context.locals.user
  if (!user) {
    return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
  }

  const id = context.params.id
  if (!id) {
    return errorResponse(400, 'BAD_REQUEST', 'Missing diagram ID')
  }

  const db = createDb(env.DB)
  const row = await db
    .selectFrom('diagrams')
    .select('thumbnail_svg')
    .where('id', '=', id)
    .where('owner_id', '=', user.id)
    .executeTakeFirst()

  if (!row) {
    return errorResponse(404, 'NOT_FOUND', 'Diagram not found')
  }

  if (row.thumbnail_svg === null) {
    return errorResponse(404, 'NOT_FOUND', 'No thumbnail available')
  }

  return new Response(row.thumbnail_svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  })
}
