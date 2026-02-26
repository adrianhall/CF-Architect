/**
 * Lists available blueprint templates.
 */

import type { APIContext } from "astro";
import { BLUEPRINTS } from "@lib/blueprints";
import { apiSuccess } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";

/**
 * Returns all blueprints without graphData (metadata only).
 *
 * @param _context - Astro API context (unused)
 * @returns ApiResult with list of blueprint metadata
 */
// eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
export async function GET(_context: APIContext) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const list = BLUEPRINTS.map(({ graphData: _, ...rest }) => rest);
  return jsonResponse(apiSuccess(list));
}
