import { z } from "zod";

/**
 * Canonical error code taxonomy for CF-Architect API responses.
 * Every API error must use one of these codes so clients can branch on it
 * without parsing the human-readable `message` string.
 *
 * See PLAN.md §7 for the full error code / HTTP status mapping.
 */
export const ErrorCode = z.enum([
  /** 401 — No valid JWT present or JWT has expired. */
  "UNAUTHENTICATED",
  /** 403 — Caller is authenticated but is not authorised for this action. */
  "FORBIDDEN",
  /** 404 — Resource is absent or not visible to the caller. */
  "NOT_FOUND",
  /** 409 — Optimistic-concurrency version mismatch on a diagram write. */
  "CONFLICT",
  /** 422 — Zod validation failure; `details` contains field-level errors. */
  "UNPROCESSABLE",
  /** 429 — Endpoint-level rate limit exceeded. */
  "RATE_LIMITED",
  /** 500 — Unexpected server error; full error is logged server-side only. */
  "INTERNAL",
]);

export type ErrorCode = z.infer<typeof ErrorCode>;

/** HTTP status codes that correspond to each error code. */
export const ERROR_CODE_HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};
