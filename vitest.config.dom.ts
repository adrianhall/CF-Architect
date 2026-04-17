import { defineProject } from 'vitest/config'

/**
 * Vitest project configuration for React component tests running in
 * a jsdom environment.
 *
 * Tests in `tests/component/` exercise React components that need DOM
 * APIs (e.g., tldraw canvas, service toolbar). The `Tldraw` component
 * and `useEditor()` hook are mocked; full integration is covered by
 * Playwright E2E tests.
 *
 * This config is referenced by the root `vitest.config.ts` via `test.projects`.
 */
export default defineProject({
  test: {
    name: 'dom',
    environment: 'jsdom',
    include: ['tests/component/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./tests/component-setup.ts'],
    server: {
      deps: {
        // Inline tldraw so CSS imports are handled correctly in jsdom
        inline: ['tldraw'],
      },
    },
  },
})
