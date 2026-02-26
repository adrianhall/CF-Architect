import { useCallback, useEffect, useRef, useState } from "react";
import {
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
} from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";
import { useDiagramStore } from "../store/diagramStore";
import {
  generateExportFilename,
  triggerDownload,
  type ExportFormat,
} from "../../lib/export";

const IMAGE_PADDING = 50;
const MIN_DIMENSION = 400;

/**
 * Toolbar button with a two-option dropdown (PNG / SVG).
 * Captures the React Flow viewport via html-to-image,
 * fitting all nodes into the exported image.
 */
export function ExportButton() {
  const { getNodes } = useReactFlow();
  const title = useDiagramStore((s) => s.title);
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setOpen(false);
      const nodes = getNodes();
      if (nodes.length === 0) return;

      setExporting(true);
      try {
        const bounds = getNodesBounds(nodes);
        const width = Math.max(bounds.width + IMAGE_PADDING * 2, MIN_DIMENSION);
        const height = Math.max(
          bounds.height + IMAGE_PADDING * 2,
          MIN_DIMENSION,
        );
        const viewport = getViewportForBounds(
          bounds,
          width,
          height,
          0.5,
          2,
          0.25,
        );

        const viewportEl = document.querySelector<HTMLElement>(
          ".react-flow__viewport",
        );
        if (!viewportEl) return;

        const capture = format === "png" ? toPng : toSvg;
        const dataUrl = await capture(viewportEl, {
          backgroundColor: "#ffffff",
          width,
          height,
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          },
        });

        triggerDownload(dataUrl, generateExportFilename(title, format));
      } catch (err) {
        console.error("Export failed:", err);
      } finally {
        setExporting(false);
      }
    },
    [getNodes, title],
  );

  return (
    <div className="export-btn-wrapper" ref={wrapperRef}>
      <button
        className="toolbar-btn"
        title="Export"
        disabled={exporting}
        onClick={() => setOpen((prev) => !prev)}
      >
        {exporting ? (
          "..."
        ) : (
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
      </button>

      {open && (
        <div className="export-dropdown">
          <button
            className="export-dropdown-option"
            onClick={() => void handleExport("png")}
          >
            Export as PNG
          </button>
          <button
            className="export-dropdown-option"
            onClick={() => void handleExport("svg")}
          >
            Export as SVG
          </button>
        </div>
      )}
    </div>
  );
}
