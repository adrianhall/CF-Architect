/**
 * Centralised preferences storage backed by localStorage.
 *
 * Every client-side preference should be read / written through this module so
 * that tests can mock a single import (`vi.mock("@lib/preferences")`) instead
 * of stubbing the global `localStorage` object.
 *
 * NOTE: {@link src/components/Layout.astro} uses `<script is:inline>` which
 * Astro does **not** bundle.  That inline script reads `localStorage` directly
 * using the same key exported here as {@link THEME_KEY}.  Keep the two in sync.
 */

/** localStorage key used to persist the colour-scheme preference. */
export const THEME_KEY = "theme";

export type Theme = "dark" | "light";

/**
 * Read the persisted theme preference.
 *
 * @returns `"dark"`, `"light"`, or `null` when no valid value is stored.
 */
export function getTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "dark" || value === "light") return value;
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist a theme preference.
 *
 * Silently swallows errors so callers in SSR or restricted contexts don't need
 * their own try/catch.
 */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* SSR / restricted context */
  }
}
