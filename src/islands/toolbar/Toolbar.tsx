import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useDiagramStore } from "../store/diagramStore";
import type { CFNodeData } from "../types";
import { NODE_TYPE_MAP } from "../../lib/catalog";

/**
 * Top toolbar with diagram title input, undo/redo buttons, zoom controls,
 * auto-layout button (ELK), and share button.
 */
export function Toolbar() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { undo, redo, undoStack, redoStack, title, setTitle } =
    useDiagramStore();
  const [layouting, setLayouting] = useState(false);

  /**
   * Dynamically imports ELK, builds a layered graph description from current
   * nodes/edges, runs layout, applies computed positions, and fits the viewport.
   * Pushes history before applying.
   */
  const applyAutoLayout = useCallback(async () => {
    setLayouting(true);
    try {
      const ELK = (await import("elkjs/lib/elk.bundled.js")).default;
      const elk = new ELK();

      const state = useDiagramStore.getState();
      const nodeWidth = 200;
      const nodeHeight = 80;

      const graph = {
        id: "root",
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": "DOWN",
          "elk.spacing.nodeNode": "60",
          "elk.layered.spacing.nodeNodeBetweenLayers": "80",
          "elk.edgeRouting": "ORTHOGONAL",
        },
        children: state.nodes.map((node) => ({
          id: node.id,
          width: nodeWidth,
          height: nodeHeight,
          ports: (
            NODE_TYPE_MAP.get(
              (node.data as unknown as CFNodeData).typeId,
            )?.defaultHandles ?? []
          ).map((h) => ({
            id: `${node.id}-${h.id}`,
            properties: {
              "port.side": h.position.toUpperCase(),
            },
          })),
        })),
        edges: state.edges.map((edge) => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      };

      const layout = await elk.layout(graph);

      if (layout.children) {
        const newNodes = state.nodes.map((node) => {
          const lNode = layout.children!.find((n) => n.id === node.id);
          if (lNode) {
            return {
              ...node,
              position: { x: lNode.x ?? 0, y: lNode.y ?? 0 },
            };
          }
          return node;
        });
        useDiagramStore.getState().pushHistory();
        useDiagramStore.getState().setNodes(newNodes);
      }

      setTimeout(() => fitView({ duration: 300 }), 50);
    } catch (err) {
      console.error("Auto-layout failed:", err);
    } finally {
      setLayouting(false);
    }
  }, [fitView]);

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <a href="/dashboard" className="toolbar-logo" title="Back to Dashboard">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#F6821F" />
            <text
              x="14"
              y="19"
              textAnchor="middle"
              fill="white"
              fontSize="14"
              fontWeight="bold"
              fontFamily="Inter, sans-serif"
            >
              CF
            </text>
          </svg>
        </a>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="toolbar-title"
          placeholder="Untitled Diagram"
        />
      </div>

      <div className="toolbar-center">
        <button
          onClick={undo}
          disabled={undoStack.length === 0}
          className="toolbar-btn"
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={redoStack.length === 0}
          className="toolbar-btn"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
        <div className="toolbar-separator" />
        <button onClick={() => zoomIn()} className="toolbar-btn" title="Zoom In">
          +
        </button>
        <button onClick={() => zoomOut()} className="toolbar-btn" title="Zoom Out">
          −
        </button>
        <button
          onClick={() => fitView({ duration: 300 })}
          className="toolbar-btn"
          title="Fit View"
        >
          ⊞
        </button>
        <div className="toolbar-separator" />
        <button
          onClick={applyAutoLayout}
          disabled={layouting}
          className="toolbar-btn"
          title="Auto Layout (ELK)"
        >
          {layouting ? "..." : "⚡ Layout"}
        </button>
      </div>

      <div className="toolbar-right">
        <ShareButton />
      </div>
    </div>
  );
}

/**
 * Internal component that POSTs to the share API, displays a modal with the
 * share URL and copy-to-clipboard.
 */
function ShareButton() {
  const { diagramId } = useDiagramStore();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [copying, setCopying] = useState(false);

  /** POSTs to the share API and opens the modal with the share URL. */
  const handleShare = async () => {
    if (!diagramId) return;
    try {
      const res = await fetch(`/api/v1/diagrams/${diagramId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        setShareUrl(data.data.url);
        setShowModal(true);
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  /** Copies the share URL to the clipboard and shows "Copied!" feedback. */
  const copyToClipboard = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  return (
    <>
      <button onClick={handleShare} className="toolbar-btn toolbar-btn-primary">
        Share
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Share Diagram</h3>
            <p className="modal-text">
              Anyone with this link can view your diagram (read-only):
            </p>
            <div className="share-url-row">
              <input
                type="text"
                value={shareUrl ?? ""}
                readOnly
                className="share-url-input"
              />
              <button onClick={copyToClipboard} className="toolbar-btn toolbar-btn-primary">
                {copying ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="modal-close"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
