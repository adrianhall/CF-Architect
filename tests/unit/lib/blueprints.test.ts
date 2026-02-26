import { describe, it, expect } from "vitest";
import { BLUEPRINTS, BLUEPRINT_MAP } from "@lib/blueprints";
import { NODE_TYPE_MAP } from "@lib/catalog";

const EXPECTED_IDS = [
  "api-gateway",
  "fullstack-app",
  "ai-rag",
  "event-driven",
  "realtime-collab",
  "multi-tenant-saas",
  "media-pipeline",
  "bff",
];

describe("BLUEPRINTS", () => {
  it("contains exactly 8 blueprints", () => {
    expect(BLUEPRINTS).toHaveLength(8);
  });

  it("has all expected IDs", () => {
    const ids = BLUEPRINTS.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(EXPECTED_IDS));
  });

  it("all IDs are unique", () => {
    const ids = BLUEPRINTS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(EXPECTED_IDS)("%s has required fields", (id) => {
    const bp = BLUEPRINT_MAP.get(id);
    expect(bp).toBeDefined();
    expect(bp!.title).toBeTruthy();
    expect(bp!.description).toBeTruthy();
    expect(bp!.category).toBeTruthy();
    expect(bp!.graphData).toBeTruthy();
  });

  it.each(EXPECTED_IDS)("%s graphData is valid JSON with nodes/edges", (id) => {
    const bp = BLUEPRINT_MAP.get(id)!;
    const graph = JSON.parse(bp.graphData) as {
      nodes: any[];
      edges: any[];
      viewport: any;
    };

    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(2);
    expect(graph.edges.length).toBeGreaterThanOrEqual(1);
    expect(graph.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it.each(EXPECTED_IDS)(
    "%s nodes reference valid typeIds from catalog",
    (id) => {
      const bp = BLUEPRINT_MAP.get(id)!;
      const graph = JSON.parse(bp.graphData) as { nodes: any[] };

      for (const node of graph.nodes) {
        expect(NODE_TYPE_MAP.has(node.data.typeId)).toBe(true);
      }
    },
  );

  it.each(EXPECTED_IDS)(
    "%s edges reference valid node IDs within the blueprint",
    (id) => {
      const bp = BLUEPRINT_MAP.get(id)!;
      const graph = JSON.parse(bp.graphData) as {
        nodes: any[];
        edges: any[];
      };
      const nodeIds = new Set(graph.nodes.map((n: any) => n.id));

      for (const edge of graph.edges) {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      }
    },
  );
});

describe("BLUEPRINT_MAP", () => {
  it("has size 8", () => {
    expect(BLUEPRINT_MAP.size).toBe(8);
  });

  it("maps each ID to the correct blueprint", () => {
    for (const bp of BLUEPRINTS) {
      expect(BLUEPRINT_MAP.get(bp.id)).toBe(bp);
    }
  });

  it("returns undefined for unknown keys", () => {
    expect(BLUEPRINT_MAP.get("nonexistent")).toBeUndefined();
  });
});
