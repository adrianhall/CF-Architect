/**
 * Setup file for React component tests running in jsdom environment.
 *
 * Extends Vitest's `expect` with custom DOM matchers from
 * `@testing-library/jest-dom` (e.g., `toBeInTheDocument()`,
 * `toHaveTextContent()`, `toBeVisible()`).
 *
 * Ref: https://github.com/testing-library/jest-dom#with-vitest
 */
import '@testing-library/jest-dom/vitest'
