import { useCallback, useRef, useState } from "react";
import { useDiagramStore } from "../store/diagramStore";

/**
 * Builds the blueprint-compatible JSON string from the current diagram state.
 * Mirrors the shape produced by `buildGraphData` in `src/lib/blueprints.ts`.
 */
export function buildBlueprintJson(
  nodes: ReturnType<typeof useDiagramStore.getState>["nodes"],
  edges: ReturnType<typeof useDiagramStore.getState>["edges"],
  viewport: ReturnType<typeof useDiagramStore.getState>["viewport"],
): string {
  return JSON.stringify({ nodes, edges, viewport }, null, 2);
}

/**
 * Icon button (placed in the status bar) that opens a modal displaying the
 * current diagram's JSON representation, ready for copy-paste into blueprints.
 */
export function ShowJsonButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const json = useDiagramStore((s) =>
    buildBlueprintJson(s.nodes, s.edges, s.viewport),
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable in insecure contexts */
    }
  }, [json]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) setOpen(false);
  }, []);

  return (
    <>
      <button
        className="status-bar-btn"
        title="Show JSON"
        onClick={() => setOpen(true)}
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
          aria-hidden="true"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </button>

      {open && (
        <div
          className="modal-overlay"
          ref={overlayRef}
          onClick={handleOverlayClick}
          data-testid="json-modal"
        >
          <div className="modal json-modal">
            <button
              className="modal-close-x"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              &times;
            </button>

            <h2 className="modal-title">Diagram JSON</h2>
            <p className="modal-text">
              Copy this JSON to use as a blueprint template.
            </p>

            <pre className="json-code-block" data-testid="json-output">
              <code>{json}</code>
            </pre>

            <div className="json-modal-actions">
              <button
                className="toolbar-btn toolbar-btn-primary"
                onClick={() => void handleCopy()}
              >
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button className="toolbar-btn" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
