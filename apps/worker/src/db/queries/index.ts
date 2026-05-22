/**
 * apps/worker/src/db/queries/index.ts
 *
 * Barrel export for all D1 query helpers.
 */

export { upsertUser, getUserById, setUserRole, deleteUser, listUsers } from "./users.js";
export type { UserRow, UpsertUserParams, ListUsersParams, ListUsersResult } from "./users.js";

export { insertAuditEntry, listAuditEntries } from "./audit.js";
export type {
  AdminAuditRow,
  InsertAuditEntryParams,
  AuditEntryWithActor,
  ListAuditEntriesResult,
} from "./audit.js";

export { getUserPreferences, setUserPreferences } from "./preferences.js";
export type { UserPreferencesRow, SetUserPreferencesParams } from "./preferences.js";
