/**
 * Shared mock for @xyflow/react used by both store tests and component tests.
 *
 * Store tests need the functional helpers (applyNodeChanges, applyEdgeChanges,
 * addEdge). Component tests additionally need stub React components
 * (ReactFlow, Handle, BaseEdge, etc.) so JSX renders without errors.
 */
import { vi } from "vitest";
import React from "react";

export const mockFitView = vi.fn().mockResolvedValue(undefined);
export const mockZoomIn = vi.fn().mockResolvedValue(undefined);
export const mockZoomOut = vi.fn().mockResolvedValue(undefined);
export const mockGetZoom = vi.fn().mockReturnValue(1);
export const mockScreenToFlowPosition = vi
  .fn()
  .mockImplementation((pos: { x: number; y: number }) => pos);

export function createXyflowMock() {
  return {
    // Functional helpers (used by diagramStore)
    applyNodeChanges: (changes: any[], nodes: any[]) => {
      let result = [...nodes];
      for (const c of changes) {
        if (c.type === "add") result.push(c.item);
        if (c.type === "remove")
          result = result.filter((n: any) => n.id !== c.id);
        if (c.type === "position" && c.position)
          result = result.map((n: any) =>
            n.id === c.id ? { ...n, position: c.position } : n,
          );
      }
      return result;
    },

    applyEdgeChanges: (changes: any[], edges: any[]) => {
      let result = [...edges];
      for (const c of changes) {
        if (c.type === "add") result.push(c.item);
        if (c.type === "remove")
          result = result.filter((e: any) => e.id !== c.id);
      }
      return result;
    },

    addEdge: (edge: any, edges: any[]) => [
      ...edges,
      { id: `${edge.source}-${edge.target}`, ...edge },
    ],

    // Stub React components
    ReactFlow: ({ children, nodes, edges, ...props }: any) => {
      void nodes;
      void edges;
      const domSafe = ["className", "id", "style", "tabIndex", "role"];
      const filtered: Record<string, any> = { "data-testid": "react-flow" };
      for (const k of domSafe) {
        if (props[k] !== undefined) filtered[k] = props[k];
      }
      return React.createElement("div", filtered, children);
    },

    ReactFlowProvider: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),

    Background: () =>
      React.createElement("div", { "data-testid": "rf-background" }),
    MiniMap: () => React.createElement("div", { "data-testid": "rf-minimap" }),
    Controls: () =>
      React.createElement("div", { "data-testid": "rf-controls" }),

    Handle: (props: any) =>
      React.createElement("div", {
        "data-testid": `handle-${props.id ?? "unknown"}`,
        "data-handle-type": props.type,
        "data-handle-position": props.position,
      }),

    BaseEdge: (props: any) =>
      React.createElement("path", {
        "data-testid": "base-edge",
        d: props.path,
        style: props.style,
        className: props.className,
        "data-marker-end": props.markerEnd ?? "",
      }),

    EdgeLabelRenderer: ({ children }: any) =>
      React.createElement(
        "div",
        { "data-testid": "edge-label-renderer" },
        children,
      ),

    getSmoothStepPath: () => ["M0,0 L100,100", 50, 50],

    useReactFlow: () => ({
      fitView: mockFitView,
      zoomIn: mockZoomIn,
      zoomOut: mockZoomOut,
      getZoom: mockGetZoom,
      screenToFlowPosition: mockScreenToFlowPosition,
    }),

    // Enums
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    BackgroundVariant: { Dots: "dots", Lines: "lines", Cross: "cross" },
  };
}
