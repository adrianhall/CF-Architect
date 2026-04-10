/**
 * Admin users collection API.
 * Handles GET (paginated list) for the admin user management interface.
 */

import type { APIContext } from "astro";
import { getEnv } from "@lib/env";
import { createRepositories } from "@lib/repository";
import type { ListUsersOptions } from "@lib/repository";
import { apiSuccess } from "@lib/validation";
import { jsonResponse, parseIntParam } from "@lib/helpers";

const SORTABLE_COLUMNS: ListUsersOptions["sortBy"][] = [
  "email",
  "displayName",
  "createdAt",
];
const SORT_ORDERS: ListUsersOptions["sortOrder"][] = ["asc", "desc"];

export async function GET({ locals, url }: APIContext) {
  const page = Math.max(1, parseIntParam(url.searchParams.get("page"), 1));
  const pageSize = Math.min(
    100,
    Math.max(1, parseIntParam(url.searchParams.get("pageSize"), 20)),
  );

  let sortBy = url.searchParams.get("sortBy") as ListUsersOptions["sortBy"];
  if (!SORTABLE_COLUMNS.includes(sortBy)) sortBy = "email";

  let sortOrder = url.searchParams.get(
    "sortOrder",
  ) as ListUsersOptions["sortOrder"];
  if (!SORT_ORDERS.includes(sortOrder)) sortOrder = "asc";

  const search = url.searchParams.get("search") || undefined;

  const { users } = createRepositories(getEnv(locals));
  const result = await users.list({
    page,
    pageSize,
    sortBy,
    sortOrder,
    search,
  });

  return jsonResponse(apiSuccess(result));
}
