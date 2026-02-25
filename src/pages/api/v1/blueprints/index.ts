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
export async function GET(_context: APIContext) {
  const list = BLUEPRINTS.map(({ graphData: _, ...rest }) => rest);
  return jsonResponse(apiSuccess(list));
}
