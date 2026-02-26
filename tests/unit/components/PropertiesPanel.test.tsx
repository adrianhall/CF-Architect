// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PropertiesPanel } from "@islands/panels/PropertiesPanel";
import { useDiagramStore } from "@islands/store/diagramStore";
import { resetStore } from "../../helpers/render-helpers";

function makeNode(id: string, overrides: Record<string, unknown> = {}): any {
  return {
    id,
    type: "cf-node",
    position: { x: 0, y: 0 },
    data: { typeId: "worker", label: "My Worker", ...overrides },
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  overrides: Record<string, unknown> = {},
): any {
  return {
    id,
    source,
    target,
    type: "cf-edge",
    data: { edgeType: "data-flow" as const, ...overrides },
  };
}

beforeEach(() => {
  resetStore();
});

describe("PropertiesPanel", () => {
  describe("empty state", () => {
    it("shows prompt when nothing is selected", () => {
      render(<PropertiesPanel />);
      expect(
        screen.getByText("Select a node or edge to view its properties"),
      ).toBeInTheDocument();
    });
  });

  describe("node properties", () => {
    beforeEach(() => {
      useDiagramStore.setState({
        nodes: [makeNode("n1", { label: "My Worker", description: "Does things" })],
        selectedNodeId: "n1",
      });
    });

    it("renders 'Node Properties' title", () => {
      render(<PropertiesPanel />);
      expect(screen.getByText("Node Properties")).toBeInTheDocument();
    });

    it("shows the node type label", () => {
      render(<PropertiesPanel />);
      expect(screen.getByText("Workers")).toBeInTheDocument();
    });

    it("shows the category label", () => {
      render(<PropertiesPanel />);
      expect(screen.getByText("Compute")).toBeInTheDocument();
    });

    it("shows label input with current value", () => {
      render(<PropertiesPanel />);
      const input = screen.getByDisplayValue("My Worker");
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe("INPUT");
    });

    it("fires updateNodeData when label changes", () => {
      render(<PropertiesPanel />);
      const input = screen.getByDisplayValue("My Worker");
      fireEvent.change(input, { target: { value: "Renamed" } });

      const node = useDiagramStore.getState().nodes.find((n) => n.id === "n1");
      expect(node?.data.label).toBe("Renamed");
    });

    it("shows description textarea", () => {
      render(<PropertiesPanel />);
      const textarea = screen.getByDisplayValue("Does things");
      expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("fires updateNodeData when description changes", () => {
      render(<PropertiesPanel />);
      const textarea = screen.getByDisplayValue("Does things");
      fireEvent.change(textarea, { target: { value: "New desc" } });

      const node = useDiagramStore.getState().nodes.find((n) => n.id === "n1");
      expect(node?.data.description).toBe("New desc");
    });

    it("renders accent color picker", () => {
      render(<PropertiesPanel />);
      const colorInput = document.querySelector('input[type="color"]');
      expect(colorInput).toBeInTheDocument();
    });
  });

  describe("edge properties", () => {
    beforeEach(() => {
      useDiagramStore.setState({
        nodes: [makeNode("n1"), makeNode("n2")],
        edges: [makeEdge("e1", "n1", "n2", { label: "REST", protocol: "http" })],
        selectedEdgeId: "e1",
      });
    });

    it("renders 'Edge Properties' title", () => {
      render(<PropertiesPanel />);
      expect(screen.getByText("Edge Properties")).toBeInTheDocument();
    });

    it("shows edge type selector with current value", () => {
      render(<PropertiesPanel />);
      const select = screen.getByDisplayValue("Data Flow");
      expect(select.tagName).toBe("SELECT");
    });

    it("fires updateEdgeData when edge type changes", () => {
      render(<PropertiesPanel />);
      const select = screen.getByDisplayValue("Data Flow");
      fireEvent.change(select, { target: { value: "service-binding" } });

      const edge = useDiagramStore.getState().edges.find((e) => e.id === "e1");
      expect(edge?.data?.edgeType).toBe("service-binding");
    });

    it("shows label input with current value", () => {
      render(<PropertiesPanel />);
      expect(screen.getByDisplayValue("REST")).toBeInTheDocument();
    });

    it("fires updateEdgeData when label changes", () => {
      render(<PropertiesPanel />);
      const input = screen.getByDisplayValue("REST");
      fireEvent.change(input, { target: { value: "GraphQL" } });

      const edge = useDiagramStore.getState().edges.find((e) => e.id === "e1");
      expect(edge?.data?.label).toBe("GraphQL");
    });

    it("shows protocol selector", () => {
      render(<PropertiesPanel />);
      const select = screen.getByDisplayValue("HTTP");
      expect(select.tagName).toBe("SELECT");
    });

    it("fires updateEdgeData when protocol changes", () => {
      render(<PropertiesPanel />);
      const select = screen.getByDisplayValue("HTTP");
      fireEvent.change(select, { target: { value: "ws" } });

      const edge = useDiagramStore.getState().edges.find((e) => e.id === "e1");
      expect(edge?.data?.protocol).toBe("ws");
    });

    it("shows description textarea", () => {
      render(<PropertiesPanel />);
      const textareas = document.querySelectorAll("textarea");
      expect(textareas.length).toBeGreaterThan(0);
    });
  });
});
