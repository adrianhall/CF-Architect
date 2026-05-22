import { z } from "zod";
import { ErrorCode } from "./error-codes.js";

// ---------------------------------------------------------------------------
// Meta — attached to every response
// ---------------------------------------------------------------------------

export const ResponseMeta = z.object({
  /** Unique identifier for the request, echoed from the Worker's logging middleware. */
  requestId: z.string(),
});

export type ResponseMeta = z.infer<typeof ResponseMeta>;

// ---------------------------------------------------------------------------
// Success envelope
// ---------------------------------------------------------------------------

/**
 * Generic success response envelope.
 *
 * @example
 * const result = ApiSuccessResponse(z.object({ status: z.string() }));
 * // { ok: true, data: { status: "ok" }, meta: { requestId: "req_…" } }
 */
export function ApiSuccessResponse<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    ok: z.literal(true),
    data: dataSchema,
    meta: ResponseMeta,
  });
}

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
  meta: ResponseMeta;
};

// ---------------------------------------------------------------------------
// Error envelope
// ---------------------------------------------------------------------------

export const ApiErrorDetail = z.record(z.string(), z.unknown());
export type ApiErrorDetail = z.infer<typeof ApiErrorDetail>;

export const ApiErrorBody = z.object({
  /** Machine-readable error code; clients should branch on this, not on `message`. */
  code: ErrorCode,
  /** Human-readable description of the error. */
  message: z.string(),
  /**
   * Optional structured details — e.g. Zod field errors for UNPROCESSABLE,
   * or `{ conflict: true }` for CONFLICT.
   */
  details: ApiErrorDetail.optional(),
});

export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const ApiErrorResponse = z.object({
  ok: z.literal(false),
  error: ApiErrorBody,
  meta: ResponseMeta.optional(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>;

// ---------------------------------------------------------------------------
// Discriminated union helper
// ---------------------------------------------------------------------------

/**
 * Returns a discriminated union that is either a success envelope wrapping
 * `dataSchema` or the standard error envelope.
 */
export function ApiResponse<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion("ok", [ApiSuccessResponse(dataSchema), ApiErrorResponse]);
}
