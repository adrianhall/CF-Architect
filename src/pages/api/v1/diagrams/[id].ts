/**
 * Single diagram API by ID.
 * Handles GET (single), PATCH (metadata update), and DELETE for a specific diagram.
 */

import type { APIContext } from "astro";
import { eq, and } from "drizzle-orm";
import { createDb } from "@lib/db/client";
import { diagrams } from "@lib/db/schema";
import { UpdateDiagramSchema, apiSuccess, apiError } from "@lib/validation";
import { nowISO, jsonResponse } from "@lib/helpers";

/**
 * Fetches a single diagram by ID scoped to the current user.
 *
 * @param context - Astro API context with params (id), locals (user, runtime.env)
 * @returns The diagram, or 404 if not found
 */
export async function GET({ params, locals }: APIContext) {
  const db = createDb(locals.runtime.env.DB);
  const row = await db
    .select()
    .from(diagrams)
    .where(
      and(eq(diagrams.id, params.id!), eq(diagrams.ownerId, locals.user.id)),
    )
    .get();

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
  const body = await request.json().catch(() => ({}));
  const parsed = UpdateDiagramSchema.safeParse(body);

  if (!parsed.success) {
    const err = apiError("VALIDATION_ERROR", parsed.error.message);
    return jsonResponse(err.body, err.status);
  }

  const db = createDb(locals.runtime.env.DB);
  const existing = await db
    .select()
    .from(diagrams)
    .where(
      and(eq(diagrams.id, params.id!), eq(diagrams.ownerId, locals.user.id)),
    )
    .get();

  if (!existing) {
    const err = apiError("NOT_FOUND", "Diagram not found", 404);
    return jsonResponse(err.body, err.status);
  }

  const updates: Record<string, unknown> = { updatedAt: nowISO() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description;

  await db
    .update(diagrams)
    .set(updates)
    .where(eq(diagrams.id, params.id!));

  const updated = await db
    .select()
    .from(diagrams)
    .where(eq(diagrams.id, params.id!))
    .get();

  return jsonResponse(apiSuccess(updated));
}

/**
 * Permanently removes a diagram.
 *
 * @param context - Astro API context with params (id), locals (user, runtime.env)
 * @returns 204 on success, or 404 if not found
 */
export async function DELETE({ params, locals }: APIContext) {
  const db = createDb(locals.runtime.env.DB);
  const existing = await db
    .select()
    .from(diagrams)
    .where(
      and(eq(diagrams.id, params.id!), eq(diagrams.ownerId, locals.user.id)),
    )
    .get();

  if (!existing) {
    const err = apiError("NOT_FOUND", "Diagram not found", 404);
    return jsonResponse(err.body, err.status);
  }

  await db.delete(diagrams).where(eq(diagrams.id, params.id!));

  return new Response(null, { status: 204 });
}
