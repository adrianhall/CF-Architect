/**
 * MVP authentication bypass strategy.
 *
 * Returns the seed user unconditionally on every request, effectively
 * disabling authentication. All diagrams are owned by this single user.
 * Replace with the OIDC strategy post-MVP.
 */
import type { AuthStrategy, AppUser } from "./types";
import { SEED_USER_ID } from "./types";

/** The hard-coded seed user returned for all requests in MVP mode. */
const seedUser: AppUser = {
  id: SEED_USER_ID,
  email: null,
  displayName: "Default User",
  avatarUrl: null,
};

/**
 * Bypass authentication strategy.
 *
 * Implements {@link AuthStrategy} by always resolving to the seed user,
 * regardless of the request contents or environment.
 */
export const bypassAuth: AuthStrategy = {
  resolveUser() {
    return Promise.resolve(seedUser);
  },
};
