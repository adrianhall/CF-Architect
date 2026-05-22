/**
 * apps/web/src/test-setup.ts
 *
 * Vitest setup file for the web project.
 * Runs before each test file in the jsdom environment.
 *
 * Sets IS_REACT_ACT_ENVIRONMENT so React's `act()` recognises this as
 * a test environment and suppresses the "not configured to support act()"
 * warning in React 19.
 */

// Tell React this is a test environment so act() works correctly.
// See: https://react.dev/reference/react/act
(globalThis as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"] = true;
