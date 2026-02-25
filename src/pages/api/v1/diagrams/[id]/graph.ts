import type { APIContext } from "astro";
import { eq, and } from "drizzle-orm";
import { createDb } from "@lib/db/client";
import { diagrams } from "@lib/db/schema";
import { SaveGraphSchema, apiSuccess, apiError } from "@lib/validation";
import { nowISO, jsonResponse } from "@lib/helpers";

export async function PUT({ request, params, locals }: APIContext) {
  const body = await request.json().catch(() => ({}));
  const parsed = SaveGraphSchema.safeParse(body);

  if (!parsed.success) {
    const err = apiError("VALIDATION_ERROR", parsed.error.message);
    return jsonResponse(err.body, err.status);
  }

  const db = createDb(locals.runtime.env.DB);
  const existing = await db
    .select({ id: diagrams.id })
    .from(diagrams)
    .where(
      and(eq(diagrams.id, params.id!), eq(diagrams.ownerId, locals.user.id)),
    )
    .get();

  if (!existing) {
    const err = apiError("NOT_FOUND", "Diagram not found", 404);
    return jsonResponse(err.body, err.status);
  }

  const now = nowISO();
  await db
    .update(diagrams)
    .set({ graphData: parsed.data.graphData, updatedAt: now })
    .where(eq(diagrams.id, params.id!));

  return jsonResponse(apiSuccess({ updatedAt: now }));
}
