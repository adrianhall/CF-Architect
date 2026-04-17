/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { describe, it, expect } from 'vitest'

import { computePageItems, buildPageUrl } from '../../../src/lib/pagination'
import type { PageItem } from '../../../src/lib/pagination'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract only the page numbers from a PageItem array.
 * Useful for asserting the set of visible page buttons without worrying
 * about ellipsis positions.
 *
 * @param items - Output of {@link computePageItems}.
 * @returns Array of page numbers in order.
 */
function pageNumbers(items: PageItem[]): number[] {
  return items.filter((i) => i.type === 'page').map((i) => i.page as number)
}

/**
 * Extract a simplified string representation for snapshot-style assertions.
 * Pages render as their number; ellipsis renders as '…'.
 *
 * @param items - Output of {@link computePageItems}.
 * @returns Human-readable string, e.g. "1 … 4 5 6 … 10".
 */
function render(items: PageItem[]): string {
  return items.map((i) => (i.type === 'ellipsis' ? '…' : String(i.page))).join(' ')
}

// ---------------------------------------------------------------------------
// computePageItems
// ---------------------------------------------------------------------------

describe('computePageItems', () => {
  it('returns empty array when total is 0', () => {
    expect(computePageItems(1, 0)).toEqual([])
  })

  it('returns empty array when total is 1', () => {
    expect(computePageItems(1, 1)).toEqual([])
  })

  it('returns all pages when total is small (≤ 5)', () => {
    expect(render(computePageItems(1, 3))).toBe('1 2 3')
    expect(render(computePageItems(2, 4))).toBe('1 2 3 4')
    expect(render(computePageItems(3, 5))).toBe('1 2 3 4 5')
  })

  it('shows ellipsis on the right when current page is near the start', () => {
    const items = computePageItems(1, 10)
    expect(render(items)).toBe('1 2 … 10')
  })

  it('shows ellipsis on the left when current page is near the end', () => {
    const items = computePageItems(10, 10)
    expect(render(items)).toBe('1 … 9 10')
  })

  it('shows ellipsis on both sides when current page is in the middle', () => {
    const items = computePageItems(5, 10)
    expect(render(items)).toBe('1 … 4 5 6 … 10')
  })

  it('always includes page 1 and the last page', () => {
    for (const current of [1, 3, 8, 15, 20]) {
      const items = computePageItems(current, 20)
      const pages = pageNumbers(items)
      expect(pages[0]).toBe(1)
      expect(pages[pages.length - 1]).toBe(20)
    }
  })

  it('always includes the current page', () => {
    for (const current of [1, 5, 10, 15, 20]) {
      const pages = pageNumbers(computePageItems(current, 20))
      expect(pages).toContain(current)
    }
  })

  it('places left ellipsis correctly (page 5 of 20)', () => {
    const items = computePageItems(5, 20)
    expect(render(items)).toBe('1 … 4 5 6 … 20')
  })

  it('no left ellipsis when window is adjacent to page 1', () => {
    // current=2 → window [1,2,3] — no gap between 1 and window start
    const items = computePageItems(2, 10)
    expect(render(items)).toBe('1 2 3 … 10')
  })

  it('no right ellipsis when window is adjacent to last page', () => {
    // current=9 of 10 → window [8,9,10] — no gap
    const items = computePageItems(9, 10)
    expect(render(items)).toBe('1 … 8 9 10')
  })

  it('two-page set returns both pages', () => {
    expect(render(computePageItems(1, 2))).toBe('1 2')
    expect(render(computePageItems(2, 2))).toBe('1 2')
  })
})

// ---------------------------------------------------------------------------
// buildPageUrl
// ---------------------------------------------------------------------------

describe('buildPageUrl', () => {
  it('returns the base URL for page 1 (no page param)', () => {
    expect(buildPageUrl('/dashboard', 1)).toBe('/dashboard')
  })

  it('appends ?page=N for pages > 1', () => {
    expect(buildPageUrl('/dashboard', 2)).toBe('/dashboard?page=2')
    expect(buildPageUrl('/dashboard', 10)).toBe('/dashboard?page=10')
  })

  it('preserves extra query params', () => {
    const url = buildPageUrl('/dashboard', 3, { search: 'vpc' })
    expect(url).toBe('/dashboard?search=vpc&page=3')
  })

  it('handles multiple extra params', () => {
    const url = buildPageUrl('/dashboard', 2, { search: 'workers', tag: 'networking' })
    // URLSearchParams ordering is insertion order
    expect(url).toContain('search=workers')
    expect(url).toContain('tag=networking')
    expect(url).toContain('page=2')
  })

  it('omits empty extra param values', () => {
    const url = buildPageUrl('/blueprints', 1, { search: '' })
    expect(url).toBe('/blueprints')
  })

  it('works with blueprints base URL', () => {
    expect(buildPageUrl('/blueprints', 4)).toBe('/blueprints?page=4')
  })

  it('page 1 with extra params does not include page param', () => {
    const url = buildPageUrl('/dashboard', 1, { search: 'test' })
    expect(url).toBe('/dashboard?search=test')
    expect(url).not.toContain('page=')
  })

  it('appends repeated params for array values', () => {
    const url = buildPageUrl('/dashboard', 1, { tag: ['networking', 'compute'] })
    expect(url).toContain('tag=networking')
    expect(url).toContain('tag=compute')
  })

  it('preserves string and array params together', () => {
    const url = buildPageUrl('/dashboard', 2, { search: 'vpc', tag: ['workers', 'kv'] })
    expect(url).toContain('search=vpc')
    expect(url).toContain('tag=workers')
    expect(url).toContain('tag=kv')
    expect(url).toContain('page=2')
  })

  it('omits empty strings inside tag arrays', () => {
    const url = buildPageUrl('/dashboard', 1, { tag: ['workers', '', 'kv'] })
    expect(url).toContain('tag=workers')
    expect(url).toContain('tag=kv')
    expect(url).not.toContain('tag=&')
  })

  it('omits an array value entirely when all entries are empty', () => {
    const url = buildPageUrl('/dashboard', 1, { tag: ['', ''] })
    expect(url).toBe('/dashboard')
  })
})
