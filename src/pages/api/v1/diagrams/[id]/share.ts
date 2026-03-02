/**
 * Share link management for a specific diagram.
 */

import type { APIContext } from "astro";
import { createRepositories } from "@lib/repository";
import { CreateShareSchema, apiSuccess, apiError } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";

/**
 * Creates a new share link.
 * If an active (non-expired) share link already exists, returns it instead.
 *
 * @param context - Astro API context with request, params (id), locals (user, runtime.env)
 * @returns 201 with token and URL, or 200 if reusing existing link, or 404 if diagram not found
 */
export async function POST({ request, params, locals }: APIContext) {
  const body = await request.json().catch(() => ({}));
  const parsed = CreateShareSchema.safeParse(body);

  if (!parsed.success) {
    const err = apiError("VALIDATION_ERROR", parsed.error.message);
    return jsonResponse(err.body, err.status);
  }

  const { diagrams, shares } = createRepositories(locals.runtime.env);

  const existing = await diagrams.getByIdAndOwner(params.id!, locals.user.id);
  if (!existing) {
    const err = apiError("NOT_FOUND", "Diagram not found", 404);
    return jsonResponse(err.body, err.status);
  }

  const activeLink = await shares.getUnexpiredShareLinkInfo(params.id!);
  if (activeLink) {
    const url = new URL(`/s/${activeLink.token}`, request.url).toString();
    return jsonResponse(apiSuccess({ ...activeLink, url }), 200);
  }

  const result = await shares.create(
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

  const { shares } = createRepositories(locals.runtime.env);

  const link = await shares.getByTokenDiagramAndCreator(
    token,
    params.id!,
    locals.user.id,
  );

  if (!link) {
    const err = apiError("NOT_FOUND", "Share link not found", 404);
    return jsonResponse(err.body, err.status);
  }

  await shares.revoke(token);

  return new Response(null, { status: 204 });
}
