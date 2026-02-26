import {
  useCallback,
  useEffect,
  useRef,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  BackgroundVariant,
  type Node,
  type Edge,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes/nodeTypes";
import { edgeTypes } from "./edges/edgeTypes";
import { useDiagramStore } from "./store/diagramStore";
import { NODE_TYPE_MAP, CATEGORY_COLORS } from "../lib/catalog";
import type { CFNodeData, CFEdgeData } from "./types";
import { ServicePalette } from "./panels/ServicePalette";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import { Toolbar } from "./toolbar/Toolbar";
import { StatusBar } from "./toolbar/StatusBar";
import {
  fetchApi,
  DiagramResponseSchema,
  GraphDataSchema,
} from "../lib/validation";

/**
 * Props for the DiagramCanvas component.
 *
 * @property diagramId - Unique identifier for the diagram
 * @property readOnly - If true, hides editing UI and disables modifications
 * @property initialData - Optional pre-loaded data (title, description, graphData) to avoid API fetch
 */
interface DiagramCanvasProps {
  diagramId: string;
  readOnly?: boolean;
  initialData?: {
    title: string;
    description: string;
    graphData: string;
  };
}

/**
 * Main editor component. Loads diagram data on mount (from initialData or via API
 * fetch), sets up autosave (500ms debounce), beforeunload guard, title save,
 * drag-and-drop from palette, keyboard shortcuts (Delete, Ctrl+Z, Ctrl+Shift+Z),
 * and renders the full editor layout (Toolbar, ServicePalette, ReactFlow,
 * PropertiesPanel, StatusBar). Conditional read-only mode hides editing UI.
 */
export default function DiagramCanvas({
  diagramId,
  readOnly = false,
  initialData,
}: DiagramCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onViewportChange,
    setDiagram,
    addNode,
    removeSelected,
    setSelectedNode,
    setSelectedEdge,
    undo,
    redo,
    dirty,
    markSaving,
    markSaved,
    markSaveError,
    title,
  } = useDiagramStore();

  useEffect(() => {
    if (initialData) {
      const parsed = GraphDataSchema.parse(
        JSON.parse(initialData.graphData || "{}") as unknown,
      );
      setDiagram(
        diagramId,
        initialData.title,
        initialData.description ?? "",
        parsed.nodes as Node<CFNodeData>[],
        parsed.edges as Edge<CFEdgeData>[],
        parsed.viewport,
      );
      return;
    }

    fetchApi(`/api/v1/diagrams/${diagramId}`, DiagramResponseSchema)
      .then((res) => {
        if (res.ok) {
          const d = res.data;
          const parsed = GraphDataSchema.parse(
            JSON.parse(d.graphData || "{}") as unknown,
          );
          setDiagram(
            diagramId,
            d.title,
            d.description ?? "",
            parsed.nodes as Node<CFNodeData>[],
            parsed.edges as Edge<CFEdgeData>[],
            parsed.viewport,
          );
        }
      })
      .catch(console.error);
  }, [diagramId, initialData, setDiagram]);

  // Autosave
  useEffect(() => {
    if (readOnly || !dirty) return;

    const timer = setTimeout(() => {
      void (async () => {
        markSaving();
        try {
          const state = useDiagramStore.getState();
          const graphData = JSON.stringify({
            nodes: state.nodes,
            edges: state.edges,
            viewport: state.viewport,
          });

          const res = await fetch(`/api/v1/diagrams/${diagramId}/graph`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ graphData }),
          });

          if (res.ok) {
            markSaved();
          } else {
            markSaveError("Failed to save");
          }
        } catch {
          markSaveError("Network error");
        }
      })();
    }, 500);

    return () => clearTimeout(timer);
  }, [dirty, readOnly, diagramId, markSaving, markSaved, markSaveError]);

  // Beforeunload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useDiagramStore.getState().dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Save title changes
  useEffect(() => {
    if (readOnly || !useDiagramStore.getState().diagramId) return;
    const timer = setTimeout(() => {
      void fetch(`/api/v1/diagrams/${diagramId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, readOnly, diagramId]);

  /** Allows drop by preventing default and setting dropEffect to "move". */
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  /** Handles drop from palette: reads typeId, creates node at drop position. */
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const typeId = event.dataTransfer.getData("application/cf-node-type");
      if (!typeId) return;

      const typeDef = NODE_TYPE_MAP.get(typeId);
      if (!typeDef) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node<CFNodeData> = {
        id: `${typeId}-${Date.now()}`,
        type: "cf-node",
        position,
        data: {
          typeId,
          label: typeDef.label,
          description: "",
        },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode],
  );

  /** Selects the clicked node. */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode],
  );

  /** Selects the clicked edge. */
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      setSelectedEdge(edge.id);
    },
    [setSelectedEdge],
  );

  /** Clears selection when clicking on empty pane. */
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [setSelectedNode, setSelectedEdge]);

  /** Handles Delete/Backspace, Ctrl+Z (undo), Ctrl+Shift+Z (redo). */
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (readOnly) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        removeSelected();
      }
      if (event.ctrlKey && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if (event.ctrlKey && event.shiftKey && event.key === "Z") {
        event.preventDefault();
        redo();
      }
    },
    [readOnly, removeSelected, undo, redo],
  );

  return (
    <div className="diagram-editor" onKeyDown={onKeyDown} tabIndex={0}>
      {!readOnly && <Toolbar />}
      <div className="diagram-editor-body">
        {!readOnly && <ServicePalette />}
        <div className="diagram-canvas-wrapper" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={readOnly ? undefined : onNodesChange}
            onEdgesChange={readOnly ? undefined : onEdgesChange}
            onConnect={readOnly ? undefined : onConnect}
            onViewportChange={onViewportChange}
            onDragOver={readOnly ? undefined : onDragOver}
            onDrop={readOnly ? undefined : onDrop}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={true}
            deleteKeyCode={null}
            defaultEdgeOptions={{ type: "cf-edge" }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <MiniMap
              nodeColor={(node) => {
                const data = node.data as CFNodeData;
                const typeDef = NODE_TYPE_MAP.get(data?.typeId);
                return (
                  CATEGORY_COLORS[typeDef?.category ?? "external"] ?? "#6B7280"
                );
              }}
              style={{ backgroundColor: "var(--color-surface-alt)" }}
            />
            <Controls showInteractive={!readOnly} />
          </ReactFlow>
        </div>
        {!readOnly && <PropertiesPanel />}
      </div>
      <StatusBar readOnly={readOnly} />
    </div>
  );
}
