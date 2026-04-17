/**
 * Tests for the client-side API fetch wrapper (api-client.ts).
 *
 * These tests run in the workerd pool and mock the global `fetch`
 * to verify request/response handling without network calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, fetchApi } from '../../../src/lib/api-client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock Response with JSON body. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Create a mock error Response with the standard envelope. */
function errorResponse(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('has correct name, code, status, and message', () => {
    const err = new ApiError('Not found', 'NOT_FOUND', 404)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.name).toBe('ApiError')
    expect(err.message).toBe('Not found')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.status).toBe(404)
  })

  it('is throwable and catchable', () => {
    expect(() => {
      throw new ApiError('Server error', 'INTERNAL_ERROR', 500)
    }).toThrow(ApiError)
  })
})

describe('fetchApi', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('parses a successful JSON response', async () => {
    const mockData = { id: '123', title: 'Test' }
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(mockData))

    const result = await fetchApi<typeof mockData>('/api/test')

    expect(result).toEqual(mockData)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('passes method and body to fetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }, 201))

    await fetchApi('/api/diagrams', {
      method: 'POST',
      body: JSON.stringify({ title: 'New' }),
    })

    const call = vi.mocked(fetch).mock.calls[0]
    expect(call[0]).toBe('/api/diagrams')
    const options = call[1] as RequestInit
    expect(options.method).toBe('POST')
  })

  it('auto-sets Content-Type for JSON bodies', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }))

    await fetchApi('/api/test', {
      method: 'POST',
      body: JSON.stringify({ data: true }),
    })

    const call = vi.mocked(fetch).mock.calls[0]
    const headers = new Headers((call[1] as RequestInit).headers)
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('does not override existing Content-Type header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }))

    await fetchApi('/api/test', {
      method: 'POST',
      body: JSON.stringify({ data: true }),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })

    const call = vi.mocked(fetch).mock.calls[0]
    const headers = new Headers((call[1] as RequestInit).headers)
    expect(headers.get('Content-Type')).toBe('application/json; charset=utf-8')
  })

  it('throws ApiError with code and message from error envelope', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse('NOT_FOUND', 'Diagram not found', 404))

    await expect(fetchApi('/api/diagrams/999')).rejects.toThrow(ApiError)

    try {
      vi.mocked(fetch).mockResolvedValueOnce(errorResponse('UNAUTHORIZED', 'Unauthorized', 401))
      await fetchApi('/api/diagrams/999')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.code).toBe('UNAUTHORIZED')
      expect(apiErr.message).toBe('Unauthorized')
      expect(apiErr.status).toBe(401)
    }
  })

  it('throws ApiError with UNKNOWN code for non-envelope error responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ unexpected: true }), { status: 500 }),
    )

    try {
      await fetchApi('/api/test')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.code).toBe('UNKNOWN')
      expect(apiErr.status).toBe(500)
    }
  })

  it('throws ApiError for non-JSON error responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
    )

    try {
      await fetchApi('/api/test')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.code).toBe('UNKNOWN')
      expect(apiErr.status).toBe(500)
    }
  })

  it('returns undefined for 204 No Content responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    const result = await fetchApi('/api/diagrams/123')

    expect(result).toBeUndefined()
  })
})
