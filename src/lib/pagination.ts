/**
 * Pagination utility functions.
 *
 * Pure functions for computing page items and building page URLs.
 * Extracted from the `Pagination.astro` component so the logic can be
 * unit-tested independently of Astro's rendering pipeline.
 */

/**
 * Represents a single item in the pagination control — either a clickable
 * page number or an ellipsis placeholder.
 */
export interface PageItem {
  /** Discriminator: `'page'` for a numbered link, `'ellipsis'` for a gap marker. */
  type: 'page' | 'ellipsis'
  /**
   * Page number. Present when `type === 'page'`, absent when `type === 'ellipsis'`.
   */
  page?: number
}

/**
 * Number of pages to show on each side of the current page in the middle window.
 * e.g., with SIBLING_COUNT = 1 and current = 5: [1, …, 4, 5, 6, …, 20]
 */
const SIBLING_COUNT = 1

/**
 * Compute the ordered list of page items to render in a pagination control.
 *
 * The algorithm always shows the first and last page, and a window of
 * `SIBLING_COUNT` pages on either side of the current page. Gaps between
 * the window and the ends are filled with a single ellipsis marker.
 *
 * Returns an empty array when `total <= 1` (no pagination needed).
 *
 * @param current - The currently active page number (1-indexed).
 * @param total - Total number of pages.
 * @returns Ordered array of {@link PageItem} objects.
 *
 * @example
 * computePageItems(5, 10)
 * // → [{ type:'page', page:1 }, { type:'ellipsis' }, { type:'page', page:4 },
 * //     { type:'page', page:5 }, { type:'page', page:6 }, { type:'ellipsis' },
 * //     { type:'page', page:10 }]
 */
export function computePageItems(current: number, total: number): PageItem[] {
  if (total <= 1) return []

  const items: PageItem[] = []

  // Calculate the window around the current page
  const windowStart = Math.max(2, current - SIBLING_COUNT)
  const windowEnd = Math.min(total - 1, current + SIBLING_COUNT)

  // Always include first page
  items.push({ type: 'page', page: 1 })

  // Left ellipsis: gap between page 1 and the window start
  if (windowStart > 2) {
    items.push({ type: 'ellipsis' })
  }

  // Middle window pages
  for (let p = windowStart; p <= windowEnd; p++) {
    items.push({ type: 'page', page: p })
  }

  // Right ellipsis: gap between window end and last page
  if (windowEnd < total - 1) {
    items.push({ type: 'ellipsis' })
  }

  // Always include last page (if total > 1, already handled above)
  if (total > 1) {
    items.push({ type: 'page', page: total })
  }

  return items
}

/**
 * Build a URL for a given page number, preserving any extra query parameters.
 *
 * String values are set as single params; string-array values are appended as
 * repeated params (e.g. `{ tag: ['networking', 'compute'] }` →
 * `?tag=networking&tag=compute`). Empty strings and empty arrays are omitted.
 *
 * The `page` parameter is always appended last for readability. If `page === 1`
 * the parameter is omitted (page 1 is the default).
 *
 * @param baseUrl - The base URL path (e.g. `"/dashboard"` or `"/blueprints"`).
 * @param page - The target page number.
 * @param extraParams - Additional query params to preserve. Values may be a
 *   single string or an array of strings for multi-value params like `tag`.
 * @returns Full URL string with query parameters.
 *
 * @example
 * buildPageUrl('/dashboard', 3, { search: 'vpc', tag: ['workers', 'kv'] })
 * // → "/dashboard?search=vpc&tag=workers&tag=kv&page=3"
 */
export function buildPageUrl(
  baseUrl: string,
  page: number,
  extraParams?: Record<string, string | string[]>,
): string {
  const params = new URLSearchParams()

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v) params.append(key, v)
        }
      } else if (value) {
        params.set(key, value)
      }
    }
  }

  if (page > 1) {
    params.set('page', String(page))
  }

  const query = params.toString()
  return query ? `${baseUrl}?${query}` : baseUrl
}
