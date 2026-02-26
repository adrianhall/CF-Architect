/**
 * Share link management for a specific diagram.
 */

import type { APIContext } from "astro";
import { eq, and } from "drizzle-orm";
import { createDb } from "@lib/db/client";
import { diagrams, shareLinks } from "@lib/db/schema";
import { CreateShareSchema, apiSuccess, apiError } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";
import { createShareLink, revokeShareLink } from "@lib/share";

/**
 * Creates a new share link.
 * Generates a token and writes to D1 + KV.
 *
 * @param context - Astro API context with request, params (id), locals (user, runtime.env)
 * @returns 201 with token and URL, or 404 if diagram not found
 */
export async function POST({ request, params, locals }: APIContext) {
  const body = await request.json().catch(() => ({}));
  const parsed = CreateShareSchema.safeParse(body);

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

  const existingLink = await db
    .select({ token: shareLinks.token, expiresAt: shareLinks.expiresAt })
    .from(shareLinks)
    .where(eq(shareLinks.diagramId, params.id!))
    .get();

  if (
    existingLink &&
    (!existingLink.expiresAt || new Date(existingLink.expiresAt) > new Date())
  ) {
    const url = new URL(`/s/${existingLink.token}`, request.url).toString();
    return jsonResponse(
      apiSuccess({
        token: existingLink.token,
        expiresAt: existingLink.expiresAt,
        url,
      }),
      200,
    );
  }

  const result = await createShareLink(
    db,
    locals.runtime.env.KV,
    params.id!,
    locals.user.id,
    parsed.data.expiresIn,
  );

  const url = new URL(`/s/${result.token}`, request.url).toString();

  return jsonResponse(apiSuccess({ ...result, url }), 201);
}

/**
 * Revokes a share link.
 * Expects `?token=` query parameter.
 *
 * @param context - Astro API context with request, params (id), locals (user, runtime.env)
 * @returns 204 on success, or 404 if share link not found
 */
export async function DELETE({ request, params, locals }: APIContext) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    const err = apiError("VALIDATION_ERROR", "Missing token parameter");
    return jsonResponse(err.body, err.status);
  }

  const db = createDb(locals.runtime.env.DB);

  const link = await db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.token, token),
        eq(shareLinks.diagramId, params.id!),
        eq(shareLinks.createdBy, locals.user.id),
      ),
    )
    .get();

  if (!link) {
    const err = apiError("NOT_FOUND", "Share link not found", 404);
    return jsonResponse(err.body, err.status);
  }

  await revokeShareLink(db, locals.runtime.env.KV, token);

  return new Response(null, { status: 204 });
}
