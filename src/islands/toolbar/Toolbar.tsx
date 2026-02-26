import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useDiagramStore } from "../store/diagramStore";
import type { CFNodeData } from "../types";
import { NODE_TYPE_MAP } from "../../lib/catalog";
import { fetchApi, ShareResponseSchema } from "../../lib/validation";
import { ExportButton } from "./ExportButton";

/**
 * Top toolbar with diagram title input, undo/redo buttons, zoom controls,
 * auto-layout button (ELK), export button, and share button.
 * In read-only mode only the logo, title, and export button are shown.
 */
export function Toolbar({ readOnly = false }: { readOnly?: boolean }) {
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
            NODE_TYPE_MAP.get((node.data as unknown as CFNodeData).typeId)
              ?.defaultHandles ?? []
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

      setTimeout(() => void fitView({ duration: 300 }), 50);
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
        {readOnly ? (
          <span className="toolbar-title-readonly">{title}</span>
        ) : (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="toolbar-title"
            placeholder="Untitled Diagram"
          />
        )}
      </div>

      {!readOnly && (
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
          <button
            onClick={() => void zoomIn()}
            className="toolbar-btn"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => void zoomOut()}
            className="toolbar-btn"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={() => void fitView({ duration: 300 })}
            className="toolbar-btn"
            title="Fit View"
          >
            ⊞
          </button>
          <div className="toolbar-separator" />
          <button
            onClick={() => void applyAutoLayout()}
            disabled={layouting}
            className="toolbar-btn"
            title="Auto Layout (ELK)"
          >
            {layouting ? "..." : "⚡ Layout"}
          </button>
        </div>
      )}

      <div className="toolbar-right">
        <ExportButton />
        {!readOnly && <ShareButton />}
      </div>
    </div>
  );
}

/**
 * Internal component that POSTs to the share API, displays a modal with the
 * share URL, inline copy icon, open-in-tab/window dropdown, and auto-copy
 * with toast feedback.
 */
function ShareButton() {
  const { diagramId } = useDiagramStore();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const triggerToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setShowToast(true);
    toastTimer.current = setTimeout(() => setShowToast(false), 2000);
  }, []);

  const copyToClipboard = useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        triggerToast();
      } catch {
        /* clipboard may be unavailable in insecure contexts */
      }
    },
    [triggerToast],
  );

  const handleShare = async () => {
    if (!diagramId) return;
    try {
      const result = await fetchApi(
        `/api/v1/diagrams/${diagramId}/share`,
        ShareResponseSchema,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (result.ok) {
        setShareUrl(result.data.url);
        setShowModal(true);
        void copyToClipboard(result.data.url);
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  const openInNewTab = () => {
    if (shareUrl) window.open(shareUrl, "_blank");
    setShowDropdown(false);
  };

  const openInNewWindow = () => {
    if (shareUrl) window.open(shareUrl, "_blank", "width=1024,height=768");
    setShowDropdown(false);
  };

  return (
    <>
      <button
        onClick={() => void handleShare()}
        className="toolbar-btn toolbar-btn-primary"
        title="Share"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>

      {showToast && <div className="toast">URL Copied!</div>}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-x"
              onClick={() => setShowModal(false)}
              title="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h3 className="modal-title">Share Diagram</h3>
            <p className="modal-text">
              Anyone with this link can view your diagram (read-only):
            </p>
            <div className="share-url-field">
              <input
                type="text"
                value={shareUrl ?? ""}
                readOnly
                className="share-url-input"
              />
              <button
                className="share-copy-btn"
                onClick={() => void copyToClipboard(shareUrl ?? "")}
                title="Copy URL"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
            <div className="share-open-group" ref={dropdownRef}>
              <button className="share-open-btn" onClick={openInNewTab}>
                Open
              </button>
              <button
                className="share-open-chevron"
                onClick={() => setShowDropdown((prev) => !prev)}
                title="Open options"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showDropdown && (
                <div className="share-open-dropdown">
                  <button className="share-open-option" onClick={openInNewTab}>
                    Open in new tab
                  </button>
                  <button
                    className="share-open-option"
                    onClick={openInNewWindow}
                  >
                    Open in new window
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
