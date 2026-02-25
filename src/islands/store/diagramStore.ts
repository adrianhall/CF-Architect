import { create } from "zustand";
import {
  type Node,
  type Edge,
  type Viewport,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import type { CFNodeData, CFEdgeData } from "../types";

interface HistoryEntry {
  nodes: Node<CFNodeData>[];
  edges: Edge<CFEdgeData>[];
}

interface DiagramState {
  diagramId: string | null;
  title: string;
  description: string;

  nodes: Node<CFNodeData>[];
  edges: Edge<CFEdgeData>[];
  viewport: Viewport;

  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  dirty: boolean;
  saving: boolean;
  lastSavedAt: number | null;
  saveError: string | null;

  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
}

interface DiagramActions {
  setDiagram: (
    id: string,
    title: string,
    description: string,
    nodes: Node<CFNodeData>[],
    edges: Edge<CFEdgeData>[],
    viewport: Viewport,
  ) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onViewportChange: (viewport: Viewport) => void;
  addNode: (node: Node<CFNodeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<CFNodeData>) => void;
  updateEdgeData: (edgeId: string, data: Partial<CFEdgeData>) => void;
  removeSelected: () => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setNodes: (nodes: Node<CFNodeData>[]) => void;
  setEdges: (edges: Edge<CFEdgeData>[]) => void;
  markSaving: () => void;
  markSaved: () => void;
  markSaveError: (error: string) => void;
  markDirty: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

const MAX_HISTORY = 50;

export type DiagramStore = DiagramState & DiagramActions;

export const useDiagramStore = create<DiagramStore>((set, get) => ({
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

  setDiagram: (id, title, description, nodes, edges, viewport) =>
    set({
      diagramId: id,
      title,
      description: description ?? "",
      nodes,
      edges,
      viewport,
      dirty: false,
      undoStack: [],
      redoStack: [],
    }),

  onNodesChange: (changes: NodeChange[]) => {
    const hasStructuralChange = changes.some(
      (c) => c.type === "remove" || c.type === "add",
    );
    if (hasStructuralChange) get().pushHistory();

    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as Node<CFNodeData>[],
      dirty: true,
    }));
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    const hasStructuralChange = changes.some(
      (c) => c.type === "remove" || c.type === "add",
    );
    if (hasStructuralChange) get().pushHistory();

    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges) as Edge<CFEdgeData>[],
      dirty: true,
    }));
  },

  onConnect: (connection: Connection) => {
    get().pushHistory();
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          type: "cf-edge",
          data: { edgeType: "data-flow" as const },
        },
        state.edges,
      ) as Edge<CFEdgeData>[],
      dirty: true,
    }));
  },

  onViewportChange: (viewport) => set({ viewport }),

  addNode: (node) => {
    get().pushHistory();
    set((state) => ({
      nodes: [...state.nodes, node],
      dirty: true,
    }));
  },

  updateNodeData: (nodeId, data) => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
      ),
      dirty: true,
    }));
  },

  updateEdgeData: (edgeId, data) => {
    get().pushHistory();
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...data } as CFEdgeData } : e,
      ),
      dirty: true,
    }));
  },

  removeSelected: () => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.filter((n) => !n.selected),
      edges: state.edges.filter((e) => !e.selected),
      selectedNodeId: null,
      selectedEdgeId: null,
      dirty: true,
    }));
  },

  setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  setTitle: (title) => set({ title, dirty: true }),
  setDescription: (description) => set({ description, dirty: true }),

  setNodes: (nodes) => set({ nodes, dirty: true }),
  setEdges: (edges) => set({ edges, dirty: true }),

  markSaving: () => set({ saving: true, saveError: null }),
  markSaved: () =>
    set({ saving: false, dirty: false, lastSavedAt: Date.now(), saveError: null }),
  markSaveError: (error) => set({ saving: false, saveError: error }),
  markDirty: () => set({ dirty: true }),

  pushHistory: () =>
    set((state) => ({
      undoStack: [
        ...state.undoStack.slice(-(MAX_HISTORY - 1)),
        { nodes: structuredClone(state.nodes), edges: structuredClone(state.edges) },
      ],
      redoStack: [],
    })),

  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [
          ...state.redoStack,
          { nodes: structuredClone(state.nodes), edges: structuredClone(state.edges) },
        ],
        nodes: prev.nodes,
        edges: prev.edges,
        dirty: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [
          ...state.undoStack,
          { nodes: structuredClone(state.nodes), edges: structuredClone(state.edges) },
        ],
        nodes: next.nodes,
        edges: next.edges,
        dirty: true,
      };
    }),
}));
