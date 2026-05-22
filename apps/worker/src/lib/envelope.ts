/**
 * apps/worker/src/lib/envelope.ts
 *
 * Response envelope helpers for the Hono Worker.
 * Always returns objects that match the Zod schemas in @cf-architect/shared.
 */

import type {
  ApiErrorBody,
  ApiSuccessResponse,
  ApiErrorResponse,
  ErrorCodeType,
  ResponseMeta,
} from "@cf-architect/shared";

// ---------------------------------------------------------------------------
// Success helper
// ---------------------------------------------------------------------------

/**
 * Builds a success response envelope.
 *
 * @example
 * return c.json(ok({ status: "ok", timestamp: new Date().toISOString() }, requestId));
 */
export function ok<T>(data: T, meta: ResponseMeta): ApiSuccessResponse<T> {
  return { ok: true, data, meta };
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

/**
 * Builds an error response envelope.
 *
 * @example
 * return c.json(err("NOT_FOUND", "Route not found"), 404);
 */
export function err(
  code: ErrorCodeType,
  message: string,
  details?: ApiErrorBody["details"],
  meta?: ResponseMeta,
): ApiErrorResponse {
  const error: ApiErrorBody = { code, message };
  if (details !== undefined) {
    error.details = details;
  }
  const response: ApiErrorResponse = { ok: false, error };
  if (meta !== undefined) {
    response.meta = meta;
  }
  return response;
}
