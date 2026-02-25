/**
 * Public share token resolver.
 * No authentication required.
 */

import type { APIContext } from "astro";
import { eq } from "drizzle-orm";
import { createDb } from "@lib/db/client";
import { diagrams } from "@lib/db/schema";
import { apiSuccess, apiError } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";
import { resolveShareToken } from "@lib/share";

/**
 * Resolves a share token to diagram data.
 * Returns the diagram's id, title, description, and graphData.
 *
 * @param context - Astro API context with params (token), locals (runtime.env)
 * @returns The diagram data, or 404 if token is expired or not found
 */
export async function GET({ params, locals }: APIContext) {
  const db = createDb(locals.runtime.env.DB);
  const meta = await resolveShareToken(
    locals.runtime.env.KV,
    db,
    params.token!,
  );

  if (!meta) {
    const err = apiError("NOT_FOUND", "Share link not found or expired", 404);
    return jsonResponse(err.body, err.status);
  }

  const diagram = await db
    .select({
      id: diagrams.id,
      title: diagrams.title,
      description: diagrams.description,
      graphData: diagrams.graphData,
    })
    .from(diagrams)
    .where(eq(diagrams.id, meta.diagramId))
    .get();

  if (!diagram) {
    const err = apiError("NOT_FOUND", "Diagram not found", 404);
    return jsonResponse(err.body, err.status);
  }

  return jsonResponse(apiSuccess(diagram));
}
