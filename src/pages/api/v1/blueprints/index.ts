import type { APIContext } from "astro";
import { BLUEPRINTS } from "@lib/blueprints";
import { apiSuccess } from "@lib/validation";
import { jsonResponse } from "@lib/helpers";

export async function GET(_context: APIContext) {
  const list = BLUEPRINTS.map(({ graphData: _, ...rest }) => rest);
  return jsonResponse(apiSuccess(list));
}
