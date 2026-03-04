/**
 * Admin single-user API.
 * Handles DELETE (remove user) and PATCH (promote/demote) for admin management.
 */

import type { APIContext } from "astro";
import { createRepositories } from "@lib/repository";
import { UpdateUserAdminSchema, apiSuccess, apiError } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";

export async function DELETE({ params, locals }: APIContext) {
  if (!locals.user) {
    return jsonResponse(apiError("UNAUTHORIZED", "Unauthorized").body, 401);
  }
  const { id } = params;

  if (locals.user.id === id) {
    const err = apiError("SELF_ACTION", "You cannot delete your own account");
    return jsonResponse(err.body, err.status);
  }

  const { users } = createRepositories(locals.runtime.env);
  const deleted = await users.delete(id!);

  if (!deleted) {
    const err = apiError("NOT_FOUND", "User not found", 404);
    return jsonResponse(err.body, err.status);
  }

  return jsonResponse(apiSuccess({ deleted: true }));
}

export async function PATCH({ params, request, locals }: APIContext) {
  if (!locals.user) {
    return jsonResponse(apiError("UNAUTHORIZED", "Unauthorized").body, 401);
  }
  const { id } = params;

  const body = await request.json().catch(() => ({}));
  const parsed = UpdateUserAdminSchema.safeParse(body);

  if (!parsed.success) {
    const err = apiError("VALIDATION_ERROR", parsed.error.message);
    return jsonResponse(err.body, err.status);
  }

  if (locals.user.id === id && !parsed.data.isAdmin) {
    const err = apiError("SELF_ACTION", "You cannot demote yourself");
    return jsonResponse(err.body, err.status);
  }

  const { users } = createRepositories(locals.runtime.env);
  const updated = await users.setAdmin(id!, parsed.data.isAdmin);

  if (!updated) {
    const err = apiError("NOT_FOUND", "User not found", 404);
    return jsonResponse(err.body, err.status);
  }

  return jsonResponse(apiSuccess(updated));
}
