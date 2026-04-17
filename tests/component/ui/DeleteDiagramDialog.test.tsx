/**
 * Tests for the DeleteDiagramDialog React island
 * (`src/components/ui/DeleteDiagramDialog.tsx`).
 *
 * The `alert-dialog` module is mocked to render content inline, making the
 * dialog always "visible" and bypassing Radix portal/pointer-event complexity.
 * The mock captures `onOpenChange` from AlertDialog so that clicking the
 * trigger calls `setOpen(true)` and clicking cancel calls `setOpen(false)`.
 *
 * `fetchApi` and `sonner.toast` are mocked; `window.location.reload` is
 * stubbed via `vi.stubGlobal`.
 */

import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Capture onOpenChange from AlertDialog so Trigger/Cancel can invoke it
// ---------------------------------------------------------------------------

let capturedOnOpenChange: ((open: boolean) => void) | undefined

vi.mock('../../../src/components/ui/alert-dialog', () => ({
  AlertDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => {
    capturedOnOpenChange = onOpenChange
    return (
      <div data-testid="alert-dialog" data-open={String(open ?? false)}>
        {children}
      </div>
    )
  },
  AlertDialogTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    // When the child is clicked it bubbles, so we attach onClick to the wrapper
    // that opens the dialog by calling the captured onOpenChange callback.
    <div data-testid="dialog-trigger" onClick={() => capturedOnOpenChange?.(true)}>
      {children}
    </div>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
  }) => (
    <button data-testid="dialog-action" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    disabled,
  }: {
    children: React.ReactNode
    disabled?: boolean
  }) => (
    <button
      data-testid="dialog-cancel"
      disabled={disabled}
      onClick={() => capturedOnOpenChange?.(false)}
    >
      {children}
    </button>
  ),
}))

// ---------------------------------------------------------------------------
// Mock fetchApi
// ---------------------------------------------------------------------------

const mockFetchApi = vi.fn()

vi.mock('../../../src/lib/api-client', () => ({
  fetchApi: (...args: unknown[]) => mockFetchApi(...args),
  ApiError: class ApiError extends Error {
    code: string
    status: number
    constructor(message: string, code: string, status: number) {
      super(message)
      this.code = code
      this.status = status
    }
  },
}))

// ---------------------------------------------------------------------------
// Mock sonner
// ---------------------------------------------------------------------------

const mockToastError = vi.fn()
const mockToastSuccess = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}))

// ---------------------------------------------------------------------------
// Import under test (AFTER all mocks)
// ---------------------------------------------------------------------------

import { DeleteDiagramDialog } from '../../../src/components/ui/DeleteDiagramDialog'

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const reloadMock = vi.fn()

beforeEach(() => {
  capturedOnOpenChange = undefined
  vi.clearAllMocks()
  // Stub window.location.reload — jsdom's location object is not directly writable
  vi.stubGlobal('location', { reload: reloadMock, href: '/' })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultProps = {
  diagramId: 'diag-001',
  diagramTitle: 'My Architecture',
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('DeleteDiagramDialog — rendering', () => {
  it('renders a trash-icon button', () => {
    render(<DeleteDiagramDialog {...defaultProps} />)
    expect(
      screen.getByRole('button', { name: /Delete diagram "My Architecture"/i }),
    ).toBeInTheDocument()
  })

  it('button has title attribute for tooltip', () => {
    render(<DeleteDiagramDialog {...defaultProps} />)
    const btn = screen.getByTitle('Delete diagram')
    expect(btn).toBeInTheDocument()
  })

  it('shows the diagram title in the dialog', () => {
    render(<DeleteDiagramDialog {...defaultProps} />)
    expect(screen.getByTestId('dialog-title').textContent).toContain('My Architecture')
  })

  it('shows a "cannot be undone" warning in the description', () => {
    render(<DeleteDiagramDialog {...defaultProps} />)
    expect(screen.getByTestId('dialog-description').textContent).toContain('cannot be undone')
  })

  it('renders Confirm and Cancel buttons in the dialog', () => {
    render(<DeleteDiagramDialog {...defaultProps} />)
    expect(screen.getByTestId('dialog-action')).toBeInTheDocument()
    expect(screen.getByTestId('dialog-cancel')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Open / close behaviour
// ---------------------------------------------------------------------------

describe('DeleteDiagramDialog — open/close', () => {
  it('starts closed (data-open=false)', () => {
    render(<DeleteDiagramDialog {...defaultProps} />)
    expect(screen.getByTestId('alert-dialog').getAttribute('data-open')).toBe('false')
  })

  it('opens when the trash button is clicked', () => {
    render(<DeleteDiagramDialog {...defaultProps} />)
    // Click the trash button — it's inside the AlertDialogTrigger wrapper
    fireEvent.click(screen.getByRole('button', { name: /Delete diagram/i }))
    expect(screen.getByTestId('alert-dialog').getAttribute('data-open')).toBe('true')
  })

  it('closes when Cancel is clicked', () => {
    render(<DeleteDiagramDialog {...defaultProps} />)
    // Open first
    fireEvent.click(screen.getByRole('button', { name: /Delete diagram/i }))
    expect(screen.getByTestId('alert-dialog').getAttribute('data-open')).toBe('true')
    // Cancel
    fireEvent.click(screen.getByTestId('dialog-cancel'))
    expect(screen.getByTestId('alert-dialog').getAttribute('data-open')).toBe('false')
  })
})

// ---------------------------------------------------------------------------
// Confirm / delete success path
// ---------------------------------------------------------------------------

describe('DeleteDiagramDialog — confirm delete (success)', () => {
  it('calls DELETE /api/diagrams/{id} on confirm', async () => {
    mockFetchApi.mockResolvedValueOnce(undefined)

    render(<DeleteDiagramDialog {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action'))
    })

    expect(mockFetchApi).toHaveBeenCalledWith('/api/diagrams/diag-001', { method: 'DELETE' })
  })

  it('calls window.location.reload() on success', async () => {
    mockFetchApi.mockResolvedValueOnce(undefined)

    render(<DeleteDiagramDialog {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action'))
    })

    expect(reloadMock).toHaveBeenCalledOnce()
  })

  it('does not call toast.error on success', async () => {
    mockFetchApi.mockResolvedValueOnce(undefined)

    render(<DeleteDiagramDialog {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action'))
    })

    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('disables the Confirm button while loading', async () => {
    // Delay the resolution so we can inspect the loading state
    let resolveDelete!: () => void
    mockFetchApi.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve
      }),
    )

    render(<DeleteDiagramDialog {...defaultProps} />)

    // Start the delete (don't await)
    fireEvent.click(screen.getByTestId('dialog-action'))

    // Immediately check — should be disabled while request is in-flight
    expect(screen.getByTestId('dialog-action')).toBeDisabled()
    expect(screen.getByTestId('dialog-cancel')).toBeDisabled()

    // Confirm shows "Deleting…" while loading
    expect(screen.getByTestId('dialog-action').textContent).toContain('Deleting')

    // Resolve the request
    await act(async () => {
      resolveDelete()
    })
  })
})

// ---------------------------------------------------------------------------
// Error path
// ---------------------------------------------------------------------------

describe('DeleteDiagramDialog — confirm delete (error)', () => {
  it('calls toast.error when the API call fails', async () => {
    mockFetchApi.mockRejectedValueOnce(new Error('Network error'))

    render(<DeleteDiagramDialog {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action'))
    })

    expect(mockToastError).toHaveBeenCalledWith('Network error')
  })

  it('does not call window.location.reload on error', async () => {
    mockFetchApi.mockRejectedValueOnce(new Error('Server error'))

    render(<DeleteDiagramDialog {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action'))
    })

    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('re-enables the Confirm button after an error', async () => {
    mockFetchApi.mockRejectedValueOnce(new Error('Fail'))

    render(<DeleteDiagramDialog {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action'))
    })

    expect(screen.getByTestId('dialog-action')).not.toBeDisabled()
  })

  it('shows the error message from an ApiError', async () => {
    const { ApiError } = await import('../../../src/lib/api-client')
    mockFetchApi.mockRejectedValueOnce(new ApiError('Diagram not found', 'NOT_FOUND', 404))

    render(<DeleteDiagramDialog {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action'))
    })

    expect(mockToastError).toHaveBeenCalledWith('Diagram not found')
  })

  it('shows a generic message when the rejection is not an Error instance', async () => {
    // Covers the `err instanceof Error ? ... : 'Failed to delete diagram'` false branch
    mockFetchApi.mockRejectedValueOnce('string rejection')

    render(<DeleteDiagramDialog {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action'))
    })

    expect(mockToastError).toHaveBeenCalledWith('Failed to delete diagram')
  })
})

// ---------------------------------------------------------------------------
// Cancel — no API call
// ---------------------------------------------------------------------------

describe('DeleteDiagramDialog — cancel', () => {
  it('does not call fetchApi when Cancel is clicked', () => {
    render(<DeleteDiagramDialog {...defaultProps} />)
    fireEvent.click(screen.getByTestId('dialog-cancel'))
    expect(mockFetchApi).not.toHaveBeenCalled()
  })

  it('does not reload the page when Cancel is clicked', () => {
    render(<DeleteDiagramDialog {...defaultProps} />)
    fireEvent.click(screen.getByTestId('dialog-cancel'))
    expect(reloadMock).not.toHaveBeenCalled()
  })
})
