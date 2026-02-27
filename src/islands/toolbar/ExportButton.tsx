import { useCallback, useEffect, useRef, useState } from "react";
import {
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
} from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";
import { zipSync, strToU8 } from "fflate";
import { useDiagramStore } from "../store/diagramStore";
import { generateExportFilename, triggerDownload } from "../../lib/export";
import { generateScaffold } from "../../lib/scaffold";
import { NODE_TYPE_MAP } from "../../lib/catalog";
import type { CFNodeData } from "../types";

const IMAGE_PADDING = 50;
const MIN_DIMENSION = 400;

/**
 * Toolbar button with a three-option dropdown (PNG / SVG / Project).
 * PNG and SVG capture the React Flow viewport via html-to-image.
 * Project generates a scaffold ZIP via fflate.
 */
export function ExportButton() {
  const { getNodes } = useReactFlow();
  const title = useDiagramStore((s) => s.title);
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const hasCloudflareNodes = nodes.some((n) => {
    const data = n.data as unknown as CFNodeData;
    const def = NODE_TYPE_MAP.get(data.typeId);
    return def?.wranglerBinding != null;
  });

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

  const handleImageExport = useCallback(
    async (format: "png" | "svg") => {
      setOpen(false);
      const flowNodes = getNodes();
      if (flowNodes.length === 0) return;

      setExporting(true);
      try {
        const bounds = getNodesBounds(flowNodes);
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

  const handleProjectExport = useCallback(() => {
    setOpen(false);
    setExporting(true);
    try {
      const scaffoldNodes = nodes.map((n) => {
        const data = n.data as unknown as CFNodeData;
        return { typeId: data.typeId, label: data.label };
      });

      const scaffoldEdges = edges.map((e) => ({
        source: e.source,
        target: e.target,
        edgeType: (e.data as Record<string, unknown> | undefined)?.edgeType as
          | string
          | undefined,
      }));

      const files = generateScaffold({
        title,
        nodes: scaffoldNodes,
        edges: scaffoldEdges,
      });

      if (files.size === 0) return;

      const zipData: Record<string, Uint8Array> = {};
      for (const [path, content] of files) {
        zipData[path] = strToU8(content);
      }

      const zipped = zipSync(zipData);

      const blob = new Blob([zipped.buffer as ArrayBuffer], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, generateExportFilename(title, "zip"));
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [nodes, edges, title]);

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
            onClick={() => void handleImageExport("png")}
          >
            Export as PNG
          </button>
          <button
            className="export-dropdown-option"
            onClick={() => void handleImageExport("svg")}
          >
            Export as SVG
          </button>
          <button
            className="export-dropdown-option"
            disabled={!hasCloudflareNodes}
            title={
              hasCloudflareNodes
                ? undefined
                : "Add Cloudflare services to export a project"
            }
            onClick={handleProjectExport}
          >
            Export as Project
          </button>
        </div>
      )}
    </div>
  );
}
