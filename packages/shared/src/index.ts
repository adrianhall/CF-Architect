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

// User + session schemas (Phase 02)
export { Role, User, Me } from "./schemas/user.js";
export type { Role as RoleType, User as UserType, Me as MeType } from "./schemas/user.js";

// User preferences schemas (Phase 02)
export { Theme, UserPreferences, UpdateUserPreferencesInput } from "./schemas/preferences.js";
export type {
  Theme as ThemeType,
  UserPreferences as UserPreferencesType,
  UpdateUserPreferencesInput as UpdateUserPreferencesInputType,
} from "./schemas/preferences.js";

// Audit schemas (Phase 02)
export { AdminAuditAction, AdminAuditEntry } from "./schemas/audit.js";
export type {
  AdminAuditAction as AdminAuditActionType,
  AdminAuditEntry as AdminAuditEntryType,
} from "./schemas/audit.js";

// Admin API schemas (Phase 02)
export {
  ListUsersQuery,
  AdminUserRow,
  ListUsersResponse,
  UpdateRoleInput,
  ListAuditQuery,
  ListAuditResponse,
} from "./schemas/admin.js";
export type {
  ListUsersQuery as ListUsersQueryType,
  AdminUserRow as AdminUserRowType,
  ListUsersResponse as ListUsersResponseType,
  UpdateRoleInput as UpdateRoleInputType,
  ListAuditQuery as ListAuditQueryType,
  ListAuditResponse as ListAuditResponseType,
} from "./schemas/admin.js";
