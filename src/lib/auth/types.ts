/**
 * Authentication strategy contract.
 *
 * Provides a pluggable interface for resolving the current user from an
 * incoming request. The MVP uses the bypass implementation (single seed user);
 * post-MVP swaps in an OIDC implementation. Route handlers and components are
 * unaware of which strategy is active.
 */
export interface AuthStrategy {
  /**
   * Resolve the authenticated user for a given request.
   *
   * @param request - The incoming HTTP request (may contain session cookies).
   * @param env     - Cloudflare Worker environment bindings (DB, KV, etc.).
   * @returns The authenticated user, or `null` if no valid session exists.
   */
  resolveUser(request: Request, env: Env): Promise<AppUser | null>;
}

/**
 * Represents an authenticated application user.
 *
 * In the MVP all fields except `id` are nullable because the bypass strategy
 * returns a seed user with no email or avatar. Post-MVP (OIDC), `email` will
 * always be populated.
 */
export interface AppUser {
  /** Unique user identifier (UUID). */
  id: string;
  /** User's email address. Null in MVP bypass mode. */
  email: string | null;
  /** Human-readable display name. */
  displayName: string | null;
  /** URL to the user's avatar image. */
  avatarUrl: string | null;
}

/**
 * UUID of the default seed user created by the initial D1 migration.
 * All diagrams belong to this user in MVP single-user mode.
 */
export const SEED_USER_ID = "00000000-0000-0000-0000-000000000000";
