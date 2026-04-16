/**
 * Diagram list and creation API endpoints.
 *
 * - `GET /api/diagrams` — List the current user's diagrams (spec §7.1).
 * - `POST /api/diagrams` — Create a new diagram (spec §7.1).
 *
 * Bindings are accessed via `cloudflare:workers` (Astro Cloudflare adapter v13+).
 * Ref: https://docs.astro.build/en/guides/integrations-guide/cloudflare/#removed-astrolocalsruntime-api
 */

/** Disable prerendering — these are live server endpoints. */
export const prerender = false

import type { APIContext } from 'astro'
import { env } from 'cloudflare:workers'

import {
  errorResponse,
  jsonResponse,
  paginatedResponse,
  parsePagination,
  validateBodySize,
  validateContentType,
} from '../../../lib/api'
import { createDb } from '../../../lib/db/client'
import { mapDiagramToListItem, mapDiagramToResponse } from '../../../lib/db/mappers'
import { validateDiagramInput, validateOrder, validateSort } from '../../../lib/validators'

/** Allowed sort fields for the diagram list endpoint. */
const ALLOWED_SORTS = ['updated_at', 'created_at', 'title']

/**
 * List the authenticated user's diagrams with pagination, search, and tag filtering.
 *
 * @param context - Astro API context with `locals.user` set by middleware.
 * @returns Paginated `{ data, pagination }` response or an error response.
 */
export async function GET(context: APIContext): Promise<Response> {
  const user = context.locals.user
  if (!user) {
    return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
  }

  const db = createDb(env.DB)
  const { page, limit, offset } = parsePagination(context.url)

  const search = context.url.searchParams.get('search')
  const tags = [...new Set(context.url.searchParams.getAll('tag').filter((t) => t.length > 0))]
  const sort = validateSort(context.url.searchParams.get('sort'), ALLOWED_SORTS, 'updated_at')
  const order = validateOrder(context.url.searchParams.get('order'), 'desc')

  // -----------------------------------------------------------------------
  // Base query: user's own diagrams, optionally filtered by search and tags
  // -----------------------------------------------------------------------
  let query = db.selectFrom('diagrams').where('owner_id', '=', user.id)
  let countQuery = db.selectFrom('diagrams').where('owner_id', '=', user.id)

  // Search filter — case-insensitive LIKE on title and description
  if (search) {
    const term = `%${search}%`
    query = query.where((eb) => eb.or([eb('title', 'like', term), eb('description', 'like', term)]))
    countQuery = countQuery.where((eb) =>
      eb.or([eb('title', 'like', term), eb('description', 'like', term)]),
    )
  }

  // Tag filter — AND semantics: diagram must have ALL specified tags
  if (tags.length > 0) {
    query = query
      .innerJoin('diagram_tags', 'diagrams.id', 'diagram_tags.diagram_id')
      .where('diagram_tags.tag', 'in', tags)
      .groupBy('diagrams.id')
      .having((eb) => eb.fn.count<number>('diagram_tags.tag').distinct(), '=', tags.length)
    countQuery = countQuery
      .innerJoin('diagram_tags', 'diagrams.id', 'diagram_tags.diagram_id')
      .where('diagram_tags.tag', 'in', tags)
      .groupBy('diagrams.id')
      .having((eb) => eb.fn.count<number>('diagram_tags.tag').distinct(), '=', tags.length)
  }

  // Execute count query.
  // When using GROUP BY (tag filter), wrap the grouped query as a subquery so
  // SQLite counts the rows internally rather than sending all IDs to the isolate.
  let total: number
  if (tags.length > 0) {
    const countResult = await db
      .selectFrom(countQuery.select('diagrams.id').as('matched'))
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow()
    total = countResult.count
  } else {
    const countResult = await countQuery
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow()
    total = countResult.count
  }

  // Execute data query with ordering and pagination
  // Kysely's orderBy requires a reference expression; we use the validated sort
  // field which is always a column on the diagrams table.
  // Ref: https://kysely.dev/docs/examples/select/complex-selections
  const rows = await query
    .selectAll('diagrams')
    .orderBy(sort as 'updated_at', order)
    .limit(limit)
    .offset(offset)
    .execute()

  // Batch-fetch tags for all returned diagrams to avoid N+1 queries
  const diagramIds = rows.map((r) => r.id)
  const tagMap = await fetchTagMap(diagramIds)

  const data = rows.map((row) => mapDiagramToListItem(row, tagMap.get(row.id) ?? []))
  return paginatedResponse(data, page, limit, total)
}

/**
 * Create a new diagram for the authenticated user.
 *
 * @param context - Astro API context with `locals.user` set by middleware.
 * @returns 201 response with the created diagram, or an error response.
 */
export async function POST(context: APIContext): Promise<Response> {
  const ctError = validateContentType(context.request)
  if (ctError) return ctError

  const sizeError = validateBodySize(context.request)
  if (sizeError) return sizeError

  const user = context.locals.user
  if (!user) {
    return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized')
  }

  let body: unknown
  try {
    body = await context.request.json()
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON in request body')
  }

  const input = validateDiagramInput(body)
  if (typeof input === 'string') {
    return errorResponse(400, 'BAD_REQUEST', input)
  }

  const db = createDb(env.DB)
  const diagramId = crypto.randomUUID()

  // Use D1 batch for atomicity — kysely-d1 does not support db.transaction().
  // Compile typed Kysely queries, then execute via env.DB.batch().
  // Ref: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
  const insertDiagram = db
    .insertInto('diagrams')
    .values({
      id: diagramId,
      owner_id: user.id,
      title: input.title,
      description: input.description,
      canvas_data: input.canvasData,
      thumbnail_svg: null,
      is_blueprint: 0,
    })
    .compile()

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(insertDiagram.sql).bind(...insertDiagram.parameters),
  ]

  if (input.tags.length > 0) {
    for (const tag of input.tags) {
      const insertTag = db
        .insertInto('diagram_tags')
        .values({ id: crypto.randomUUID(), diagram_id: diagramId, tag })
        .compile()
      stmts.push(env.DB.prepare(insertTag.sql).bind(...insertTag.parameters))
    }
  }

  await env.DB.batch(stmts)

  // Fetch the created diagram to return it with DB-generated timestamps
  const row = await db
    .selectFrom('diagrams')
    .selectAll()
    .where('id', '=', diagramId)
    .executeTakeFirstOrThrow()

  return jsonResponse(mapDiagramToResponse(row, input.tags), 201)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Batch-fetch tags for a list of diagram IDs.
 * Returns a Map from diagram ID to its array of tag labels.
 *
 * @param diagramIds - Array of diagram UUIDs.
 * @returns Map keyed by diagram ID, values are tag label arrays.
 */
async function fetchTagMap(diagramIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (diagramIds.length === 0) return map

  const db = createDb(env.DB)
  const tagRows = await db
    .selectFrom('diagram_tags')
    .select(['diagram_id', 'tag'])
    .where('diagram_id', 'in', diagramIds)
    .execute()

  for (const row of tagRows) {
    const existing = map.get(row.diagram_id)
    if (existing) {
      existing.push(row.tag)
    } else {
      map.set(row.diagram_id, [row.tag])
    }
  }

  return map
}
