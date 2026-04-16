import { describe, it, expect } from 'vitest'

import {
  validateDiagramInput,
  validateDiagramUpdate,
  validateSort,
  validateOrder,
} from '../../../src/lib/validators'

// ---------------------------------------------------------------------------
// validateDiagramInput
// ---------------------------------------------------------------------------

describe('validateDiagramInput', () => {
  it('returns parsed object for valid input', () => {
    const result = validateDiagramInput({
      title: 'My Diagram',
      description: 'A test diagram',
      canvasData: '{"shapes":[]}',
      tags: ['AWS', ' Network '],
    })
    expect(typeof result).not.toBe('string')
    const parsed = result as Exclude<typeof result, string>
    expect(parsed.title).toBe('My Diagram')
    expect(parsed.description).toBe('A test diagram')
    expect(parsed.canvasData).toBe('{"shapes":[]}')
    expect(parsed.tags).toEqual(['aws', 'network'])
  })

  it('defaults description to empty string when omitted', () => {
    const result = validateDiagramInput({
      title: 'Test',
      canvasData: '{}',
    })
    expect(typeof result).not.toBe('string')
    const parsed = result as Exclude<typeof result, string>
    expect(parsed.description).toBe('')
  })

  it('defaults tags to empty array when omitted', () => {
    const result = validateDiagramInput({
      title: 'Test',
      canvasData: '{}',
    })
    expect(typeof result).not.toBe('string')
    const parsed = result as Exclude<typeof result, string>
    expect(parsed.tags).toEqual([])
  })

  it('rejects non-object body', () => {
    expect(typeof validateDiagramInput('string')).toBe('string')
    expect(typeof validateDiagramInput(null)).toBe('string')
    expect(typeof validateDiagramInput(42)).toBe('string')
  })

  it('rejects missing title', () => {
    const result = validateDiagramInput({ canvasData: '{}' })
    expect(typeof result).toBe('string')
    expect(result).toContain('title')
  })

  it('rejects empty-string title', () => {
    const result = validateDiagramInput({ title: '   ', canvasData: '{}' })
    expect(typeof result).toBe('string')
    expect(result).toContain('title')
  })

  it('rejects title exceeding 200 characters', () => {
    const result = validateDiagramInput({
      title: 'a'.repeat(201),
      canvasData: '{}',
    })
    expect(typeof result).toBe('string')
    expect(result).toContain('200')
  })

  it('rejects missing canvasData', () => {
    const result = validateDiagramInput({ title: 'Test' })
    expect(typeof result).toBe('string')
    expect(result).toContain('canvasData')
  })

  it('rejects empty-string canvasData', () => {
    const result = validateDiagramInput({ title: 'Test', canvasData: '' })
    expect(typeof result).toBe('string')
    expect(result).toContain('canvasData')
  })

  it('rejects invalid JSON in canvasData', () => {
    const result = validateDiagramInput({
      title: 'Test',
      canvasData: 'not-json{',
    })
    expect(typeof result).toBe('string')
    expect(result).toContain('valid JSON')
  })

  it('normalises tags to lowercase and trims whitespace', () => {
    const result = validateDiagramInput({
      title: 'Test',
      canvasData: '{}',
      tags: ['  AWS  ', 'Network', 'CDN'],
    })
    expect(typeof result).not.toBe('string')
    const parsed = result as Exclude<typeof result, string>
    expect(parsed.tags).toEqual(['aws', 'network', 'cdn'])
  })

  it('deduplicates tags after normalisation', () => {
    const result = validateDiagramInput({
      title: 'Test',
      canvasData: '{}',
      tags: ['AWS', 'aws', 'Aws'],
    })
    expect(typeof result).not.toBe('string')
    const parsed = result as Exclude<typeof result, string>
    expect(parsed.tags).toEqual(['aws'])
  })

  it('rejects more than 20 tags', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`)
    const result = validateDiagramInput({
      title: 'Test',
      canvasData: '{}',
      tags,
    })
    expect(typeof result).toBe('string')
    expect(result).toContain('20')
  })

  it('rejects tags that are not an array', () => {
    const result = validateDiagramInput({
      title: 'Test',
      canvasData: '{}',
      tags: 'not-an-array',
    })
    expect(typeof result).toBe('string')
    expect(result).toContain('array')
  })

  it('rejects non-string tag elements', () => {
    const result = validateDiagramInput({
      title: 'Test',
      canvasData: '{}',
      tags: [123],
    })
    expect(typeof result).toBe('string')
    expect(result).toContain('string')
  })

  it('rejects description exceeding 2000 characters', () => {
    const result = validateDiagramInput({
      title: 'Test',
      canvasData: '{}',
      description: 'x'.repeat(2001),
    })
    expect(typeof result).toBe('string')
    expect(result).toContain('2000')
  })

  it('rejects non-string description', () => {
    const result = validateDiagramInput({
      title: 'Test',
      canvasData: '{}',
      description: 123,
    })
    expect(typeof result).toBe('string')
    expect(result).toContain('description')
  })

  it('strips empty tags after trimming', () => {
    const result = validateDiagramInput({
      title: 'Test',
      canvasData: '{}',
      tags: ['aws', '   ', 'cdn'],
    })
    expect(typeof result).not.toBe('string')
    const parsed = result as Exclude<typeof result, string>
    expect(parsed.tags).toEqual(['aws', 'cdn'])
  })
})

// ---------------------------------------------------------------------------
// validateDiagramUpdate
// ---------------------------------------------------------------------------

describe('validateDiagramUpdate', () => {
  it('allows all fields to be optional (empty object)', () => {
    const result = validateDiagramUpdate({})
    expect(typeof result).not.toBe('string')
    const parsed = result as Exclude<typeof result, string>
    expect(parsed.title).toBeUndefined()
    expect(parsed.description).toBeUndefined()
    expect(parsed.canvasData).toBeUndefined()
    expect(parsed.thumbnailSvg).toBeUndefined()
    expect(parsed.tags).toBeUndefined()
  })

  it('validates and returns provided fields', () => {
    const result = validateDiagramUpdate({
      title: 'Updated',
      description: 'New desc',
      canvasData: '{"updated":true}',
      thumbnailSvg: '<svg></svg>',
      tags: ['new-tag'],
    })
    expect(typeof result).not.toBe('string')
    const parsed = result as Exclude<typeof result, string>
    expect(parsed.title).toBe('Updated')
    expect(parsed.description).toBe('New desc')
    expect(parsed.canvasData).toBe('{"updated":true}')
    expect(parsed.thumbnailSvg).toBe('<svg></svg>')
    expect(parsed.tags).toEqual(['new-tag'])
  })

  it('rejects title exceeding 200 characters', () => {
    const result = validateDiagramUpdate({ title: 'a'.repeat(201) })
    expect(typeof result).toBe('string')
    expect(result).toContain('200')
  })

  it('rejects empty-string title', () => {
    const result = validateDiagramUpdate({ title: '' })
    expect(typeof result).toBe('string')
    expect(result).toContain('title')
  })

  it('rejects invalid JSON in canvasData', () => {
    const result = validateDiagramUpdate({ canvasData: 'not-json' })
    expect(typeof result).toBe('string')
    expect(result).toContain('valid JSON')
  })

  it('rejects thumbnailSvg exceeding 500 KB', () => {
    // 500 KB = 512,000 bytes; generate a string slightly over
    const result = validateDiagramUpdate({ thumbnailSvg: 'x'.repeat(512_001) })
    expect(typeof result).toBe('string')
    expect(result).toContain('500 KB')
  })

  it('rejects non-object body', () => {
    expect(typeof validateDiagramUpdate(null)).toBe('string')
    expect(typeof validateDiagramUpdate('string')).toBe('string')
  })

  it('rejects non-string thumbnailSvg', () => {
    const result = validateDiagramUpdate({ thumbnailSvg: 123 })
    expect(typeof result).toBe('string')
    expect(result).toContain('thumbnailSvg')
  })

  it('rejects more than 20 tags', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`)
    const result = validateDiagramUpdate({ tags })
    expect(typeof result).toBe('string')
    expect(result).toContain('20')
  })
})

// ---------------------------------------------------------------------------
// validateSort
// ---------------------------------------------------------------------------

describe('validateSort', () => {
  const allowed = ['updated_at', 'created_at', 'title']

  it('returns the sort value when it is in the allowed list', () => {
    expect(validateSort('title', allowed, 'updated_at')).toBe('title')
  })

  it('returns the default when sort is null', () => {
    expect(validateSort(null, allowed, 'updated_at')).toBe('updated_at')
  })

  it('returns the default for an invalid sort value', () => {
    expect(validateSort('invalid_field', allowed, 'updated_at')).toBe('updated_at')
  })

  it('returns the default for an empty string', () => {
    expect(validateSort('', allowed, 'updated_at')).toBe('updated_at')
  })
})

// ---------------------------------------------------------------------------
// validateOrder
// ---------------------------------------------------------------------------

describe('validateOrder', () => {
  it('returns asc when asc is provided', () => {
    expect(validateOrder('asc', 'desc')).toBe('asc')
  })

  it('returns desc when desc is provided', () => {
    expect(validateOrder('desc', 'asc')).toBe('desc')
  })

  it('returns the default for null', () => {
    expect(validateOrder(null, 'desc')).toBe('desc')
  })

  it('returns the default for an invalid value', () => {
    expect(validateOrder('random', 'asc')).toBe('asc')
  })

  it('returns the default for an empty string', () => {
    expect(validateOrder('', 'desc')).toBe('desc')
  })
})
