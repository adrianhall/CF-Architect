import { describe, it, expect } from 'vitest'

import { generateShareToken, isShareTokenExpired, SHARE_TOKEN_LENGTH } from '../../../src/lib/share'

/** URL-safe characters allowed in share tokens. */
const URL_SAFE_PATTERN = /^[A-Za-z0-9\-_]+$/

describe('generateShareToken', () => {
  it('returns a string of exactly SHARE_TOKEN_LENGTH characters', () => {
    const token = generateShareToken()
    expect(token).toHaveLength(SHARE_TOKEN_LENGTH)
  })

  it('only contains URL-safe characters (A-Z, a-z, 0-9, -, _)', () => {
    const token = generateShareToken()
    expect(URL_SAFE_PATTERN.test(token)).toBe(true)
  })

  it('all tokens in 100 successive calls are URL-safe and 24 chars', () => {
    for (let i = 0; i < 100; i++) {
      const token = generateShareToken()
      expect(token).toHaveLength(SHARE_TOKEN_LENGTH)
      expect(URL_SAFE_PATTERN.test(token)).toBe(true)
    }
  })

  it('produces different tokens on successive calls', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateShareToken()))
    // Probability of any collision in 20 tokens is astronomically small (~143 bits entropy)
    expect(tokens.size).toBe(20)
  })
})

describe('isShareTokenExpired', () => {
  it('returns false for null (never expires)', () => {
    expect(isShareTokenExpired(null)).toBe(false)
  })

  it('returns false for a date in the future', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(isShareTokenExpired(future)).toBe(false)
  })

  it('returns true for a date in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isShareTokenExpired(past)).toBe(true)
  })

  it('returns true for the Unix epoch (far in the past)', () => {
    expect(isShareTokenExpired('1970-01-01T00:00:00.000Z')).toBe(true)
  })
})
