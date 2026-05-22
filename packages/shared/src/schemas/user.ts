import { z } from "zod";

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

export const Role = z.enum(["user", "admin"]);
export type Role = z.infer<typeof Role>;

// ---------------------------------------------------------------------------
// User — persisted record
// ---------------------------------------------------------------------------

/**
 * A user record as stored in the `users` D1 table and returned by the API.
 *
 * `id` is the Cloudflare Access `sub` claim — a stable, opaque identifier
 * for the user across sessions.
 */
export const User = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: Role,
  /** Unix milliseconds — when the user row was first created. */
  createdAt: z.number().int(),
  /** Unix milliseconds — updated on every login. */
  lastLoginAt: z.number().int(),
});

export type User = z.infer<typeof User>;

// ---------------------------------------------------------------------------
// Me — current-user response (User + session expiry)
// ---------------------------------------------------------------------------

/**
 * Response shape for `GET /api/me`.
 *
 * Extends `User` with `exp` (Unix seconds, from the JWT `exp` claim) so the
 * client can display a session-expiry warning without reading the
 * `CF_Authorization` cookie directly (which stays `HttpOnly`).
 */
export const Me = User.extend({
  /** JWT expiry time in Unix seconds. */
  exp: z.number().int(),
});

export type Me = z.infer<typeof Me>;
