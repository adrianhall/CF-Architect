import { describe, it, expect } from "vitest";
import type { APIContext } from "astro";
import { GET as listBlueprints } from "@/pages/api/v1/blueprints/index";
import { GET as getBlueprint } from "@/pages/api/v1/blueprints/[id]";
import { createMockContext } from "../../helpers/mock-context";
import { jsonBody } from "../../helpers/fixtures";

describe("GET /api/v1/blueprints", () => {
  it("returns 8 blueprints", async () => {
    const ctx = createMockContext({
      url: "http://localhost:4321/api/v1/blueprints",
    });
    const res = await listBlueprints(ctx as APIContext);
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(8);
  });

  it("returns metadata only (no graphData in list)", async () => {
    const ctx = createMockContext({
      url: "http://localhost:4321/api/v1/blueprints",
    });
    const res = await listBlueprints(ctx as APIContext);
    const body = await jsonBody(res);

    for (const item of body.data) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("category");
      expect(item).not.toHaveProperty("graphData");
    }
  });
});

describe("GET /api/v1/blueprints/:id", () => {
  it("returns the full blueprint for a valid ID", async () => {
    const ctx = createMockContext({
      url: "http://localhost:4321/api/v1/blueprints/api-gateway",
      params: { id: "api-gateway" },
    });
    const res = await getBlueprint(ctx as APIContext);
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe("api-gateway");
    expect(body.data.title).toBe("API Gateway");
    expect(body.data.graphData).toBeTruthy();
  });

  it("returns 404 for a non-existent ID", async () => {
    const ctx = createMockContext({
      url: "http://localhost:4321/api/v1/blueprints/nonexistent",
      params: { id: "nonexistent" },
    });
    const res = await getBlueprint(ctx as APIContext);
    const body = await jsonBody(res);

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
