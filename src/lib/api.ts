/** Maximum allowed request body size in bytes (1 MB). */
const MAX_BODY_SIZE = 1_048_576

/** Maximum page size for paginated list endpoints. */
const MAX_PAGE_LIMIT = 100

/**
 * Machine-readable error codes used in API error responses.
 * Maps to the error code table in spec §7.0.
 */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'CONTENT_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR'

/**
 * Create a JSON error response with the `{ error: { code, message } }` envelope.
 *
 * @param status - HTTP status code (e.g. 400, 404, 500).
 * @param code - Machine-readable {@link ApiErrorCode}.
 * @param message - Human-readable error description.
 * @returns A `Response` with `Content-Type: application/json`.
 */
export function errorResponse(status: number, code: ApiErrorCode, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Create a JSON success response.
 *
 * @param data - Any JSON-serialisable value to include as the response body.
 * @param status - HTTP status code; defaults to `200`.
 * @returns A `Response` with `Content-Type: application/json`.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Create a paginated list response with the `{ data, pagination }` envelope.
 *
 * @param data - The array of items for the current page.
 * @param page - Current page number (1-based).
 * @param limit - Number of items per page.
 * @param total - Total number of items across all pages.
 * @returns A `Response` with `Content-Type: application/json` and status 200.
 */
export function paginatedResponse(
  data: unknown[],
  page: number,
  limit: number,
  total: number,
): Response {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0
  return jsonResponse({ data, pagination: { page, limit, total, totalPages } })
}

/**
 * Validate that the request `Content-Type` header includes `application/json`.
 * Used to reject mutation requests with a wrong or missing content type.
 *
 * @param request - The incoming `Request` object.
 * @returns A 415 error `Response` if validation fails, or `null` if the content type is valid.
 */
export function validateContentType(request: Request): Response | null {
  const contentType = request.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) {
    return errorResponse(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json')
  }
  return null
}

/**
 * Check the request body size against the 1 MB limit.
 * Reads the `Content-Length` header; if present and over the limit, returns a 413 error.
 * If the header is absent, the check is skipped (streaming bodies are handled elsewhere).
 *
 * @param request - The incoming `Request` object.
 * @returns A 413 error `Response` if the body is too large, or `null` if within limits.
 */
export function validateBodySize(request: Request): Response | null {
  const contentLength = request.headers.get('Content-Length')
  if (contentLength !== null) {
    const size = parseInt(contentLength, 10)
    if (!isNaN(size) && size > MAX_BODY_SIZE) {
      return errorResponse(413, 'CONTENT_TOO_LARGE', 'Request body must not exceed 1 MB')
    }
  }
  return null
}

/**
 * Parse and normalise `page` and `limit` query parameters from a URL.
 *
 * Rules:
 * - `page` is clamped to a minimum of `1`.
 * - `limit` is clamped to a maximum of `100`.
 * - `offset` is computed as `(page - 1) * limit`.
 * - Non-numeric or missing parameters fall back to the provided defaults.
 *
 * @param url - The request `URL` object.
 * @param defaults - Optional overrides for default `page` and `limit` values.
 * @returns An object containing normalised `page`, `limit`, and computed `offset`.
 */
export function parsePagination(
  url: URL,
  defaults: { page?: number; limit?: number } = {},
): { page: number; limit: number; offset: number } {
  const defaultPage = defaults.page ?? 1
  const defaultLimit = defaults.limit ?? 20

  const rawPage = parseInt(url.searchParams.get('page') ?? String(defaultPage), 10)
  const rawLimit = parseInt(url.searchParams.get('limit') ?? String(defaultLimit), 10)

  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage
  const limit = isNaN(rawLimit) || rawLimit < 1 ? defaultLimit : Math.min(rawLimit, MAX_PAGE_LIMIT)
  const offset = (page - 1) * limit

  return { page, limit, offset }
}
