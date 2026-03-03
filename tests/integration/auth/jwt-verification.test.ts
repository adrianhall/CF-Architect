/**
 * Integration tests for Cloudflare Access JWT verification.
 *
 * Uses real RSA key pairs and jose crypto to verify the full
 * JWT signing → verification → user-upsert pipeline without
 * mocking the jose library's core functions.
 *
 * Only the JWKS URL fetch (swapped for a local key set) and the
 * database layer are mocked.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { generateKeyPair, SignJWT, exportJWK } from "jose";

// ---------------------------------------------------------------------------
// Mocks – DB layer only; jose crypto runs for real
// ---------------------------------------------------------------------------

const mockUpsert = vi.fn();
vi.mock("@lib/repository", () => ({
  createRepositories: () => ({
    users: { upsert: mockUpsert },
  }),
}));

let publicJWK: JsonWebKey & { alg: string; use: string };

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: () =>
      actual.createLocalJWKSet({ keys: [publicJWK] } as any),
  };
});

// ---------------------------------------------------------------------------
// Lazy import so vi.mock factories execute first
// ---------------------------------------------------------------------------

const { cloudflareAccessAuth } = await import("@lib/auth/cloudflare-access");

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const TEAM_DOMAIN = "testteam";
const ISSUER = `https://${TEAM_DOMAIN}.cloudflareaccess.com`;

const TEST_ENV = {
  CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
  DB: {} as D1Database,
  KV: {} as KVNamespace,
};

let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwk.alg = "RS256";
  jwk.use = "sig";
  publicJWK = jwk as typeof publicJWK;
});

beforeEach(() => {
  vi.clearAllMocks();
});

function makeDbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "uuid-1",
    email: "alice@example.com",
    displayName: "Alice",
    avatarUrl: null,
    isAdmin: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function signJWT(
  claims: Record<string, unknown>,
  options: { issuer?: string; expiresIn?: string | number } = {},
) {
  const builder = new SignJWT(claims as any)
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(options.issuer ?? ISSUER)
    .setIssuedAt();

  if (typeof options.expiresIn === "number") {
    builder.setExpirationTime(options.expiresIn);
  } else {
    builder.setExpirationTime(options.expiresIn ?? "1h");
  }

  return builder.sign(privateKey);
}

function requestWithJWT(token: string) {
  return new Request("http://localhost:4321/dashboard", {
    headers: { "cf-access-jwt-assertion": token },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JWT verification integration (real crypto)", () => {
  it("accepts a correctly signed JWT and returns the upserted user", async () => {
    const token = await signJWT({ email: "alice@example.com", name: "Alice" });
    const dbUser = makeDbUser();
    mockUpsert.mockResolvedValue(dbUser);

    const result = await cloudflareAccessAuth.resolveUser(
      requestWithJWT(token),
      TEST_ENV as any,
    );

    expect(result).toEqual({
      id: "uuid-1",
      email: "alice@example.com",
      displayName: "Alice",
      avatarUrl: null,
      isAdmin: false,
    });
    expect(mockUpsert).toHaveBeenCalledWith("alice@example.com", "Alice", null);
  });

  it("rejects a JWT signed with a different private key", async () => {
    const { privateKey: wrongKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({ email: "eve@example.com" } as any)
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(wrongKey);

    const result = await cloudflareAccessAuth.resolveUser(
      requestWithJWT(token),
      TEST_ENV as any,
    );

    expect(result).toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects a JWT with wrong issuer", async () => {
    const token = await signJWT(
      { email: "bob@example.com" },
      { issuer: "https://wrong-team.cloudflareaccess.com" },
    );

    const result = await cloudflareAccessAuth.resolveUser(
      requestWithJWT(token),
      TEST_ENV as any,
    );

    expect(result).toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects an expired JWT", async () => {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    const token = await signJWT(
      { email: "expired@example.com" },
      { expiresIn: oneHourAgo },
    );

    const result = await cloudflareAccessAuth.resolveUser(
      requestWithJWT(token),
      TEST_ENV as any,
    );

    expect(result).toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("extracts name from custom claim when top-level name is absent", async () => {
    const token = await signJWT({
      email: "custom@example.com",
      custom: { name: "Custom Name" },
    });
    const dbUser = makeDbUser({
      email: "custom@example.com",
      displayName: "Custom Name",
    });
    mockUpsert.mockResolvedValue(dbUser);

    const result = await cloudflareAccessAuth.resolveUser(
      requestWithJWT(token),
      TEST_ENV as any,
    );

    expect(result).not.toBeNull();
    expect(mockUpsert).toHaveBeenCalledWith(
      "custom@example.com",
      "Custom Name",
      null,
    );
  });

  it("returns null when JWT payload has no email claim", async () => {
    const token = await signJWT({ sub: "no-email-user" });
    const result = await cloudflareAccessAuth.resolveUser(
      requestWithJWT(token),
      TEST_ENV as any,
    );

    expect(result).toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
