/**
 * Input validation helpers for API endpoints.
 *
 * Each validator accepts `unknown` input and either returns a typed,
 * normalised result object or a human-readable error string.
 * This keeps validation logic out of endpoint handlers and makes it
 * independently testable.
 */

/** Maximum allowed title length in characters. */
const MAX_TITLE_LENGTH = 200

/** Maximum allowed description length in characters. */
const MAX_DESCRIPTION_LENGTH = 2000

/** Maximum number of tags per diagram. */
const MAX_TAG_COUNT = 20

/** Maximum allowed length for a single tag in characters. */
const MAX_TAG_LENGTH = 50

/** Maximum allowed thumbnail SVG size in bytes (500 KB). */
const MAX_THUMBNAIL_SIZE = 512_000

// ---------------------------------------------------------------------------
// Diagram creation
// ---------------------------------------------------------------------------

/** Validated and normalised result from {@link validateDiagramInput}. */
export interface DiagramInput {
  /** Diagram title (1-200 chars). */
  title: string
  /** Optional description (max 2000 chars, defaults to empty string). */
  description: string
  /** JSON string of the tldraw store snapshot. */
  canvasData: string
  /** Lowercase, trimmed tag labels (max 20). */
  tags: string[]
}

/**
 * Validate and normalise diagram creation input.
 *
 * @param body - Raw parsed request body (typed as `unknown`).
 * @returns A {@link DiagramInput} on success, or a descriptive error string.
 */
export function validateDiagramInput(body: unknown): DiagramInput | string {
  if (body === null || typeof body !== 'object') {
    return 'Request body must be a JSON object'
  }

  const obj = body as Record<string, unknown>

  // title — required, 1-200 chars
  if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
    return 'title is required and must be a non-empty string'
  }
  const title = obj.title.trim()
  if (title.length > MAX_TITLE_LENGTH) {
    return `title must not exceed ${MAX_TITLE_LENGTH} characters`
  }

  // description — optional, max 2000 chars, default ''
  let description = ''
  if (obj.description !== undefined && obj.description !== null) {
    if (typeof obj.description !== 'string') {
      return 'description must be a string'
    }
    description = obj.description
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`
    }
  }

  // canvasData — required, must be valid JSON
  if (typeof obj.canvasData !== 'string' || obj.canvasData.trim().length === 0) {
    return 'canvasData is required and must be a non-empty string'
  }
  try {
    JSON.parse(obj.canvasData)
  } catch {
    return 'canvasData must be valid JSON'
  }

  // tags — optional array of strings
  const tags = normaliseTags(obj.tags)
  if (typeof tags === 'string') return tags

  return { title, description, canvasData: obj.canvasData, tags }
}

// ---------------------------------------------------------------------------
// Diagram update
// ---------------------------------------------------------------------------

/** Validated and normalised result from {@link validateDiagramUpdate}. */
export interface DiagramUpdate {
  /** Updated title (1-200 chars). */
  title?: string
  /** Updated description (max 2000 chars). */
  description?: string
  /** Updated canvas JSON string. */
  canvasData?: string
  /** Updated SVG thumbnail string (max 500 KB). */
  thumbnailSvg?: string
  /** Replacement tag set (lowercase, trimmed, max 20). */
  tags?: string[]
}

/**
 * Validate and normalise diagram update input.
 * All fields are optional; only present fields are validated.
 *
 * @param body - Raw parsed request body (typed as `unknown`).
 * @returns A {@link DiagramUpdate} on success, or a descriptive error string.
 */
export function validateDiagramUpdate(body: unknown): DiagramUpdate | string {
  if (body === null || typeof body !== 'object') {
    return 'Request body must be a JSON object'
  }

  const obj = body as Record<string, unknown>
  const result: DiagramUpdate = {}

  // title — optional, 1-200 chars
  if (obj.title !== undefined) {
    if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
      return 'title must be a non-empty string'
    }
    const title = obj.title.trim()
    if (title.length > MAX_TITLE_LENGTH) {
      return `title must not exceed ${MAX_TITLE_LENGTH} characters`
    }
    result.title = title
  }

  // description — optional, max 2000 chars
  if (obj.description !== undefined) {
    if (typeof obj.description !== 'string') {
      return 'description must be a string'
    }
    if (obj.description.length > MAX_DESCRIPTION_LENGTH) {
      return `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`
    }
    result.description = obj.description
  }

  // canvasData — optional, must be valid JSON
  if (obj.canvasData !== undefined) {
    if (typeof obj.canvasData !== 'string' || obj.canvasData.trim().length === 0) {
      return 'canvasData must be a non-empty string'
    }
    try {
      JSON.parse(obj.canvasData)
    } catch {
      return 'canvasData must be valid JSON'
    }
    result.canvasData = obj.canvasData
  }

  // thumbnailSvg — optional, max 500 KB
  if (obj.thumbnailSvg !== undefined) {
    if (typeof obj.thumbnailSvg !== 'string') {
      return 'thumbnailSvg must be a string'
    }
    if (new TextEncoder().encode(obj.thumbnailSvg).byteLength > MAX_THUMBNAIL_SIZE) {
      return 'thumbnailSvg must not exceed 500 KB'
    }
    result.thumbnailSvg = obj.thumbnailSvg
  }

  // tags — optional array of strings
  if (obj.tags !== undefined) {
    const tags = normaliseTags(obj.tags)
    if (typeof tags === 'string') return tags
    result.tags = tags
  }

  return result
}

// ---------------------------------------------------------------------------
// Sort & order
// ---------------------------------------------------------------------------

/**
 * Validate a sort field against an allow-list.
 *
 * @param sort - The raw sort value from the query string, or `null`.
 * @param allowed - Array of permitted sort field names.
 * @param defaultSort - Value to return when `sort` is absent or invalid.
 * @returns A valid sort field string.
 */
export function validateSort(sort: string | null, allowed: string[], defaultSort: string): string {
  if (sort !== null && allowed.includes(sort)) {
    return sort
  }
  return defaultSort
}

/**
 * Validate a sort direction value.
 *
 * @param order - The raw order value from the query string, or `null`.
 * @param defaultOrder - Value to return when `order` is absent or invalid.
 * @returns `'asc'` or `'desc'`.
 */
export function validateOrder(order: string | null, defaultOrder: 'asc' | 'desc'): 'asc' | 'desc' {
  if (order === 'asc' || order === 'desc') {
    return order
  }
  return defaultOrder
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalise and validate a tags value.
 * Returns an array of lowercase, trimmed, deduplicated tag strings,
 * or an error string if validation fails.
 */
function normaliseTags(raw: unknown): string[] | string {
  if (raw === undefined || raw === null) {
    return []
  }
  if (!Array.isArray(raw)) {
    return 'tags must be an array of strings'
  }
  if (raw.length > MAX_TAG_COUNT) {
    return `tags must not exceed ${MAX_TAG_COUNT} items`
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') {
      return 'each tag must be a string'
    }
    const normalised = item.toLowerCase().trim()
    if (normalised.length === 0) continue
    if (normalised.length > MAX_TAG_LENGTH) {
      return `each tag must not exceed ${MAX_TAG_LENGTH} characters`
    }
    if (!seen.has(normalised)) {
      seen.add(normalised)
      result.push(normalised)
    }
  }
  return result
}
