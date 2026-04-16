/**
 * Single blueprint endpoint.
 *
 * `GET /api/blueprints/[id]` — Get a blueprint by ID for cloning (spec §7.2).
 *
 * Returns the full diagram data including `canvasData` so the client can
 * use it to initialise a new diagram from a blueprint template.
 */

/** Disable prerendering — this is a live server endpoint. */
export const prerender = false

import type { APIContext } from 'astro'
import { env } from 'cloudflare:workers'

import { errorResponse, jsonResponse } from '../../../lib/api'
import { createDb } from '../../../lib/db/client'
import { mapDiagramToResponse } from '../../../lib/db/mappers'

/**
 * Get a single blueprint by ID (any authenticated user).
 *
 * @param context - Astro API context with `locals.user` and `params.id`.
 * @returns The blueprint as a {@link DiagramResponse}, or an error response.
 */
export async function GET(context: APIContext): Promise<Response> {
  const user = context.locals.user
  if (!user) {
    return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
  }

  const id = context.params.id
  if (!id) {
    return errorResponse(400, 'BAD_REQUEST', 'Missing blueprint ID')
  }

  const db = createDb(env.DB)
  const row = await db
    .selectFrom('diagrams')
    .selectAll()
    .where('id', '=', id)
    .where('is_blueprint', '=', 1)
    .executeTakeFirst()

  if (!row) {
    return errorResponse(404, 'NOT_FOUND', 'Blueprint not found')
  }

  // Fetch tags
  const tagRows = await db
    .selectFrom('diagram_tags')
    .select('tag')
    .where('diagram_id', '=', id)
    .execute()
  const tags = tagRows.map((r) => r.tag)

  return jsonResponse(mapDiagramToResponse(row, tags))
}
