import type { APIContext } from "astro";
import { eq } from "drizzle-orm";
import { createDb } from "@lib/db/client";
import { diagrams } from "@lib/db/schema";
import { apiSuccess, apiError } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";
import { resolveShareToken } from "@lib/share";

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
