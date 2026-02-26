import { describe, it, expect } from "vitest";
import { BLUEPRINTS } from "@lib/blueprints";
import { GraphDataSchema } from "@lib/validation";
import { NODE_TYPE_MAP } from "@lib/catalog";

describe.each(BLUEPRINTS.map((b) => [b.id, b]))(
  "Blueprint %s graph data",
  (_id, bp) => {
    const graph = JSON.parse(bp.graphData) as {
      nodes: any[];
      edges: any[];
      viewport: any;
    };

    it("passes GraphDataSchema validation", () => {
      expect(() => GraphDataSchema.parse(graph)).not.toThrow();
    });

    it("has at least 2 nodes and 1 edge", () => {
      expect(graph.nodes.length).toBeGreaterThanOrEqual(2);
      expect(graph.edges.length).toBeGreaterThanOrEqual(1);
    });

    it("has no duplicate node IDs", () => {
      const ids = graph.nodes.map((n: any) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("all nodes use type cf-node", () => {
      for (const node of graph.nodes) {
        expect(node.type).toBe("cf-node");
      }
    });

    it("all edges use type cf-edge", () => {
      for (const edge of graph.edges) {
        expect(edge.type).toBe("cf-edge");
      }
    });

    it("all node typeIds exist in catalog", () => {
      for (const node of graph.nodes) {
        expect(NODE_TYPE_MAP.has(node.data.typeId)).toBe(true);
      }
    });

    it("all edge source/target IDs reference existing nodes", () => {
      const nodeIds = new Set(graph.nodes.map((n: any) => n.id));
      for (const edge of graph.edges) {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      }
    });
  },
);
