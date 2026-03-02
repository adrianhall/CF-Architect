/**
 * Diagrams collection API.
 * Handles GET (list) and POST (create) for diagrams.
 */

import type { APIContext } from "astro";
import { createRepositories } from "@lib/repository";
import { CreateDiagramSchema, apiSuccess, apiError } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";
import { BLUEPRINT_MAP } from "@lib/blueprints";

/**
 * Lists all diagrams for the current user, ordered by most recently updated.
 *
 * @param context - Astro API context with locals (user, runtime.env)
 * @returns ApiResult<Diagram[]>
 */
export async function GET({ locals }: APIContext) {
  const { diagrams } = createRepositories(locals.runtime.env);
  const rows = await diagrams.listByOwner(locals.user.id);
  return jsonResponse(apiSuccess(rows));
}

/**
 * Creates a new diagram, optionally cloning graph data from a blueprint.
 * Validates request body via CreateDiagramSchema.
 *
 * @param context - Astro API context with request, locals (user, runtime.env)
 * @returns 201 with the new diagram, or 404 if blueprintId is invalid
 */
export async function POST({ request, locals }: APIContext) {
  const body = await request.json().catch(() => ({}));
  const parsed = CreateDiagramSchema.safeParse(body);

  if (!parsed.success) {
    const err = apiError("VALIDATION_ERROR", parsed.error.message);
    return jsonResponse(err.body, err.status);
  }

  const { title, description, blueprintId } = parsed.data;

  let graphData: string | undefined;

  if (blueprintId) {
    const bp = BLUEPRINT_MAP.get(blueprintId);
    if (!bp) {
      const err = apiError(
        "NOT_FOUND",
        `Blueprint "${blueprintId}" not found`,
        404,
      );
      return jsonResponse(err.body, err.status);
    }
    graphData = bp.graphData;
  }

  const { diagrams } = createRepositories(locals.runtime.env);
  const row = await diagrams.create({
    ownerId: locals.user.id,
    title,
    description,
    graphData,
    blueprintId,
  });

  return jsonResponse(apiSuccess(row), 201);
}
