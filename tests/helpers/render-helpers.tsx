import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { useDiagramStore } from "@islands/store/diagramStore";

/**
 * Wrapper that provides the ReactFlowProvider context mock.
 * Since we mock @xyflow/react, ReactFlowProvider is a passthrough fragment,
 * but this wrapper keeps test code consistent with production component trees.
 */
function FlowWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function renderWithFlow(
  ui: React.ReactElement,
  options?: RenderOptions,
) {
  return render(ui, { wrapper: FlowWrapper, ...options });
}

export function resetStore() {
  useDiagramStore.setState({
    diagramId: null,
    title: "Untitled Diagram",
    description: "",
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: null,
    selectedEdgeId: null,
    dirty: false,
    saving: false,
    lastSavedAt: null,
    saveError: null,
    undoStack: [],
    redoStack: [],
    printMode: false,
  });
}

export {
  screen,
  fireEvent,
  within,
  waitFor,
  act,
} from "@testing-library/react";
