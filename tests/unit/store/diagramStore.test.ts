import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@xyflow/react", () => ({
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
}));

import { useDiagramStore } from "@islands/store/diagramStore";
import type { CFNodeData, CFEdgeData } from "@islands/types";

function makeNode(id: string, overrides: Partial<CFNodeData> = {}): any {
  return {
    id,
    type: "cf-node",
    position: { x: 0, y: 0 },
    data: { typeId: "worker", label: "W", ...overrides },
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  overrides: Partial<CFEdgeData> = {},
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
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe("default state", () => {
  it("has correct initial values", () => {
    const s = useDiagramStore.getState();
    expect(s.diagramId).toBeNull();
    expect(s.title).toBe("Untitled Diagram");
    expect(s.dirty).toBe(false);
    expect(s.nodes).toEqual([]);
    expect(s.edges).toEqual([]);
    expect(s.undoStack).toEqual([]);
    expect(s.redoStack).toEqual([]);
  });
});

describe("setDiagram", () => {
  it("populates all fields and resets dirty/history", () => {
    const { setDiagram } = useDiagramStore.getState();
    const nodes = [makeNode("n1")];
    const edges = [makeEdge("e1", "n1", "n2")];
    const viewport = { x: 10, y: 20, zoom: 2 };

    setDiagram("d-1", "My Diagram", "desc", nodes, edges, viewport);

    const s = useDiagramStore.getState();
    expect(s.diagramId).toBe("d-1");
    expect(s.title).toBe("My Diagram");
    expect(s.description).toBe("desc");
    expect(s.nodes).toEqual(nodes);
    expect(s.edges).toEqual(edges);
    expect(s.viewport).toEqual(viewport);
    expect(s.dirty).toBe(false);
    expect(s.undoStack).toEqual([]);
    expect(s.redoStack).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Node/edge mutations
// ---------------------------------------------------------------------------

describe("addNode", () => {
  it("appends a node and marks dirty", () => {
    const node = makeNode("n1");
    useDiagramStore.getState().addNode(node);

    const s = useDiagramStore.getState();
    expect(s.nodes).toHaveLength(1);
    expect(s.nodes[0].id).toBe("n1");
    expect(s.dirty).toBe(true);
  });

  it("pushes history before mutation", () => {
    useDiagramStore.getState().addNode(makeNode("n1"));
    expect(useDiagramStore.getState().undoStack).toHaveLength(1);
  });
});

describe("updateNodeData", () => {
  it("merges partial data into the correct node", () => {
    useDiagramStore.setState({ nodes: [makeNode("n1"), makeNode("n2")] });
    useDiagramStore.getState().updateNodeData("n1", { label: "Updated" });

    const s = useDiagramStore.getState();
    expect(s.nodes[0].data.label).toBe("Updated");
    expect(s.nodes[1].data.label).toBe("W");
    expect(s.dirty).toBe(true);
  });
});

describe("updateEdgeData", () => {
  it("merges partial data into the correct edge", () => {
    useDiagramStore.setState({ edges: [makeEdge("e1", "n1", "n2")] });
    useDiagramStore.getState().updateEdgeData("e1", { label: "REST" });

    const s = useDiagramStore.getState();
    expect(s.edges[0].data?.label).toBe("REST");
    expect(s.dirty).toBe(true);
  });
});

describe("removeSelected", () => {
  it("filters out selected nodes and edges, clears selection IDs", () => {
    useDiagramStore.setState({
      nodes: [{ ...makeNode("n1"), selected: true }, makeNode("n2")],
      edges: [{ ...makeEdge("e1", "n1", "n2"), selected: true }],
      selectedNodeId: "n1",
      selectedEdgeId: "e1",
    });

    useDiagramStore.getState().removeSelected();

    const s = useDiagramStore.getState();
    expect(s.nodes).toHaveLength(1);
    expect(s.nodes[0].id).toBe("n2");
    expect(s.edges).toHaveLength(0);
    expect(s.selectedNodeId).toBeNull();
    expect(s.selectedEdgeId).toBeNull();
    expect(s.dirty).toBe(true);
  });
});

describe("setNodes / setEdges", () => {
  it("replaces arrays and marks dirty", () => {
    const nodes = [makeNode("x1")];
    const edges = [makeEdge("x-e", "x1", "x2")];
    useDiagramStore.getState().setNodes(nodes);
    useDiagramStore.getState().setEdges(edges);

    const s = useDiagramStore.getState();
    expect(s.nodes).toEqual(nodes);
    expect(s.edges).toEqual(edges);
    expect(s.dirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe("selection", () => {
  it("setSelectedNode sets node and clears edge", () => {
    useDiagramStore.setState({ selectedEdgeId: "e1" });
    useDiagramStore.getState().setSelectedNode("n1");

    const s = useDiagramStore.getState();
    expect(s.selectedNodeId).toBe("n1");
    expect(s.selectedEdgeId).toBeNull();
  });

  it("setSelectedEdge sets edge and clears node", () => {
    useDiagramStore.setState({ selectedNodeId: "n1" });
    useDiagramStore.getState().setSelectedEdge("e1");

    const s = useDiagramStore.getState();
    expect(s.selectedEdgeId).toBe("e1");
    expect(s.selectedNodeId).toBeNull();
  });

  it("setSelectedNode(null) deselects", () => {
    useDiagramStore.setState({ selectedNodeId: "n1" });
    useDiagramStore.getState().setSelectedNode(null);
    expect(useDiagramStore.getState().selectedNodeId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe("metadata", () => {
  it("setTitle updates title and marks dirty", () => {
    useDiagramStore.getState().setTitle("New Title");
    const s = useDiagramStore.getState();
    expect(s.title).toBe("New Title");
    expect(s.dirty).toBe(true);
  });

  it("setDescription updates description and marks dirty", () => {
    useDiagramStore.getState().setDescription("New Desc");
    const s = useDiagramStore.getState();
    expect(s.description).toBe("New Desc");
    expect(s.dirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Save status
// ---------------------------------------------------------------------------

describe("save status", () => {
  it("markSaving sets saving: true and clears saveError", () => {
    useDiagramStore.setState({ saveError: "old error" });
    useDiagramStore.getState().markSaving();

    const s = useDiagramStore.getState();
    expect(s.saving).toBe(true);
    expect(s.saveError).toBeNull();
  });

  it("markSaved clears dirty/saving, records lastSavedAt", () => {
    useDiagramStore.setState({ dirty: true, saving: true });
    const before = Date.now();
    useDiagramStore.getState().markSaved();
    const after = Date.now();

    const s = useDiagramStore.getState();
    expect(s.saving).toBe(false);
    expect(s.dirty).toBe(false);
    expect(s.saveError).toBeNull();
    expect(s.lastSavedAt).toBeGreaterThanOrEqual(before);
    expect(s.lastSavedAt).toBeLessThanOrEqual(after);
  });

  it("markSaveError records error and clears saving", () => {
    useDiagramStore.setState({ saving: true });
    useDiagramStore.getState().markSaveError("Network error");

    const s = useDiagramStore.getState();
    expect(s.saving).toBe(false);
    expect(s.saveError).toBe("Network error");
  });

  it("markDirty sets dirty: true", () => {
    useDiagramStore.getState().markDirty();
    expect(useDiagramStore.getState().dirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Undo / Redo
// ---------------------------------------------------------------------------

describe("undo/redo", () => {
  it("pushHistory adds snapshot to undoStack and clears redoStack", () => {
    useDiagramStore.setState({
      nodes: [makeNode("n1")],
      redoStack: [{ nodes: [], edges: [] }],
    });
    useDiagramStore.getState().pushHistory();

    const s = useDiagramStore.getState();
    expect(s.undoStack).toHaveLength(1);
    expect(s.undoStack[0].nodes).toHaveLength(1);
    expect(s.redoStack).toHaveLength(0);
  });

  it("pushHistory caps undoStack at 50 entries", () => {
    const fakeHistory = Array.from({ length: 50 }, () => ({
      nodes: [],
      edges: [],
    }));
    useDiagramStore.setState({
      undoStack: fakeHistory,
      nodes: [makeNode("n1")],
    });
    useDiagramStore.getState().pushHistory();

    expect(useDiagramStore.getState().undoStack).toHaveLength(50);
  });

  it("undo restores last entry and pushes current to redoStack", () => {
    const prevNode = makeNode("prev");
    useDiagramStore.setState({
      nodes: [makeNode("current")],
      edges: [],
      undoStack: [{ nodes: [prevNode], edges: [] }],
    });

    useDiagramStore.getState().undo();

    const s = useDiagramStore.getState();
    expect(s.nodes).toHaveLength(1);
    expect(s.nodes[0].id).toBe("prev");
    expect(s.undoStack).toHaveLength(0);
    expect(s.redoStack).toHaveLength(1);
    expect(s.dirty).toBe(true);
  });

  it("undo is a no-op when undoStack is empty", () => {
    useDiagramStore.setState({ nodes: [makeNode("n1")] });
    useDiagramStore.getState().undo();

    expect(useDiagramStore.getState().nodes).toHaveLength(1);
    expect(useDiagramStore.getState().nodes[0].id).toBe("n1");
  });

  it("redo restores last undone entry and pushes current to undoStack", () => {
    const redoNode = makeNode("redo");
    useDiagramStore.setState({
      nodes: [makeNode("current")],
      edges: [],
      redoStack: [{ nodes: [redoNode], edges: [] }],
    });

    useDiagramStore.getState().redo();

    const s = useDiagramStore.getState();
    expect(s.nodes[0].id).toBe("redo");
    expect(s.redoStack).toHaveLength(0);
    expect(s.undoStack).toHaveLength(1);
    expect(s.dirty).toBe(true);
  });

  it("redo is a no-op when redoStack is empty", () => {
    useDiagramStore.setState({ nodes: [makeNode("n1")] });
    useDiagramStore.getState().redo();

    expect(useDiagramStore.getState().nodes[0].id).toBe("n1");
  });

  it("full cycle: push -> undo -> redo restores original state", () => {
    const original = [makeNode("orig")];
    useDiagramStore.setState({ nodes: original, edges: [] });
    useDiagramStore.getState().pushHistory();

    useDiagramStore.setState({ nodes: [makeNode("modified")] });

    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().nodes[0].id).toBe("orig");

    useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().nodes[0].id).toBe("modified");
  });
});

// ---------------------------------------------------------------------------
// React Flow callbacks
// ---------------------------------------------------------------------------

describe("onNodesChange", () => {
  it("pushes history on structural change (remove)", () => {
    useDiagramStore.setState({ nodes: [makeNode("n1")] });
    useDiagramStore.getState().onNodesChange([{ type: "remove", id: "n1" }]);

    expect(useDiagramStore.getState().undoStack).toHaveLength(1);
    expect(useDiagramStore.getState().dirty).toBe(true);
  });

  it("does not push history on non-structural change (position)", () => {
    useDiagramStore.setState({ nodes: [makeNode("n1")] });
    useDiagramStore
      .getState()
      .onNodesChange([
        { type: "position", id: "n1", position: { x: 50, y: 50 } } as any,
      ]);

    expect(useDiagramStore.getState().undoStack).toHaveLength(0);
    expect(useDiagramStore.getState().dirty).toBe(true);
  });
});

describe("onEdgesChange", () => {
  it("pushes history on structural change (remove)", () => {
    useDiagramStore.setState({ edges: [makeEdge("e1", "n1", "n2")] });
    useDiagramStore.getState().onEdgesChange([{ type: "remove", id: "e1" }]);

    expect(useDiagramStore.getState().undoStack).toHaveLength(1);
  });
});

describe("onConnect", () => {
  it("creates a cf-edge with data.edgeType data-flow and pushes history", () => {
    useDiagramStore.getState().onConnect({
      source: "n1",
      target: "n2",
      sourceHandle: null,
      targetHandle: null,
    });

    const s = useDiagramStore.getState();
    expect(s.edges).toHaveLength(1);
    expect(s.edges[0].type).toBe("cf-edge");
    expect(s.edges[0].data?.edgeType).toBe("data-flow");
    expect(s.undoStack).toHaveLength(1);
    expect(s.dirty).toBe(true);
  });
});

describe("onViewportChange", () => {
  it("updates viewport without marking dirty", () => {
    useDiagramStore.getState().onViewportChange({ x: 100, y: 200, zoom: 3 });

    const s = useDiagramStore.getState();
    expect(s.viewport).toEqual({ x: 100, y: 200, zoom: 3 });
    expect(s.dirty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Print mode
// ---------------------------------------------------------------------------

describe("printMode", () => {
  it("defaults to false", () => {
    expect(useDiagramStore.getState().printMode).toBe(false);
  });

  it("setPrintMode(true) enables print mode", () => {
    useDiagramStore.getState().setPrintMode(true);
    expect(useDiagramStore.getState().printMode).toBe(true);
  });

  it("setPrintMode(false) disables print mode", () => {
    useDiagramStore.setState({ printMode: true });
    useDiagramStore.getState().setPrintMode(false);
    expect(useDiagramStore.getState().printMode).toBe(false);
  });
});
