/**
 * Diagrams collection API.
 * Handles GET (list) and POST (create) for diagrams.
 */

import type { APIContext } from "astro";
import { eq, desc } from "drizzle-orm";
import { createDb } from "@lib/db/client";
import { diagrams } from "@lib/db/schema";
import { CreateDiagramSchema, apiSuccess, apiError } from "@lib/validation";
import { generateId, nowISO, jsonResponse } from "@lib/helpers";
import { BLUEPRINT_MAP } from "@lib/blueprints";

/**
 * Lists all diagrams for the current user, ordered by most recently updated.
 *
 * @param context - Astro API context with locals (user, runtime.env)
 * @returns ApiResult<Diagram[]>
 */
export async function GET({ locals }: APIContext) {
  const db = createDb(locals.runtime.env.DB);
  const rows = await db
    .select()
    .from(diagrams)
    .where(eq(diagrams.ownerId, locals.user.id))
    .orderBy(desc(diagrams.updatedAt));

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
  const now = nowISO();

  let graphData = JSON.stringify({
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });

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

  const row = {
    id: generateId(),
    ownerId: locals.user.id,
    title: title ?? "Untitled Diagram",
    description: description ?? null,
    graphData,
    blueprintId: blueprintId ?? null,
    thumbnailKey: null,
    createdAt: now,
    updatedAt: now,
  };

  const db = createDb(locals.runtime.env.DB);
  await db.insert(diagrams).values(row);

  return jsonResponse(apiSuccess(row), 201);
}
