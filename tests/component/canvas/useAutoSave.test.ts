/**
 * Tests for the useAutoSave custom hook.
 *
 * Tests the debounce timer, save-on-create vs save-on-update logic,
 * and error handling. Uses fake timers and mocked fetch. Runs in jsdom.
 */

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('tldraw', () => ({
  getSnapshot: vi.fn().mockReturnValue({
    document: { store: {} },
    session: {},
  }),
}))

const mockFetchApi = vi.fn()

vi.mock('../../../src/lib/api-client', () => ({
  fetchApi: (...args: unknown[]) => mockFetchApi(...args),
  ApiError: class ApiError extends Error {
    code: string
    status: number
    constructor(message: string, code: string, status: number) {
      super(message)
      this.name = 'ApiError'
      this.code = code
      this.status = status
    }
  },
}))

import { useAutoSave } from '../../../src/components/canvas/useAutoSave'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock tldraw editor with a store.listen method. */
function createMockEditor() {
  const listeners: Array<() => void> = []
  return {
    store: {
      listen: vi.fn((callback: () => void) => {
        listeners.push(callback)
        return () => {
          const idx = listeners.indexOf(callback)
          if (idx >= 0) listeners.splice(idx, 1)
        }
      }),
    },
    _triggerChange: () => {
      for (const listener of listeners) {
        listener()
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    // Mock window.history.replaceState
    vi.stubGlobal('history', { replaceState: vi.fn() })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts with idle status', () => {
    const { result } = renderHook(() => useAutoSave({ editor: null }))
    expect(result.current.status).toBe('idle')
    expect(result.current.errorMessage).toBeNull()
  })

  it('uses provided title and description', () => {
    const { result } = renderHook(() =>
      useAutoSave({
        editor: null,
        title: 'My Diagram',
        description: 'Some desc',
      }),
    )
    expect(result.current.currentTitle).toBe('My Diagram')
    expect(result.current.currentDescription).toBe('Some desc')
  })

  it('defaults title to "Untitled" when not provided', () => {
    const { result } = renderHook(() => useAutoSave({ editor: null }))
    expect(result.current.currentTitle).toBe('Untitled')
  })

  it('updates title via setTitle', () => {
    const { result } = renderHook(() => useAutoSave({ editor: null }))

    act(() => {
      result.current.setTitle('New Title')
    })

    expect(result.current.currentTitle).toBe('New Title')
  })

  it('updates description via setDescription', () => {
    const { result } = renderHook(() => useAutoSave({ editor: null }))

    act(() => {
      result.current.setDescription('New Description')
    })

    expect(result.current.currentDescription).toBe('New Description')
  })

  it('tracks the provided diagramId', () => {
    const { result } = renderHook(() => useAutoSave({ editor: null, diagramId: 'existing-123' }))
    expect(result.current.currentDiagramId).toBe('existing-123')
  })

  it('saveNow triggers a PUT for existing diagrams', async () => {
    const mockEditor = createMockEditor()
    mockFetchApi.mockResolvedValueOnce({ id: 'existing-123', title: 'Test' })

    const { result } = renderHook(() =>
      useAutoSave({
        editor: mockEditor as unknown as import('tldraw').Editor,
        diagramId: 'existing-123',
        title: 'Test',
      }),
    )

    await act(async () => {
      result.current.saveNow()
    })

    expect(mockFetchApi).toHaveBeenCalledWith(
      '/api/diagrams/existing-123',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('saveNow triggers a POST for new diagrams', async () => {
    const mockEditor = createMockEditor()
    mockFetchApi.mockResolvedValueOnce({ id: 'new-456' })

    const { result } = renderHook(() =>
      useAutoSave({
        editor: mockEditor as unknown as import('tldraw').Editor,
        title: 'New Diagram',
      }),
    )

    await act(async () => {
      result.current.saveNow()
    })

    expect(mockFetchApi).toHaveBeenCalledWith(
      '/api/diagrams',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.current.currentDiagramId).toBe('new-456')
  })

  it('sets status to saved after successful save', async () => {
    const mockEditor = createMockEditor()
    mockFetchApi.mockResolvedValueOnce({ id: '123' })

    const { result } = renderHook(() =>
      useAutoSave({
        editor: mockEditor as unknown as import('tldraw').Editor,
        diagramId: '123',
      }),
    )

    await act(async () => {
      result.current.saveNow()
    })

    expect(result.current.status).toBe('saved')
  })

  it('sets status to error on save failure', async () => {
    const mockEditor = createMockEditor()
    mockFetchApi.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() =>
      useAutoSave({
        editor: mockEditor as unknown as import('tldraw').Editor,
        diagramId: '123',
      }),
    )

    await act(async () => {
      result.current.saveNow()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('Failed to save diagram')
  })

  it('retry attempts to save again after failure', async () => {
    const mockEditor = createMockEditor()
    mockFetchApi.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() =>
      useAutoSave({
        editor: mockEditor as unknown as import('tldraw').Editor,
        diagramId: '123',
      }),
    )

    await act(async () => {
      result.current.saveNow()
    })

    expect(result.current.status).toBe('error')

    // Retry
    mockFetchApi.mockResolvedValueOnce({ id: '123' })

    await act(async () => {
      result.current.retry()
    })

    expect(result.current.status).toBe('saved')
  })

  it('auto-saves after debounce interval on store changes', async () => {
    const mockEditor = createMockEditor()
    mockFetchApi.mockResolvedValue({ id: '123' })

    renderHook(() =>
      useAutoSave({
        editor: mockEditor as unknown as import('tldraw').Editor,
        diagramId: '123',
        debounceMs: 5000,
      }),
    )

    // Trigger a store change
    act(() => {
      mockEditor._triggerChange()
    })

    // Should not have saved yet (debounce not elapsed)
    expect(mockFetchApi).not.toHaveBeenCalled()

    // Advance past the debounce interval
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(mockFetchApi).toHaveBeenCalledOnce()
  })

  it('debounce resets on subsequent store changes', async () => {
    const mockEditor = createMockEditor()
    mockFetchApi.mockResolvedValue({ id: '123' })

    renderHook(() =>
      useAutoSave({
        editor: mockEditor as unknown as import('tldraw').Editor,
        diagramId: '123',
        debounceMs: 5000,
      }),
    )

    // First change
    act(() => {
      mockEditor._triggerChange()
    })

    // Wait 3s (not enough)
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // Second change — resets the timer
    act(() => {
      mockEditor._triggerChange()
    })

    // Wait another 3s (total 6s from first, but only 3s from second)
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // Should not have saved yet (only 3s since last change)
    expect(mockFetchApi).not.toHaveBeenCalled()

    // Wait the remaining 2s
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(mockFetchApi).toHaveBeenCalledOnce()
  })

  it('does not save when editor is null', async () => {
    const { result } = renderHook(() => useAutoSave({ editor: null }))

    await act(async () => {
      result.current.saveNow()
    })

    expect(mockFetchApi).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })
})
