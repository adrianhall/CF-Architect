/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { env } from 'cloudflare:workers'

import { validateCfAccessJwt, fetchCfAccessIdentity } from '../../../../src/lib/auth/middleware'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Extended JWK type that includes the `kid` field.
 * The built-in DOM `JsonWebKey` omits `kid` despite it being standard (RFC 7517).
 */
interface JwkWithKid extends JsonWebKey {
  kid: string
  alg: string
  use: string
}

// ---------------------------------------------------------------------------
// Helpers — build real RS256 JWTs using the Web Crypto API available in workerd
// ---------------------------------------------------------------------------

/** Base64url-encodes an arbitrary object as JSON. */
function b64url(obj: unknown): string {
  const json = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Base64url-encodes raw bytes (used for the signature segment). */
function bytesToB64url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let binary = ''
  for (const byte of arr) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface TestKeyPair {
  privateKey: CryptoKey
  publicKey: CryptoKey
  /** JWK representation of the public key (with kid), suitable for a JWKS response. */
  jwk: JwkWithKid
}

/** Generate a fresh RSA-PKCS1-v1_5 / SHA-256 key pair for testing. */
async function generateTestKeyPair(kid = 'test-kid-001'): Promise<TestKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )

  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  // Attach kid so the validation logic can match it
  const jwkWithKid: JwkWithKid = { ...jwk, kid, alg: 'RS256', use: 'sig' }

  return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, jwk: jwkWithKid }
}

interface BuildJwtOptions {
  kid?: string
  exp?: number
  email?: string
  /** If true, corrupt the signature bytes to simulate a tampered token. */
  corruptSignature?: boolean
}

/** Build a signed RS256 JWT with the given options. */
async function buildJwt(privateKey: CryptoKey, opts: BuildJwtOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', kid: opts.kid ?? 'test-kid-001' }
  const payload = {
    iss: 'https://test-team.cloudflareaccess.com',
    aud: 'test-audience',
    sub: 'user-subject-001',
    iat: now,
    exp: opts.exp ?? now + 3600,
    email: opts.email ?? 'user@example.com',
  }

  const headerB64 = b64url(header)
  const payloadB64 = b64url(payload)
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`)

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    signedData,
  )

  let sigB64 = bytesToB64url(signatureBuffer)

  if (opts.corruptSignature) {
    // Flip one character to invalidate the signature
    sigB64 = sigB64.slice(0, -1) + (sigB64.endsWith('A') ? 'B' : 'A')
  }

  return `${headerB64}.${payloadB64}.${sigB64}`
}

/** Build a JWKS JSON string from a list of public key JWKs. */
function buildJwks(keys: JsonWebKey[]): string {
  return JSON.stringify({ keys })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateCfAccessJwt', () => {
  let kp: TestKeyPair

  beforeEach(async () => {
    // Clear any cached JWKS from prior tests to avoid stale key contamination
    await env.CACHE.delete('jwks:keys')

    kp = await generateTestKeyPair()
    // Stub fetch to return the test JWKS
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) => {
        const urlStr = String(url)
        if (urlStr.includes('cloudflareaccess.com/cdn-cgi/access/certs')) {
          return new Response(buildJwks([kp.jwk]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('Not Found', { status: 404 })
      }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the email claim for a valid JWT', async () => {
    const jwt = await buildJwt(kp.privateKey, { kid: kp.jwk.kid as string })
    const email = await validateCfAccessJwt(jwt, 'test-team', env.CACHE)
    expect(email).toBe('user@example.com')
  })

  it('throws on a malformed JWT (not 3 segments)', async () => {
    await expect(
      validateCfAccessJwt('not.a.valid.jwt.at.all', 'test-team', env.CACHE),
    ).rejects.toThrow('Malformed JWT')
  })

  it('throws on a malformed JWT (only 1 segment)', async () => {
    await expect(validateCfAccessJwt('onlyone', 'test-team', env.CACHE)).rejects.toThrow(
      'Malformed JWT',
    )
  })

  it('throws on an expired JWT', async () => {
    const past = Math.floor(Date.now() / 1000) - 10 // 10 seconds ago
    const jwt = await buildJwt(kp.privateKey, { kid: kp.jwk.kid as string, exp: past })
    await expect(validateCfAccessJwt(jwt, 'test-team', env.CACHE)).rejects.toThrow('expired')
  })

  it('throws when the JWT signature has been tampered with', async () => {
    const jwt = await buildJwt(kp.privateKey, {
      kid: kp.jwk.kid as string,
      corruptSignature: true,
    })
    await expect(validateCfAccessJwt(jwt, 'test-team', env.CACHE)).rejects.toThrow(
      /signature|verify/i,
    )
  })

  it('caches the JWKS in KV on first call', async () => {
    const jwt = await buildJwt(kp.privateKey, { kid: kp.jwk.kid as string })
    await validateCfAccessJwt(jwt, 'test-team', env.CACHE)

    const cached = await env.CACHE.get('jwks:keys')
    expect(cached).not.toBeNull()
    const parsed = JSON.parse(cached!) as { keys: unknown[] }
    expect(parsed.keys).toHaveLength(1)
  })

  it('uses cached JWKS on second call without re-fetching', async () => {
    const jwt = await buildJwt(kp.privateKey, { kid: kp.jwk.kid as string })

    // First call — populates cache
    await validateCfAccessJwt(jwt, 'test-team', env.CACHE)
    const fetchMock = vi.mocked(fetch)
    const callsAfterFirst = fetchMock.mock.calls.length

    // Second call — should use KV cache, not re-fetch
    await validateCfAccessJwt(jwt, 'test-team', env.CACHE)
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst)
  })

  it('throws when no JWKS key matches the JWT kid', async () => {
    const jwt = await buildJwt(kp.privateKey, { kid: 'unknown-kid-999' })
    await expect(validateCfAccessJwt(jwt, 'test-team', env.CACHE)).rejects.toThrow(
      /No JWKS key found/,
    )
  })
})

describe('fetchCfAccessIdentity', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses GitHub profile data correctly', async () => {
    const mockIdentity = {
      email: 'alice@example.com',
      name: 'Alice Example',
      github: {
        id: 42,
        login: 'alice',
        avatar_url: 'https://avatars.githubusercontent.com/u/42',
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(mockIdentity), { status: 200 })),
    )

    const identity = await fetchCfAccessIdentity('test-team', 'test-cookie-value')
    expect(identity.githubId).toBe('42')
    expect(identity.githubUsername).toBe('alice')
    expect(identity.displayName).toBe('Alice Example')
    expect(identity.avatarUrl).toBe('https://avatars.githubusercontent.com/u/42')
    expect(identity.email).toBe('alice@example.com')
  })

  it('falls back to github.login when name is absent', async () => {
    const mockIdentity = {
      email: 'bob@example.com',
      github: { id: 99, login: 'bobdev', avatar_url: null },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(mockIdentity), { status: 200 })),
    )

    const identity = await fetchCfAccessIdentity('test-team', 'cookie')
    expect(identity.displayName).toBe('bobdev')
  })

  it('returns null avatarUrl when github.avatar_url is absent', async () => {
    const mockIdentity = {
      email: 'charlie@example.com',
      github: { id: 7, login: 'charlie' },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(mockIdentity), { status: 200 })),
    )

    const identity = await fetchCfAccessIdentity('test-team', 'cookie')
    expect(identity.avatarUrl).toBeNull()
  })

  it('throws on a non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Unauthorized', { status: 401 })),
    )

    await expect(fetchCfAccessIdentity('test-team', 'bad-cookie')).rejects.toThrow(
      /Failed to fetch CF Access identity/,
    )
  })

  it('sends the CF_Authorization cookie in the request', async () => {
    const capturedRequests: Request[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown, init?: RequestInit) => {
        capturedRequests.push(new Request(String(input), init))
        return new Response(
          JSON.stringify({ email: 'e@e.com', github: { id: 1, login: 'u', avatar_url: null } }),
          { status: 200 },
        )
      }),
    )

    await fetchCfAccessIdentity('my-team', 'my-secret-cookie')
    const req = capturedRequests[0]
    expect(req.headers.get('cookie')).toBe('CF_Authorization=my-secret-cookie')
  })
})
