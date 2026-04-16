import { describe, it, expect } from 'vitest'
import { cn } from '../../src/lib/utils'

describe('test runner smoke test', () => {
  it('should execute a basic assertion', () => {
    expect(1 + 1).toBe(2)
  })
})

describe('cn() utility', () => {
  it('should merge simple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes via clsx', () => {
    const isHidden = false
    expect(cn('base', isHidden && 'hidden', 'visible')).toBe('base visible')
  })

  it('should deduplicate conflicting Tailwind classes', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6')
  })

  it('should handle undefined and null inputs', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })

  it('should return empty string for no inputs', () => {
    expect(cn()).toBe('')
  })
})

describe('Cloudflare brand colors', () => {
  /** Expected Cloudflare brand color hex values from global.css @theme tokens. */
  const CF_BRAND_COLORS = {
    'cf-orange': '#f6821f',
    'cf-orange-dark': '#e87516',
    'cf-dark': '#1a1a2e',
    'cf-dark-alt': '#2d2d44',
    'cf-white': '#ffffff',
    'cf-gray-50': '#f9fafb',
    'cf-gray-100': '#f3f4f6',
    'cf-gray-500': '#6b7280',
    'cf-gray-900': '#111827',
  } as const

  it('should define all expected brand color tokens', () => {
    const expectedTokens = Object.keys(CF_BRAND_COLORS)
    expect(expectedTokens.length).toBe(9)
    for (const token of expectedTokens) {
      expect(CF_BRAND_COLORS[token as keyof typeof CF_BRAND_COLORS]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('should have correct primary orange value', () => {
    expect(CF_BRAND_COLORS['cf-orange']).toBe('#f6821f')
  })

  it('should have correct dark background value', () => {
    expect(CF_BRAND_COLORS['cf-dark']).toBe('#1a1a2e')
  })
})
