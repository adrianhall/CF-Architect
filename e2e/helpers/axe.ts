/**
 * e2e/helpers/axe.ts
 *
 * Axe-core accessibility testing helper.
 * Wraps @axe-core/playwright with standard options for CF-Architect.
 *
 * Usage in a Playwright spec:
 *   import { checkPageA11y } from "../helpers/axe.js";
 *   await checkPageA11y(page);
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export interface A11yCheckOptions {
  /** CSS selectors for regions to exclude from the axe scan. */
  exclude?: string[];
  /** axe rule tags to include (default: ["wcag2a", "wcag2aa", "wcag21aa"]). */
  tags?: string[];
}

/**
 * Runs an axe accessibility scan on the current page and asserts zero
 * serious or critical violations.
 *
 * Fails the test if any serious or critical axe violations are found.
 * Reports the violation details to help identify what needs fixing.
 */
export async function checkPageA11y(page: Page, options: A11yCheckOptions = {}): Promise<void> {
  const { exclude = [], tags = ["wcag2a", "wcag2aa", "wcag21aa"] } = options;

  let builder = new AxeBuilder({ page }).withTags(tags);

  for (const selector of exclude) {
    builder = builder.exclude(selector);
  }

  const { violations } = await builder.analyze();

  // Filter to serious and critical violations only
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");

  // Format violation details for readable test output
  const details = blocking.map((v) => {
    const nodes = v.nodes.map((n) => `    - ${n.html.slice(0, 120)}`).join("\n");
    return `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n${nodes}`;
  });

  expect(
    blocking,
    `Found ${blocking.length} serious/critical axe violations:\n${details.join("\n\n")}`,
  ).toHaveLength(0);
}
