/**
 * Component tests for ServiceToolbar.
 *
 * Mocks tldraw's useEditor() hook and tests rendering, search
 * filtering, and collapse/expand behaviour. Runs in jsdom environment.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CF_SERVICES, getCategories } from '../../../src/components/canvas/shapes/cf-services'

// ---------------------------------------------------------------------------
// Mock tldraw
// ---------------------------------------------------------------------------

const mockEditor = {
  screenToPage: vi.fn().mockReturnValue({ x: 100, y: 100 }),
  createShape: vi.fn(),
  markHistoryStoppingPoint: vi.fn(),
}

vi.mock('tldraw', () => ({
  useEditor: () => mockEditor,
  Vec: class Vec {
    x: number
    y: number
    constructor(x = 0, y = 0) {
      this.x = x
      this.y = y
    }
    static Dist(a: { x: number; y: number }, b: { x: number; y: number }) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
    }
  },
}))

// Import after mocking
import { ServiceToolbar } from '../../../src/components/canvas/ServiceToolbar'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ServiceToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the toolbar panel by default (not collapsed)', () => {
    render(<ServiceToolbar />)
    expect(screen.getByTestId('service-toolbar')).toBeInTheDocument()
  })

  it('renders all service items', () => {
    render(<ServiceToolbar />)
    for (const service of CF_SERVICES) {
      expect(screen.getByTestId(`service-item-${service.type}`)).toBeInTheDocument()
    }
  })

  it('renders all category headings', () => {
    render(<ServiceToolbar />)
    const categories = getCategories()
    const categoryLabels: Record<string, string> = {
      compute: 'Compute',
      storage: 'Storage',
      ai: 'AI',
      media: 'Media',
      messaging: 'Messaging',
      networking: 'Networking',
    }
    for (const cat of categories) {
      expect(screen.getByText(categoryLabels[cat])).toBeInTheDocument()
    }
  })

  it('displays service names', () => {
    render(<ServiceToolbar />)
    expect(screen.getByText('Workers')).toBeInTheDocument()
    expect(screen.getByText('D1')).toBeInTheDocument()
    expect(screen.getByText('KV')).toBeInTheDocument()
    expect(screen.getByText('Workers AI')).toBeInTheDocument()
    expect(screen.getByText('DNS')).toBeInTheDocument()
  })

  it('renders the search input', () => {
    render(<ServiceToolbar />)
    expect(screen.getByPlaceholderText('Search services...')).toBeInTheDocument()
  })

  describe('search/filter', () => {
    it('filters services by name', () => {
      render(<ServiceToolbar />)
      const searchInput = screen.getByPlaceholderText('Search services...')

      fireEvent.change(searchInput, { target: { value: 'workers' } })

      // Should show Workers and Workers AI
      expect(screen.getByTestId('service-item-workers')).toBeInTheDocument()
      expect(screen.getByTestId('service-item-workers-ai')).toBeInTheDocument()
      // Should NOT show D1
      expect(screen.queryByTestId('service-item-d1')).not.toBeInTheDocument()
    })

    it('filter is case-insensitive', () => {
      render(<ServiceToolbar />)
      const searchInput = screen.getByPlaceholderText('Search services...')

      fireEvent.change(searchInput, { target: { value: 'DNS' } })

      expect(screen.getByTestId('service-item-dns')).toBeInTheDocument()
    })

    it('shows empty state when no services match', () => {
      render(<ServiceToolbar />)
      const searchInput = screen.getByPlaceholderText('Search services...')

      fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } })

      expect(screen.getByText(/No services match/)).toBeInTheDocument()
    })

    it('filters by description text too', () => {
      render(<ServiceToolbar />)
      const searchInput = screen.getByPlaceholderText('Search services...')

      // "SQL database" is in D1's description
      fireEvent.change(searchInput, { target: { value: 'SQL database' } })

      expect(screen.getByTestId('service-item-d1')).toBeInTheDocument()
    })
  })

  describe('collapse/expand', () => {
    it('collapses when toggle button is clicked', () => {
      render(<ServiceToolbar />)
      const toggleButton = screen.getByLabelText('Close service toolbar')

      fireEvent.click(toggleButton)

      expect(screen.queryByTestId('service-toolbar')).not.toBeInTheDocument()
    })

    it('expands when toggle button is clicked again', () => {
      render(<ServiceToolbar />)
      const closeButton = screen.getByLabelText('Close service toolbar')

      fireEvent.click(closeButton)
      expect(screen.queryByTestId('service-toolbar')).not.toBeInTheDocument()

      const openButton = screen.getByLabelText('Open service toolbar')
      fireEvent.click(openButton)
      expect(screen.getByTestId('service-toolbar')).toBeInTheDocument()
    })
  })

  describe('service items', () => {
    it('each service item has a title tooltip with the description', () => {
      render(<ServiceToolbar />)
      const workersItem = screen.getByTestId('service-item-workers')
      expect(workersItem.getAttribute('title')).toBe('Serverless compute at the edge')
    })

    it('renders service icons as img elements', () => {
      render(<ServiceToolbar />)
      const workersItem = screen.getByTestId('service-item-workers')
      const img = workersItem.querySelector('img')
      expect(img).toBeTruthy()
      expect(img?.getAttribute('src')).toBe('/icons/cf/workers.svg')
    })
  })

  describe('hover highlights', () => {
    it('sets background on mouseEnter and clears on mouseLeave', () => {
      render(<ServiceToolbar />)
      const item = screen.getByTestId('service-item-workers')

      fireEvent.mouseEnter(item)
      expect(item.style.backgroundColor).toBe('rgba(246, 130, 31, 0.15)')

      fireEvent.mouseLeave(item)
      expect(item.style.backgroundColor).toBe('transparent')
    })
  })

  describe('drag interaction', () => {
    it('fires pointerDown on a service item without throwing', () => {
      render(<ServiceToolbar />)
      const item = screen.getByTestId('service-item-d1')

      // jsdom doesn't support setPointerCapture natively — stub it
      item.setPointerCapture = vi.fn()
      item.releasePointerCapture = vi.fn()

      fireEvent.pointerDown(item, { clientX: 50, clientY: 50, pointerId: 1 })

      expect(item.setPointerCapture).toHaveBeenCalledWith(1)
    })

    it('pointerUp without drag does not create a shape', () => {
      render(<ServiceToolbar />)
      const item = screen.getByTestId('service-item-d1')

      item.setPointerCapture = vi.fn()
      item.releasePointerCapture = vi.fn()

      // Down then immediately up — no movement, so no drag
      fireEvent.pointerDown(item, { clientX: 50, clientY: 50, pointerId: 1 })
      fireEvent.pointerUp(item, { clientX: 50, clientY: 50, pointerId: 1 })

      expect(mockEditor.createShape).not.toHaveBeenCalled()
    })

    it('creates a shape when pointer moves past threshold and releases', () => {
      render(<ServiceToolbar />)
      const item = screen.getByTestId('service-item-d1')

      item.setPointerCapture = vi.fn()
      item.releasePointerCapture = vi.fn()

      // Start the pointer interaction
      fireEvent.pointerDown(item, { clientX: 50, clientY: 50, pointerId: 1 })

      // Simulate pointermove past the 8px threshold via a native PointerEvent
      // (the handler is added via addEventListener, not React — fire on the element directly)
      act(() => {
        item.dispatchEvent(
          new PointerEvent('pointermove', { clientX: 100, clientY: 100, bubbles: true }),
        )
      })

      // Now release — this should trigger shape creation
      fireEvent.pointerUp(item, { clientX: 100, clientY: 100, pointerId: 1 })

      expect(mockEditor.screenToPage).toHaveBeenCalled()
      expect(mockEditor.markHistoryStoppingPoint).toHaveBeenCalledWith('create cf-service shape')
      expect(mockEditor.createShape).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cf-service',
          props: expect.objectContaining({
            serviceType: 'd1',
            label: 'D1',
          }),
        }),
      )
    })

    it('shows drag preview while dragging', () => {
      render(<ServiceToolbar />)
      const item = screen.getByTestId('service-item-workers')

      item.setPointerCapture = vi.fn()
      item.releasePointerCapture = vi.fn()

      fireEvent.pointerDown(item, { clientX: 10, clientY: 10, pointerId: 1 })

      // Move past threshold — wrap in act() since the native event triggers React state
      act(() => {
        item.dispatchEvent(
          new PointerEvent('pointermove', { clientX: 100, clientY: 100, bubbles: true }),
        )
      })

      // Drag preview ghost should be visible (an img with the service icon)
      const previewImg = document.querySelector('img[alt="Workers"]')
      expect(previewImg).toBeTruthy()

      // Clean up
      fireEvent.pointerUp(item, { clientX: 100, clientY: 100, pointerId: 1 })
    })

    it('updates drag preview position on continued movement', () => {
      render(<ServiceToolbar />)
      const item = screen.getByTestId('service-item-kv')

      item.setPointerCapture = vi.fn()
      item.releasePointerCapture = vi.fn()

      fireEvent.pointerDown(item, { clientX: 10, clientY: 10, pointerId: 1 })

      act(() => {
        // First move past threshold
        item.dispatchEvent(
          new PointerEvent('pointermove', { clientX: 50, clientY: 50, bubbles: true }),
        )
        // Second move updates position
        item.dispatchEvent(
          new PointerEvent('pointermove', { clientX: 200, clientY: 300, bubbles: true }),
        )
      })

      // Release
      fireEvent.pointerUp(item, { clientX: 200, clientY: 300, pointerId: 1 })

      expect(mockEditor.createShape).toHaveBeenCalled()
    })

    it('cleans up drag preview after pointer up', () => {
      render(<ServiceToolbar />)
      const item = screen.getByTestId('service-item-r2')

      item.setPointerCapture = vi.fn()
      item.releasePointerCapture = vi.fn()

      fireEvent.pointerDown(item, { clientX: 10, clientY: 10, pointerId: 1 })
      act(() => {
        item.dispatchEvent(
          new PointerEvent('pointermove', { clientX: 100, clientY: 100, bubbles: true }),
        )
      })
      fireEvent.pointerUp(item, { clientX: 100, clientY: 100, pointerId: 1 })

      // After drop, no fixed-position drag preview should remain
      const ghostDivs = document.querySelectorAll('[style*="pointer-events: none"]')
      expect(ghostDivs.length).toBe(0)
    })
  })
})
