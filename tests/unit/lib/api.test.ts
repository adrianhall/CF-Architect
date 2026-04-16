import { describe, it, expect } from 'vitest'

import {
  errorResponse,
  jsonResponse,
  paginatedResponse,
  parsePagination,
  validateBodySize,
  validateContentType,
} from '../../../src/lib/api'

describe('errorResponse', () => {
  it('returns the given HTTP status code', async () => {
    const res = errorResponse(404, 'NOT_FOUND', 'Diagram not found')
    expect(res.status).toBe(404)
  })

  it('returns Content-Type application/json', () => {
    const res = errorResponse(400, 'BAD_REQUEST', 'Invalid input')
    expect(res.headers.get('Content-Type')).toBe('application/json')
  })

  it('returns the correct { error: { code, message } } envelope', async () => {
    const res = errorResponse(500, 'INTERNAL_ERROR', 'Something broke')
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something broke' } })
  })

  it('supports all defined error codes', async () => {
    const codes = [
      'BAD_REQUEST',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'CONTENT_TOO_LARGE',
      'UNSUPPORTED_MEDIA_TYPE',
      'INTERNAL_ERROR',
    ] as const
    for (const code of codes) {
      const res = errorResponse(400, code, 'test')
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(code)
    }
  })
})

describe('jsonResponse', () => {
  it('returns 200 by default', () => {
    const res = jsonResponse({ ok: true })
    expect(res.status).toBe(200)
  })

  it('returns the supplied status code', () => {
    const res = jsonResponse({ id: '1' }, 201)
    expect(res.status).toBe(201)
  })

  it('returns Content-Type application/json', () => {
    const res = jsonResponse({})
    expect(res.headers.get('Content-Type')).toBe('application/json')
  })

  it('serialises the data to JSON', async () => {
    const data = { id: 'abc', title: 'My Diagram' }
    const body = (await jsonResponse(data).json()) as typeof data
    expect(body).toEqual(data)
  })
})

describe('paginatedResponse', () => {
  it('returns status 200', () => {
    expect(paginatedResponse([], 1, 20, 0).status).toBe(200)
  })

  it('wraps data in { data, pagination } envelope', async () => {
    const items = [{ id: '1' }, { id: '2' }]
    const body = (await paginatedResponse(items, 1, 20, 2).json()) as {
      data: unknown[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }
    expect(body.data).toEqual(items)
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(20)
    expect(body.pagination.total).toBe(2)
  })

  it('computes totalPages correctly — exact division', async () => {
    const body = (await paginatedResponse([], 1, 10, 30).json()) as {
      pagination: { totalPages: number }
    }
    expect(body.pagination.totalPages).toBe(3)
  })

  it('computes totalPages correctly — rounds up partial page', async () => {
    const body = (await paginatedResponse([], 1, 10, 21).json()) as {
      pagination: { totalPages: number }
    }
    expect(body.pagination.totalPages).toBe(3)
  })

  it('returns totalPages 0 when total is 0', async () => {
    const body = (await paginatedResponse([], 1, 20, 0).json()) as {
      pagination: { totalPages: number }
    }
    expect(body.pagination.totalPages).toBe(0)
  })

  it('returns totalPages 0 when limit is 0', async () => {
    const body = (await paginatedResponse([], 1, 0, 50).json()) as {
      pagination: { totalPages: number }
    }
    expect(body.pagination.totalPages).toBe(0)
  })
})

describe('parsePagination', () => {
  it('returns defaults when no query params are present', () => {
    const url = new URL('https://example.com/api/diagrams')
    const result = parsePagination(url)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.offset).toBe(0)
  })

  it('parses page and limit from query params', () => {
    const url = new URL('https://example.com/api/diagrams?page=3&limit=10')
    const result = parsePagination(url)
    expect(result.page).toBe(3)
    expect(result.limit).toBe(10)
    expect(result.offset).toBe(20)
  })

  it('clamps limit to max 100', () => {
    const url = new URL('https://example.com/api/diagrams?limit=999')
    const result = parsePagination(url)
    expect(result.limit).toBe(100)
  })

  it('ensures page is at least 1 when 0 is passed', () => {
    const url = new URL('https://example.com/api/diagrams?page=0')
    const result = parsePagination(url)
    expect(result.page).toBe(1)
    expect(result.offset).toBe(0)
  })

  it('ensures page is at least 1 when negative is passed', () => {
    const url = new URL('https://example.com/api/diagrams?page=-5')
    const result = parsePagination(url)
    expect(result.page).toBe(1)
  })

  it('respects custom defaults', () => {
    const url = new URL('https://example.com/api/diagrams')
    const result = parsePagination(url, { page: 2, limit: 50 })
    expect(result.page).toBe(2)
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(50)
  })

  it('computes offset correctly for page > 1', () => {
    const url = new URL('https://example.com/api/diagrams?page=4&limit=25')
    const result = parsePagination(url)
    expect(result.offset).toBe(75)
  })

  it('falls back to default limit when limit is 0', () => {
    const url = new URL('https://example.com/api/diagrams?limit=0')
    const result = parsePagination(url)
    expect(result.limit).toBe(20)
  })

  it('falls back to default limit when limit is negative', () => {
    const url = new URL('https://example.com/api/diagrams?limit=-5')
    const result = parsePagination(url)
    expect(result.limit).toBe(20)
  })
})

describe('validateContentType', () => {
  it('returns null for application/json', () => {
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(validateContentType(req)).toBeNull()
  })

  it('returns null for application/json with charset', () => {
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
    expect(validateContentType(req)).toBeNull()
  })

  it('returns 415 response for text/plain', async () => {
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
    })
    const res = validateContentType(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(415)
    const body = (await res!.json()) as { error: { code: string } }
    expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
  })

  it('returns 415 response when Content-Type header is missing', async () => {
    const req = new Request('https://example.com', { method: 'POST' })
    const res = validateContentType(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(415)
  })
})

describe('validateBodySize', () => {
  it('returns null when Content-Length is within limit', () => {
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Length': '512' },
    })
    expect(validateBodySize(req)).toBeNull()
  })

  it('returns null when Content-Length header is absent', () => {
    const req = new Request('https://example.com', { method: 'POST' })
    expect(validateBodySize(req)).toBeNull()
  })

  it('returns 413 response when Content-Length exceeds 1 MB', async () => {
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Length': '1048577' },
    })
    const res = validateBodySize(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(413)
    const body = (await res!.json()) as { error: { code: string } }
    expect(body.error.code).toBe('CONTENT_TOO_LARGE')
  })

  it('returns null when Content-Length is exactly 1 MB', () => {
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Length': '1048576' },
    })
    expect(validateBodySize(req)).toBeNull()
  })
})
