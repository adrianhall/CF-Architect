import { describe, it, expect } from "vitest";
import type { APIContext } from "astro";
import { GET as listBlueprints } from "@/pages/api/v1/blueprints/index";
import { GET as getBlueprint } from "@/pages/api/v1/blueprints/[id]";
import { createMockContext } from "../../helpers/mock-context";
import { jsonBody } from "../../helpers/fixtures";

describe("GET /api/v1/blueprints", () => {
  it("returns an empty list in MVP", async () => {
    const ctx = createMockContext({
      url: "http://localhost:4321/api/v1/blueprints",
    });
    const res = await listBlueprints(ctx as APIContext);
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: [] });
  });
});

describe("GET /api/v1/blueprints/:id", () => {
  it("returns 404 for any ID (no blueprints in MVP)", async () => {
    const ctx = createMockContext({
      url: "http://localhost:4321/api/v1/blueprints/api-gateway",
      params: { id: "api-gateway" },
    });
    const res = await getBlueprint(ctx as APIContext);
    const body = await jsonBody(res);

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
