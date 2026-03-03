/**
 * Authentication strategy contract.
 *
 * Provides a pluggable interface for resolving the current user from an
 * incoming request. The active strategy is Cloudflare Access JWT
 * verification in production, with a dev-mode fallback for local
 * development.
 */
export interface AuthStrategy {
  /**
   * Resolve the authenticated user for a given request.
   *
   * @param request - The incoming HTTP request (may contain JWT headers).
   * @param env     - Cloudflare Worker environment bindings (DB, KV, etc.).
   * @returns The authenticated user, or `null` if no valid session exists.
   */
  resolveUser(request: Request, env: Env): Promise<AppUser | null>;
}

/**
 * Represents an authenticated application user.
 *
 * Populated from the Cloudflare Access JWT payload and persisted in D1.
 * The `id` is a server-generated UUID (not the CF Access `sub`), ensuring
 * stable FK references across diagrams and share links.
 */
export interface AppUser {
  /** Unique user identifier (UUID, generated server-side). */
  id: string;
  /** User's email address from the Cloudflare Access JWT. */
  email: string | null;
  /** Human-readable display name. */
  displayName: string | null;
  /** URL to the user's avatar image. */
  avatarUrl: string | null;
  /** Whether this user has administrative privileges. */
  isAdmin: boolean;
}
