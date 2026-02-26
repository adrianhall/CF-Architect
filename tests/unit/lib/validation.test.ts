import { describe, it, expect, vi, afterEach } from "vitest";
import { ZodError } from "zod";
import {
  CreateDiagramSchema,
  UpdateDiagramSchema,
  SaveGraphSchema,
  CreateShareSchema,
  apiSuccess,
  apiError,
  DiagramSchema,
  GraphDataSchema,
  fetchApi,
  DiagramResponseSchema,
} from "@lib/validation";

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

describe("CreateDiagramSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(CreateDiagramSchema.parse({})).toEqual({});
  });

  it("accepts a full valid input", () => {
    const input = {
      title: "My Diagram",
      description: "desc",
      blueprintId: "api-gateway",
    };
    expect(CreateDiagramSchema.parse(input)).toEqual(input);
  });

  it("rejects an empty-string title", () => {
    expect(() => CreateDiagramSchema.parse({ title: "" })).toThrow(ZodError);
  });

  it("rejects a title longer than 255 characters", () => {
    expect(() => CreateDiagramSchema.parse({ title: "x".repeat(256) })).toThrow(
      ZodError,
    );
  });

  it("rejects a description longer than 2000 characters", () => {
    expect(() =>
      CreateDiagramSchema.parse({ description: "x".repeat(2001) }),
    ).toThrow(ZodError);
  });
});

describe("UpdateDiagramSchema", () => {
  it("accepts title-only update", () => {
    expect(UpdateDiagramSchema.parse({ title: "New Title" })).toEqual({
      title: "New Title",
    });
  });

  it("accepts null description to clear it", () => {
    const result = UpdateDiagramSchema.parse({ description: null });
    expect(result.description).toBeNull();
  });

  it("rejects an empty-string title", () => {
    expect(() => UpdateDiagramSchema.parse({ title: "" })).toThrow(ZodError);
  });
});

describe("SaveGraphSchema", () => {
  it("accepts valid graphData string", () => {
    const input = { graphData: '{"nodes":[],"edges":[]}' };
    expect(SaveGraphSchema.parse(input)).toEqual(input);
  });

  it("rejects missing graphData", () => {
    expect(() => SaveGraphSchema.parse({})).toThrow(ZodError);
  });

  it("rejects non-string graphData", () => {
    expect(() => SaveGraphSchema.parse({ graphData: 123 })).toThrow(ZodError);
  });
});

describe("CreateShareSchema", () => {
  it("accepts an empty object (expiresIn is optional)", () => {
    expect(CreateShareSchema.parse({})).toEqual({});
  });

  it("accepts a valid expiresIn value", () => {
    expect(CreateShareSchema.parse({ expiresIn: 3600 })).toEqual({
      expiresIn: 3600,
    });
  });

  it("rejects a negative expiresIn", () => {
    expect(() => CreateShareSchema.parse({ expiresIn: -1 })).toThrow(ZodError);
  });

  it("rejects a non-integer expiresIn", () => {
    expect(() => CreateShareSchema.parse({ expiresIn: 3.5 })).toThrow(ZodError);
  });

  it("rejects zero expiresIn", () => {
    expect(() => CreateShareSchema.parse({ expiresIn: 0 })).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// Envelope helpers
// ---------------------------------------------------------------------------

describe("apiSuccess", () => {
  it("wraps data in { ok: true, data }", () => {
    const result = apiSuccess({ id: "abc" });
    expect(result).toEqual({ ok: true, data: { id: "abc" } });
  });
});

describe("apiError", () => {
  it("returns an error envelope with default status 400", () => {
    const result = apiError("BAD_REQUEST", "Invalid input");
    expect(result).toEqual({
      body: {
        ok: false,
        error: { code: "BAD_REQUEST", message: "Invalid input" },
      },
      status: 400,
    });
  });

  it("accepts a custom HTTP status code", () => {
    const result = apiError("NOT_FOUND", "Not found", 404);
    expect(result.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

describe("DiagramSchema", () => {
  it("validates a complete diagram object", () => {
    const diagram = {
      id: "d1",
      ownerId: "u1",
      title: "Test",
      description: null,
      graphData: "{}",
      thumbnailKey: null,
      blueprintId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(DiagramSchema.parse(diagram)).toEqual(diagram);
  });

  it("rejects an object missing required fields", () => {
    expect(() => DiagramSchema.parse({ id: "d1" })).toThrow(ZodError);
  });
});

describe("GraphDataSchema", () => {
  it("provides defaults for an empty object", () => {
    const result = GraphDataSchema.parse({});
    expect(result).toEqual({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  });

  it("validates explicit viewport values", () => {
    const input = {
      nodes: [{ id: "n1" }],
      edges: [],
      viewport: { x: 100, y: -50, zoom: 1.5 },
    };
    const result = GraphDataSchema.parse(input);
    expect(result.viewport).toEqual({ x: 100, y: -50, zoom: 1.5 });
  });
});

// ---------------------------------------------------------------------------
// fetchApi
// ---------------------------------------------------------------------------

describe("fetchApi", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("parses and returns a valid success response", async () => {
    const mockResponse = {
      ok: true,
      data: {
        id: "d1",
        ownerId: "u1",
        title: "T",
        description: null,
        graphData: "{}",
        thumbnailKey: null,
        blueprintId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(mockResponse)));

    const result = await fetchApi("/api/v1/diagrams/d1", DiagramResponseSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("d1");
    }
  });

  it("parses and returns a valid error response", async () => {
    const mockResponse = {
      ok: false,
      error: { code: "NOT_FOUND", message: "Not found" },
    };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(mockResponse)));

    const result = await fetchApi("/api/v1/diagrams/x", DiagramResponseSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("throws ZodError on unexpected response shape", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ garbage: true })));

    await expect(
      fetchApi("/api/v1/diagrams/x", DiagramResponseSchema),
    ).rejects.toThrow(ZodError);
  });
});
