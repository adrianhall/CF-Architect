/**
 * Single diagram CRUD API endpoints.
 *
 * - `GET /api/diagrams/[id]` — Get diagram by ID, owner only (spec §7.1).
 * - `PUT /api/diagrams/[id]` — Update diagram, owner only (spec §7.1).
 * - `DELETE /api/diagrams/[id]` — Delete diagram, owner only (spec §7.1).
 *
 * Bindings are accessed via `cloudflare:workers` (Astro Cloudflare adapter v13+).
 * Ref: https://docs.astro.build/en/guides/integrations-guide/cloudflare/#removed-astrolocalsruntime-api
 */

/** Disable prerendering — these are live server endpoints. */
export const prerender = false

import type { APIContext } from 'astro'
import type { Updateable } from 'kysely'
import { sql } from 'kysely'
import { env } from 'cloudflare:workers'

import {
  errorResponse,
  jsonResponse,
  validateBodySize,
  validateContentType,
} from '../../../lib/api'
import { deleteCachedShare } from '../../../lib/cache'
import { createDb } from '../../../lib/db/client'
import { mapDiagramToResponse } from '../../../lib/db/mappers'
import type { DiagramsTable } from '../../../lib/db/schema'
import { validateDiagramUpdate } from '../../../lib/validators'

/**
 * Get a single diagram by ID (owner only).
 *
 * @param context - Astro API context with `locals.user` and `params.id`.
 * @returns The diagram as a {@link DiagramResponse}, or an error response.
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
    .selectAll()
    .where('id', '=', id)
    .where('owner_id', '=', user.id)
    .executeTakeFirst()

  if (!row) {
    return errorResponse(404, 'NOT_FOUND', 'Diagram not found')
  }

  const tags = await fetchTags(id)
  return jsonResponse(mapDiagramToResponse(row, tags))
}

/**
 * Update a diagram (owner only). All body fields are optional.
 * Tag updates use delete-and-reinsert in a transaction (spec §7.1).
 *
 * @param context - Astro API context with `locals.user` and `params.id`.
 * @returns The updated diagram, or an error response.
 */
export async function PUT(context: APIContext): Promise<Response> {
  const ctError = validateContentType(context.request)
  if (ctError) return ctError

  const sizeError = validateBodySize(context.request)
  if (sizeError) return sizeError

  const user = context.locals.user
  if (!user) {
    return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
  }

  const id = context.params.id
  if (!id) {
    return errorResponse(400, 'BAD_REQUEST', 'Missing diagram ID')
  }

  let body: unknown
  try {
    body = await context.request.json()
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON in request body')
  }

  const update = validateDiagramUpdate(body)
  if (typeof update === 'string') {
    return errorResponse(400, 'BAD_REQUEST', update)
  }

  const db = createDb(env.DB)

  // Verify ownership
  const existing = await db
    .selectFrom('diagrams')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()

  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', 'Diagram not found')
  }
  if (existing.owner_id !== user.id) {
    return errorResponse(403, 'FORBIDDEN', 'Forbidden')
  }

  // Build update fields — only include fields present in the validated input.
  // Typed against the schema so column names and value types are checked at compile time.
  const updateFields: Partial<Updateable<DiagramsTable>> = {}
  if (update.title !== undefined) updateFields.title = update.title
  if (update.description !== undefined) updateFields.description = update.description
  if (update.canvasData !== undefined) updateFields.canvas_data = update.canvasData
  if (update.thumbnailSvg !== undefined) updateFields.thumbnail_svg = update.thumbnailSvg

  // Use D1 batch for atomicity — kysely-d1 does not support db.transaction().
  // Compile typed Kysely queries, then execute via env.DB.batch().
  // Ref: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
  const updateDiagram = db
    .updateTable('diagrams')
    .set({ ...updateFields, updated_at: sql<string>`datetime('now')` })
    .where('id', '=', id)
    .compile()

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(updateDiagram.sql).bind(...updateDiagram.parameters),
  ]

  // Tag update: delete all existing tags, reinsert new ones (spec §7.1)
  if (update.tags !== undefined) {
    const deleteTags = db.deleteFrom('diagram_tags').where('diagram_id', '=', id).compile()
    stmts.push(env.DB.prepare(deleteTags.sql).bind(...deleteTags.parameters))

    for (const tag of update.tags) {
      const insertTag = db
        .insertInto('diagram_tags')
        .values({ id: crypto.randomUUID(), diagram_id: id, tag })
        .compile()
      stmts.push(env.DB.prepare(insertTag.sql).bind(...insertTag.parameters))
    }
  }

  await env.DB.batch(stmts)

  // If canvasData changed, invalidate share cache for all tokens of this diagram
  if (update.canvasData !== undefined) {
    await invalidateShareCache(id)
  }

  // Fetch updated row
  const updated = await db
    .selectFrom('diagrams')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()

  const tags = await fetchTags(id)
  return jsonResponse(mapDiagramToResponse(updated, tags))
}

/**
 * Delete a diagram (owner only). Idempotent per spec §7.1.
 * Returns 204 if the diagram did not exist. Returns 403 if the caller
 * is not the owner.
 *
 * @param context - Astro API context with `locals.user` and `params.id`.
 * @returns 204 No Content on success, or an error response.
 */
export async function DELETE(context: APIContext): Promise<Response> {
  const user = context.locals.user
  if (!user) {
    return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
  }

  const id = context.params.id
  if (!id) {
    return errorResponse(400, 'BAD_REQUEST', 'Missing diagram ID')
  }

  const db = createDb(env.DB)

  const existing = await db
    .selectFrom('diagrams')
    .select(['id', 'owner_id'])
    .where('id', '=', id)
    .executeTakeFirst()

  // If exists but not owned — 403 (per Q1 discussion)
  if (existing && existing.owner_id !== user.id) {
    return errorResponse(403, 'FORBIDDEN', 'Forbidden')
  }

  // If exists and owned — delete share cache, then delete diagram
  if (existing) {
    await invalidateShareCache(id)
    await db.deleteFrom('diagrams').where('id', '=', id).execute()
  }

  // 204 whether it existed or not (idempotent)
  return new Response(null, { status: 204 })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch tag labels for a single diagram.
 *
 * @param diagramId - The diagram UUID.
 * @returns Array of tag label strings.
 */
async function fetchTags(diagramId: string): Promise<string[]> {
  const db = createDb(env.DB)
  const rows = await db
    .selectFrom('diagram_tags')
    .select('tag')
    .where('diagram_id', '=', diagramId)
    .execute()
  return rows.map((r) => r.tag)
}

/**
 * Invalidate KV share cache entries for all share tokens of a diagram.
 * Called on update (when canvasData changes) and on delete.
 *
 * @param diagramId - The diagram UUID.
 */
async function invalidateShareCache(diagramId: string): Promise<void> {
  const db = createDb(env.DB)
  const tokenRows = await db
    .selectFrom('share_tokens')
    .select('token')
    .where('diagram_id', '=', diagramId)
    .execute()

  await Promise.all(tokenRows.map((r) => deleteCachedShare(env.CACHE, r.token)))
}
