/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { formatRelativeTime, formatDate } from '../../../src/lib/format'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build an ISO 8601 string that is `secondsAgo` seconds in the past from now.
 *
 * @param secondsAgo - How many seconds in the past to place the timestamp.
 * @returns ISO 8601 string.
 */
function secondsAgo(secondsAgo: number): string {
  return new Date(Date.now() - secondsAgo * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Pin "now" to a fixed point so relative calculations are deterministic
    vi.setSystemTime(new Date('2026-04-17T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for a timestamp less than 60 seconds ago', () => {
    const ts = secondsAgo(30)
    expect(formatRelativeTime(ts)).toBe('just now')
  })

  it('returns "just now" for a timestamp exactly 0 seconds ago', () => {
    const ts = new Date().toISOString()
    expect(formatRelativeTime(ts)).toBe('just now')
  })

  it('returns "just now" for 59 seconds ago', () => {
    const ts = secondsAgo(59)
    expect(formatRelativeTime(ts)).toBe('just now')
  })

  it('returns a minutes-ago string for ~5 minutes ago', () => {
    const ts = secondsAgo(5 * 60)
    expect(formatRelativeTime(ts)).toBe('5 minutes ago')
  })

  it('returns "1 minute ago" for exactly 60 seconds ago', () => {
    const ts = secondsAgo(60)
    // Intl.RelativeTimeFormat with numeric:'auto' renders 1 minute as "1 minute ago"
    expect(formatRelativeTime(ts)).toBe('1 minute ago')
  })

  it('returns a hours-ago string for ~2 hours ago', () => {
    const ts = secondsAgo(2 * 60 * 60)
    expect(formatRelativeTime(ts)).toBe('2 hours ago')
  })

  it('returns a days-ago string for ~3 days ago', () => {
    const ts = secondsAgo(3 * 24 * 60 * 60)
    expect(formatRelativeTime(ts)).toBe('3 days ago')
  })

  it('returns a weeks-ago string for ~2 weeks ago', () => {
    const ts = secondsAgo(14 * 24 * 60 * 60)
    expect(formatRelativeTime(ts)).toBe('2 weeks ago')
  })

  it('returns a months-ago string for ~2 months ago', () => {
    const ts = secondsAgo(60 * 24 * 60 * 60)
    expect(formatRelativeTime(ts)).toBe('2 months ago')
  })

  it('returns a years-ago string for ~1 year ago', () => {
    const ts = secondsAgo(366 * 24 * 60 * 60)
    expect(formatRelativeTime(ts)).toBe('last year')
  })
})

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('formats a date as "Mon DD, YYYY"', () => {
    // Use a date whose formatted output is unambiguous
    const ts = '2026-01-15T10:30:00.000Z'
    const result = formatDate(ts)
    // e.g. "Jan 15, 2026"
    expect(result).toMatch(/Jan\s+15,\s+2026/)
  })

  it('formats a different month correctly', () => {
    const ts = '2025-06-03T00:00:00.000Z'
    const result = formatDate(ts)
    expect(result).toMatch(/Jun\s+3,\s+2025/)
  })

  it('returns a non-empty string for any valid ISO date', () => {
    const ts = '2024-12-31T23:59:59.999Z'
    expect(formatDate(ts).length).toBeGreaterThan(0)
  })
})
