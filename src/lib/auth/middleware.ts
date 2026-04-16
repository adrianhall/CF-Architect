/** TTL for cached JWKS keys in KV: 1 hour in seconds. */
const JWKS_CACHE_TTL = 3600

/** KV key under which the JWKS JSON string is stored. */
const JWKS_CACHE_KEY = 'jwks:keys'

/**
 * A single JSON Web Key from the JWKS endpoint.
 * We only need the fields required for RS256 signature verification.
 */
interface JsonWebKey {
  /** Key type — always `'RSA'` for CF Access. */
  kty: string
  /** Key ID — matched against the `kid` header of the incoming JWT. */
  kid: string
  /** Algorithm — `'RS256'` for CF Access. */
  alg?: string
  /** RSA modulus (base64url-encoded). */
  n: string
  /** RSA public exponent (base64url-encoded). */
  e: string
  /** Intended use — `'sig'` for signing keys. */
  use?: string
}

/**
 * The shape returned by the CF Access JWKS endpoint.
 */
interface JwksResponse {
  /** Array of JSON Web Keys. */
  keys: JsonWebKey[]
}

/**
 * Decoded JWT payload claims used for validation.
 */
interface JwtClaims {
  /** Issuer. */
  iss?: string
  /** Audience. */
  aud?: string | string[]
  /** Expiry time (Unix epoch seconds). */
  exp?: number
  /** Issued-at time (Unix epoch seconds). */
  iat?: number
  /** Subject. */
  sub?: string
  /** Email extracted from the CF Access JWT. */
  email?: string
  /** Any other claims. */
  [key: string]: unknown
}

/**
 * Decoded JWT header fields used for key selection.
 */
interface JwtHeader {
  /** Algorithm — `'RS256'` for CF Access. */
  alg: string
  /** Key ID — used to select the matching public key from JWKS. */
  kid?: string
}

/**
 * Structured identity data returned by the CF Access identity endpoint.
 * Shape derived from spec §8.1 and the CF Access documentation.
 */
export interface CfAccessIdentity {
  /** String version of the numeric GitHub user ID. */
  githubId: string
  /** GitHub login handle. */
  githubUsername: string
  /** Display name from CF Access profile (falls back to username). */
  displayName: string
  /** GitHub avatar URL; may be null. */
  avatarUrl: string | null
  /** Email from CF Access profile. */
  email: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode a base64url-encoded string to a UTF-8 string.
 * Base64url uses `-` and `_` instead of `+` and `/`, and omits padding.
 *
 * @param base64url - The base64url-encoded input string.
 * @returns The decoded UTF-8 string.
 */
function base64urlDecode(base64url: string): string {
  // Replace URL-safe chars and add padding
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Decode a base64url-encoded string to a raw `Uint8Array<ArrayBuffer>` (binary, not UTF-8).
 * Used when decoding the binary signature of a JWT.
 *
 * The explicit `ArrayBuffer` generic satisfies the `BufferSource` constraint
 * required by `crypto.subtle.verify`.
 *
 * @param base64url - The base64url-encoded input string.
 * @returns The decoded bytes backed by a plain `ArrayBuffer`.
 */
function base64urlToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=')
  const binary = atob(base64)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Fetch JWKS keys from the CF Access endpoint.
 * On cache hit, returns the cached keys to avoid a network round-trip on every request.
 * On cache miss, fetches fresh keys and writes them to KV with a 1-hour TTL.
 *
 * @param teamName - The CF Access team name (subdomain of cloudflareaccess.com).
 * @param cache - The KV namespace binding used to cache JWKS.
 * @returns The parsed JWKS key array.
 * @throws If the network fetch fails or the response is not valid JSON.
 */
async function fetchJwks(teamName: string, cache: KVNamespace): Promise<JsonWebKey[]> {
  // Check KV cache first
  const cached = await cache.get(JWKS_CACHE_KEY)
  if (cached !== null) {
    return (JSON.parse(cached) as JwksResponse).keys
  }

  // Fetch fresh keys from CF Access
  // Ref: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
  const jwksUrl = `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/certs`
  const response = await fetch(jwksUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS from ${jwksUrl}: ${response.status}`)
  }

  const jwks = (await response.json()) as JwksResponse
  await cache.put(JWKS_CACHE_KEY, JSON.stringify(jwks), { expirationTtl: JWKS_CACHE_TTL })
  return jwks.keys
}

/**
 * Import an RSA public key from a JSON Web Key for use with `crypto.subtle.verify`.
 * Uses RSASSA-PKCS1-v1_5 with SHA-256 to match CF Access RS256 JWTs.
 *
 * @param jwk - The JSON Web Key to import.
 * @returns A `CryptoKey` ready for signature verification.
 */
async function importRsaPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  // Web Crypto API — RSASSA-PKCS1-v1_5 / SHA-256 matches RS256 algorithm
  // Ref: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false, // not extractable
    ['verify'],
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a Cloudflare Access RS256 JWT and return the `email` claim.
 *
 * Steps (spec §8.1):
 * 1. Split JWT into header / payload / signature segments.
 * 2. Decode and parse header to find the `kid` used for signing.
 * 3. Fetch JWKS from CF Access (cached in KV for 1 hour).
 * 4. Find the matching public key by `kid`.
 * 5. Import the public key via Web Crypto and verify the RS256 signature.
 * 6. Verify the `exp` claim (token must not be expired).
 * 7. Return the `email` claim from the payload.
 *
 * @param token - The raw JWT string from the `CF_Authorization` cookie.
 * @param teamName - The CF Access team name (subdomain prefix).
 * @param cache - KV namespace used to cache JWKS keys.
 * @returns The `email` claim from the validated JWT payload.
 * @throws If the JWT is malformed, the signature is invalid, or the token is expired.
 */
export async function validateCfAccessJwt(
  token: string,
  teamName: string,
  cache: KVNamespace,
): Promise<string> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Malformed JWT: expected 3 dot-separated segments')
  }

  const [headerB64, payloadB64, signatureB64] = parts

  // Parse header and payload
  let header: JwtHeader
  let claims: JwtClaims
  try {
    header = JSON.parse(base64urlDecode(headerB64)) as JwtHeader
    claims = JSON.parse(base64urlDecode(payloadB64)) as JwtClaims
  } catch {
    throw new Error('Malformed JWT: could not parse header or payload')
  }

  // Verify expiry before touching JWKS (fast-fail)
  const now = Math.floor(Date.now() / 1000)
  if (typeof claims.exp === 'number' && claims.exp < now) {
    throw new Error('JWT has expired')
  }

  // Fetch and cache JWKS
  const keys = await fetchJwks(teamName, cache)

  // Select the key matching this JWT's kid
  const matchingKey = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0]
  if (!matchingKey) {
    throw new Error(`No JWKS key found for kid: ${header.kid ?? '(none)'}`)
  }

  // Import RSA public key and verify signature
  const cryptoKey = await importRsaPublicKey(matchingKey)

  // The signed data is `header_b64url.payload_b64url` encoded as UTF-8 bytes
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const signatureBytes = base64urlToBytes(signatureB64)

  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    cryptoKey,
    signatureBytes,
    signedData,
  )

  if (!valid) {
    throw new Error('JWT signature verification failed')
  }

  // Extract email from claims
  if (!claims.email || typeof claims.email !== 'string') {
    throw new Error('JWT claims missing required email field')
  }

  return claims.email
}

/**
 * Fetch the GitHub profile for the authenticated user from the CF Access identity endpoint.
 *
 * This is called only on first login (when the user is not yet in the DB).
 * Subsequent requests resolve the user from the DB/KV cache.
 *
 * The identity endpoint requires the user's `CF_Authorization` cookie to identify
 * which session to return profile data for.
 *
 * @param teamName - The CF Access team name (subdomain prefix).
 * @param cfAuthCookie - The raw value of the user's `CF_Authorization` cookie.
 * @returns A structured {@link CfAccessIdentity} with GitHub profile fields.
 * @throws If the identity endpoint returns a non-200 status.
 */
export async function fetchCfAccessIdentity(
  teamName: string,
  cfAuthCookie: string,
): Promise<CfAccessIdentity> {
  // Ref: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/application-token/
  const identityUrl = `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/get-identity`
  const response = await fetch(identityUrl, {
    headers: { cookie: `CF_Authorization=${cfAuthCookie}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch CF Access identity: ${response.status} ${response.statusText}`)
  }

  const raw = (await response.json()) as {
    email?: string
    name?: string
    github?: {
      id?: number | string
      login?: string
      avatar_url?: string
    }
  }

  const githubId = String(raw.github?.id ?? '')
  const githubUsername = raw.github?.login ?? ''
  const displayName = raw.name ?? githubUsername
  const avatarUrl = raw.github?.avatar_url ?? null
  const email = raw.email ?? ''

  return { githubId, githubUsername, displayName, avatarUrl, email }
}
