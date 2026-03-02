/**
 * Public share token resolver.
 * No authentication required.
 */

import type { APIContext } from "astro";
import { createRepositories } from "@lib/repository";
import { apiSuccess, apiError } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";

/**
 * Resolves a share token to diagram data.
 * Returns the diagram's id, title, description, and graphData.
 *
 * @param context - Astro API context with params (token), locals (runtime.env)
 * @returns The diagram data, or 404 if token is expired or not found
 */
export async function GET({ params, locals }: APIContext) {
  const { shares } = createRepositories(locals.runtime.env);
  const diagram = await shares.loadDiagramFromShareLink(params.token!);

  if (!diagram) {
    const err = apiError("NOT_FOUND", "Share link not found or expired", 404);
    return jsonResponse(err.body, err.status);
  }

  return jsonResponse(apiSuccess(diagram));
}
