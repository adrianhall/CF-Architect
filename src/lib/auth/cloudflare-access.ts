/**
 * Cloudflare Access (Zero Trust) authentication strategy.
 *
 * Verifies the `Cf-Access-Jwt-Assertion` header injected by Cloudflare
 * Access, then upserts the authenticated user into D1 via
 * {@link UserRepository}.
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthStrategy, AppUser } from "./types";
import { createRepositories } from "../repository";

const CF_ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(teamDomain: string) {
  const url = new URL(
    `/cdn-cgi/access/certs`,
    `https://${teamDomain}.cloudflareaccess.com`,
  );
  if (!jwks) {
    jwks = createRemoteJWKSet(url);
  }
  return jwks;
}

/**
 * Cloudflare Access authentication strategy.
 *
 * Reads the JWT from the `Cf-Access-Jwt-Assertion` header, verifies its
 * signature against the team's public JWKS endpoint, and upserts the
 * user into D1.
 */
export const cloudflareAccessAuth: AuthStrategy = {
  async resolveUser(request: Request, env: Env): Promise<AppUser | null> {
    const token = request.headers.get(CF_ACCESS_JWT_HEADER);
    if (!token) return null;

    try {
      const keySet = getJWKS(env.CF_ACCESS_TEAM_DOMAIN);

      const { payload } = await jwtVerify(token, keySet, {
        issuer: `https://${env.CF_ACCESS_TEAM_DOMAIN}.cloudflareaccess.com`,
      });

      const email = payload.email as string | undefined;
      if (!email) return null;

      const displayName =
        (payload.name as string | undefined) ??
        ((payload.custom as Record<string, unknown> | undefined)?.name as
          | string
          | undefined) ??
        null;

      const { users } = createRepositories(env);
      const user = await users.upsert(email, displayName, null);

      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin,
      };
    } catch {
      return null;
    }
  },
};
