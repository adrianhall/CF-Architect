/** Length of generated share tokens in characters. */
export const SHARE_TOKEN_LENGTH = 24

/**
 * URL-safe alphabet used for share token generation.
 * 64 characters: A-Z, a-z, 0-9, `-`, `_`.
 * Each character maps to exactly one 6-bit value (2^6 = 64), making modulo mapping uniform.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/**
 * Generate a cryptographically random URL-safe share token.
 *
 * Uses `crypto.getRandomValues` to fill a Uint8Array of {@link SHARE_TOKEN_LENGTH} bytes,
 * then maps each byte to the 64-character URL-safe alphabet via modulo.
 * Produces approximately 143 bits of entropy (24 × log2(64) = 144 bits theoretical).
 *
 * @returns A 24-character URL-safe token string.
 */
export function generateShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_TOKEN_LENGTH))
  let token = ''
  for (const byte of bytes) {
    token += ALPHABET[byte % ALPHABET.length]
  }
  return token
}

/**
 * Check whether a share token has expired.
 *
 * @param expiresAt - ISO 8601 expiry timestamp, or `null` if the token never expires.
 * @returns `true` if the token is expired, `false` otherwise.
 *   A `null` `expiresAt` is treated as never-expiring and returns `false`.
 */
export function isShareTokenExpired(expiresAt: string | null): boolean {
  if (expiresAt === null) return false
  return new Date(expiresAt).getTime() < Date.now()
}
