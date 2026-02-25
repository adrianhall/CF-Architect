/**
 * Fetches a single blueprint by ID.
 */

import type { APIContext } from "astro";
import { BLUEPRINT_MAP } from "@lib/blueprints";
import { apiSuccess, apiError } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";

/**
 * Returns the full blueprint including graphData.
 *
 * @param context - Astro API context with params (id)
 * @returns The full blueprint, or 404 if not found
 */
export async function GET({ params }: APIContext) {
  const blueprint = BLUEPRINT_MAP.get(params.id!);

  if (!blueprint) {
    const err = apiError("NOT_FOUND", "Blueprint not found", 404);
    return jsonResponse(err.body, err.status);
  }

  return jsonResponse(apiSuccess(blueprint));
}
