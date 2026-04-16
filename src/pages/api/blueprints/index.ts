/**
 * Blueprint list endpoint.
 *
 * `GET /api/blueprints` — List all blueprints visible to any authenticated user (spec §7.2).
 *
 * Blueprints are diagrams with `is_blueprint = 1`. They are not filtered by owner —
 * every authenticated user can browse the full catalogue.
 */

/** Disable prerendering — this is a live server endpoint. */
export const prerender = false

import type { APIContext } from 'astro'
import { env } from 'cloudflare:workers'

import { errorResponse, paginatedResponse, parsePagination } from '../../../lib/api'
import { createDb } from '../../../lib/db/client'
import { mapDiagramToListItem } from '../../../lib/db/mappers'
import { validateOrder, validateSort } from '../../../lib/validators'

/** Allowed sort fields for the blueprint list endpoint. */
const ALLOWED_SORTS = ['title', 'created_at', 'updated_at']

/**
 * List all blueprints with pagination, search, and tag filtering.
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
  const sort = validateSort(context.url.searchParams.get('sort'), ALLOWED_SORTS, 'title')
  const order = validateOrder(context.url.searchParams.get('order'), 'asc')

  // -----------------------------------------------------------------------
  // Base query: all blueprints (no owner filter)
  // -----------------------------------------------------------------------
  let query = db.selectFrom('diagrams').where('is_blueprint', '=', 1)
  let countQuery = db.selectFrom('diagrams').where('is_blueprint', '=', 1)

  // Search filter
  if (search) {
    const term = `%${search}%`
    query = query.where((eb) => eb.or([eb('title', 'like', term), eb('description', 'like', term)]))
    countQuery = countQuery.where((eb) =>
      eb.or([eb('title', 'like', term), eb('description', 'like', term)]),
    )
  }

  // Tag filter — AND semantics
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

  // Count total.
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

  // Execute data query
  const rows = await query
    .selectAll('diagrams')
    .orderBy(sort as 'title', order)
    .limit(limit)
    .offset(offset)
    .execute()

  // Batch-fetch tags
  const diagramIds = rows.map((r) => r.id)
  const tagMap = await fetchBlueprintTagMap(diagramIds)

  const data = rows.map((row) => mapDiagramToListItem(row, tagMap.get(row.id) ?? []))
  return paginatedResponse(data, page, limit, total)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Batch-fetch tags for a list of diagram IDs.
 *
 * @param diagramIds - Array of diagram UUIDs.
 * @returns Map keyed by diagram ID, values are tag label arrays.
 */
async function fetchBlueprintTagMap(diagramIds: string[]): Promise<Map<string, string[]>> {
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
