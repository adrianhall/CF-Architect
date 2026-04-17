/**
 * Client-side API utilities for React islands.
 *
 * Provides a typed fetch wrapper that handles the standard
 * `{ error: { code, message } }` error envelope from the API,
 * and a custom error class for structured error handling.
 */

/**
 * Structured API error with machine-readable code and HTTP status.
 *
 * Thrown by {@link fetchApi} when the server returns an error response
 * matching the `{ error: { code, message } }` envelope format.
 */
export class ApiError extends Error {
  /** Machine-readable error code (e.g., `'NOT_FOUND'`, `'UNAUTHORIZED'`). */
  code: string
  /** HTTP status code from the response. */
  status: number

  /**
   * Create an ApiError.
   *
   * @param message - Human-readable error description.
   * @param code - Machine-readable error code.
   * @param status - HTTP status code.
   */
  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/**
 * Typed fetch wrapper that handles API error responses.
 *
 * - Automatically sets `Content-Type: application/json` for request bodies.
 * - Parses successful JSON responses and returns the typed result.
 * - Throws {@link ApiError} when the response indicates an error
 *   (status >= 400 with `{ error: { code, message } }` body).
 * - Throws a generic `ApiError` for non-JSON error responses.
 *
 * @typeParam T - The expected response body type.
 * @param url - The API endpoint URL (relative or absolute).
 * @param options - Standard `RequestInit` options (method, body, headers, etc.).
 * @returns The parsed response body as type `T`.
 * @throws {ApiError} On error responses (status >= 400).
 */
export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)

  // Auto-set Content-Type for JSON bodies
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    // Try to parse the standard error envelope
    let errorBody: unknown
    try {
      errorBody = await response.json()
    } catch {
      throw new ApiError(response.statusText || 'Request failed', 'UNKNOWN', response.status)
    }

    // Check for the standard { error: { code, message } } shape
    if (
      typeof errorBody === 'object' &&
      errorBody !== null &&
      'error' in errorBody &&
      typeof (errorBody as Record<string, unknown>).error === 'object' &&
      (errorBody as Record<string, unknown>).error !== null
    ) {
      const err = (errorBody as { error: { code?: string; message?: string } }).error
      throw new ApiError(err.message ?? 'Request failed', err.code ?? 'UNKNOWN', response.status)
    }

    throw new ApiError(response.statusText || 'Request failed', 'UNKNOWN', response.status)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
