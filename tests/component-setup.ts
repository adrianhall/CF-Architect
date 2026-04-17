/**
 * Setup file for React component tests running in jsdom environment.
 *
 * Extends Vitest's `expect` with custom DOM matchers from
 * `@testing-library/jest-dom` (e.g., `toBeInTheDocument()`,
 * `toHaveTextContent()`, `toBeVisible()`).
 *
 * Also polyfills browser APIs that jsdom omits but Radix UI components
 * require at import time (ResizeObserver, DOMRect).
 *
 * Ref: https://github.com/testing-library/jest-dom#with-vitest
 */
import '@testing-library/jest-dom/vitest'

// ---------------------------------------------------------------------------
// ResizeObserver polyfill — required by @floating-ui/react (used by Radix UI
// dropdown-menu, tooltip, popover, etc. for content positioning).
// ---------------------------------------------------------------------------

/**
 * Minimal no-op ResizeObserver implementation for jsdom test environments.
 * The real observer is not needed in tests because layout calculations are
 * not performed by jsdom.
 */
class ResizeObserverMock {
  /** No-op — layout observation is meaningless in jsdom. */
  observe() {}
  /** No-op — layout observation is meaningless in jsdom. */
  unobserve() {}
  /** No-op — layout observation is meaningless in jsdom. */
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
})

// ---------------------------------------------------------------------------
// DOMRect polyfill — Radix UI uses DOMRect.fromRect() in positioning logic.
// ---------------------------------------------------------------------------

/**
 * Minimal DOMRect implementation for jsdom test environments.
 * All values default to zero since layout is not meaningful in jsdom.
 */
class DOMRectMock implements DOMRect {
  x = 0
  y = 0
  width = 0
  height = 0
  top = 0
  right = 0
  bottom = 0
  left = 0

  /** Returns a zero-valued DOMRect regardless of input. */
  static fromRect(): DOMRect {
    return new DOMRectMock()
  }

  /** Returns a plain object representation. */
  toJSON() {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }
  }
}

Object.defineProperty(globalThis, 'DOMRect', {
  writable: true,
  configurable: true,
  value: DOMRectMock,
})
