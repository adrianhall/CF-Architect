/**
 * Date and time formatting utilities.
 *
 * Uses `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` for locale-aware
 * formatting without external dependencies. Both functions accept ISO 8601
 * timestamps as stored in the D1 database.
 */

/** Thresholds (in seconds) for each relative time unit. */
const RELATIVE_TIME_THRESHOLDS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: 'year', seconds: 365 * 24 * 60 * 60 },
  { unit: 'month', seconds: 30 * 24 * 60 * 60 },
  { unit: 'week', seconds: 7 * 24 * 60 * 60 },
  { unit: 'day', seconds: 24 * 60 * 60 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
]

/** Number of seconds below which we show "just now" instead of a unit. */
const JUST_NOW_THRESHOLD_SECONDS = 60

/**
 * Format an ISO 8601 timestamp as a locale-aware relative time string.
 *
 * Examples: "just now", "5 minutes ago", "2 hours ago", "3 days ago".
 *
 * Uses `Intl.RelativeTimeFormat` with the `'auto'` numeric option so that
 * values like -1 day render as "yesterday" rather than "1 day ago" in
 * locales that support it.
 *
 * @param isoDate - ISO 8601 timestamp string (e.g. `"2026-01-15T10:30:00.000Z"`).
 * @returns Human-readable relative time string.
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSeconds < JUST_NOW_THRESHOLD_SECONDS) {
    return 'just now'
  }

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  for (const { unit, seconds } of RELATIVE_TIME_THRESHOLDS) {
    if (diffSeconds >= seconds) {
      const value = Math.floor(diffSeconds / seconds)
      return formatter.format(-value, unit)
    }
  }

  // Fallback: show seconds (< 60s already handled above, so this shouldn't fire)
  return formatter.format(-diffSeconds, 'second')
}

/**
 * Format an ISO 8601 timestamp as a concise readable date string.
 *
 * Example: "Jan 15, 2026".
 *
 * @param isoDate - ISO 8601 timestamp string (e.g. `"2026-01-15T10:30:00.000Z"`).
 * @returns Formatted date string using the user's locale.
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
