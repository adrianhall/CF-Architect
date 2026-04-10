/**
 * Autosave endpoint for diagram graph data.
 */

import type { APIContext } from "astro";
import { getEnv } from "@lib/env";
import { createRepositories } from "@lib/repository";
import { SaveGraphSchema, apiSuccess, apiError } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";

/**
 * Idempotent full replacement of graph_data.
 * Validates request body via SaveGraphSchema.
 *
 * @param context - Astro API context with request, params (id), locals (user, runtime.env)
 * @returns The updated timestamp, or 404 if diagram not found
 */
export async function PUT({ request, params, locals }: APIContext) {
  if (!locals.user) {
    return jsonResponse(apiError("UNAUTHORIZED", "Unauthorized").body, 401);
  }
  const body = await request.json().catch(() => ({}));
  const parsed = SaveGraphSchema.safeParse(body);

  if (!parsed.success) {
    const err = apiError("VALIDATION_ERROR", parsed.error.message);
    return jsonResponse(err.body, err.status);
  }

  const { diagrams } = createRepositories(getEnv(locals));
  const updatedAt = await diagrams.saveGraphData(
    params.id!,
    locals.user.id,
    parsed.data.graphData,
  );

  if (!updatedAt) {
    const err = apiError("NOT_FOUND", "Diagram not found", 404);
    return jsonResponse(err.body, err.status);
  }

  return jsonResponse(apiSuccess({ updatedAt }));
}
