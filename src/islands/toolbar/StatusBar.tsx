import { useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useDiagramStore } from "../store/diagramStore";

/**
 * Converts a unix timestamp to a relative time string (e.g. "just now", "5s ago", "2m ago").
 *
 * @param ts - Unix timestamp in milliseconds
 * @returns Relative time string
 */
function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

/**
 * Bottom bar showing node/edge count, zoom percentage, and save status.
 * Polls zoom level every second.
 *
 * @param props.readOnly - Whether the diagram is in read-only mode
 */
export function StatusBar({ readOnly }: { readOnly: boolean }) {
  const { saving, dirty, lastSavedAt, saveError, nodes, edges } =
    useDiagramStore();
  const { getZoom } = useReactFlow();
  const [zoom, setZoom] = useState(100);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setZoom(Math.round(getZoom() * 100));
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [getZoom]);

  let saveStatus = "";
  if (readOnly) {
    saveStatus = "Read-only";
  } else if (saving) {
    saveStatus = "Saving...";
  } else if (saveError) {
    saveStatus = `Error: ${saveError}`;
  } else if (dirty) {
    saveStatus = "Unsaved changes";
  } else if (lastSavedAt) {
    saveStatus = `Saved ${timeAgo(lastSavedAt)}`;
  } else {
    saveStatus = "No changes";
  }

  return (
    <div className="status-bar">
      <span className="status-item">
        {nodes.length} nodes, {edges.length} edges
      </span>
      <span className="status-item">Zoom: {zoom}%</span>
      <span
        className={`status-item ${saveError ? "status-error" : ""} ${dirty && !saving ? "status-dirty" : ""}`}
      >
        {saveStatus}
      </span>
    </div>
  );
}
