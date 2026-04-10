/**
 * Single diagram API by ID.
 * Handles GET (single), PATCH (metadata update), and DELETE for a specific diagram.
 */

import type { APIContext } from "astro";
import { getEnv } from "@lib/env";
import { createRepositories } from "@lib/repository";
import { UpdateDiagramSchema, apiSuccess, apiError } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";

/**
 * Fetches a single diagram by ID scoped to the current user.
 *
 * @param context - Astro API context with params (id), locals (user, runtime.env)
 * @returns The diagram, or 404 if not found
 */
export async function GET({ params, locals }: APIContext) {
  if (!locals.user) {
    return jsonResponse(apiError("UNAUTHORIZED", "Unauthorized").body, 401);
  }
  const { diagrams } = createRepositories(getEnv(locals));
  const row = await diagrams.getByIdAndOwner(params.id!, locals.user.id);

  if (!row) {
    const err = apiError("NOT_FOUND", "Diagram not found", 404);
    return jsonResponse(err.body, err.status);
  }

  return jsonResponse(apiSuccess(row));
}

/**
 * Partial update of diagram title and/or description.
 * Validates request body via UpdateDiagramSchema.
 *
 * @param context - Astro API context with request, params (id), locals (user, runtime.env)
 * @returns The updated diagram, or 404 if not found
 */
export async function PATCH({ request, params, locals }: APIContext) {
  if (!locals.user) {
    return jsonResponse(apiError("UNAUTHORIZED", "Unauthorized").body, 401);
  }
  const body = await request.json().catch(() => ({}));
  const parsed = UpdateDiagramSchema.safeParse(body);

  if (!parsed.success) {
    const err = apiError("VALIDATION_ERROR", parsed.error.message);
    return jsonResponse(err.body, err.status);
  }

  const { diagrams } = createRepositories(getEnv(locals));
  const updated = await diagrams.updateMetadata(
    params.id!,
    locals.user.id,
    parsed.data,
  );

  if (!updated) {
    const err = apiError("NOT_FOUND", "Diagram not found", 404);
    return jsonResponse(err.body, err.status);
  }

  return jsonResponse(apiSuccess(updated));
}

/**
 * Permanently removes a diagram and cascades share link cleanup.
 *
 * @param context - Astro API context with params (id), locals (user, runtime.env)
 * @returns 204 on success, or 404 if not found
 */
export async function DELETE({ params, locals }: APIContext) {
  if (!locals.user) {
    return jsonResponse(apiError("UNAUTHORIZED", "Unauthorized").body, 401);
  }
  const { diagrams, shares } = createRepositories(getEnv(locals));

  await shares.revokeAllForDiagram(params.id!);
  const removed = await diagrams.remove(params.id!, locals.user.id);

  if (!removed) {
    const err = apiError("NOT_FOUND", "Diagram not found", 404);
    return jsonResponse(err.body, err.status);
  }

  return new Response(null, { status: 204 });
}
