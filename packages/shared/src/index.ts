/**
 * @cf-architect/shared
 *
 * Public API surface for the shared package.
 * Import from this barrel in both `apps/web` and `apps/worker`.
 */

// Zod schemas and TypeScript types for API response envelopes
export {
  ResponseMeta,
  ApiSuccessResponse,
  ApiErrorDetail,
  ApiErrorBody,
  ApiErrorResponse,
  ApiResponse,
} from "./schemas/envelope.js";
export type { ResponseMeta as ResponseMetaType } from "./schemas/envelope.js";

// Error code enum and HTTP status map
export { ErrorCode, ERROR_CODE_HTTP_STATUS } from "./schemas/error-codes.js";
export type { ErrorCode as ErrorCodeType } from "./schemas/error-codes.js";
