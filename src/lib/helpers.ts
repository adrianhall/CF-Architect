/**
 * Shared utility functions used across API routes and server-side code.
 */

/**
 * Generate a new random UUID (v4) using the Web Crypto API.
 *
 * Available natively in the Cloudflare Workers runtime.
 *
 * @returns A lowercase UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000").
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Return the current date and time as an ISO 8601 string.
 *
 * Used for `created_at` and `updated_at` timestamps in D1 rows.
 *
 * @returns An ISO 8601 datetime string (e.g. "2026-02-25T17:00:00.000Z").
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Parse a string as a base-10 integer, returning {@link fallback} when the
 * value is `null` or non-numeric.
 *
 * Uses `Number.isNaN` instead of the `|| fallback` idiom so that a
 * legitimate `"0"` is not replaced by the fallback.
 */
export function parseIntParam(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Create a JSON {@link Response} with the appropriate content-type header.
 *
 * @param data   - The value to serialise as JSON in the response body.
 * @param status - HTTP status code. Defaults to 200.
 * @returns A `Response` object ready to return from an API route.
 */
export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
