import { memo } from "react";
import {
  BaseEdge,
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";
import { EDGE_TYPE_MAP } from "../../lib/catalog";
import type { CFEdgeData } from "../types";

/**
 * Renders edges between nodes with four visual styles based on `data.edgeType`:
 * solid animated (data-flow), dashed (service-binding), dotted (trigger),
 * thin gray (external). Uses smooth step path with SVG arrow markers.
 * Shows optional label at midpoint.
 */
function CFEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as unknown as CFEdgeData | undefined;
  const edgeType = edgeData?.edgeType ?? "data-flow";
  const typeDef = EDGE_TYPE_MAP.get(edgeType);

  const color = selected ? "#F6821F" : (typeDef?.color ?? "#9CA3AF");
  const animated = typeDef?.animated ?? false;

  let strokeDasharray: string | undefined;
  if (typeDef?.style === "dashed") strokeDasharray = "8 4";
  else if (typeDef?.style === "dotted") strokeDasharray = "3 3";

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const markerEnd = typeDef?.markerEnd ? `url(#arrow-${edgeType})` : undefined;

  return (
    <>
      <defs>
        <marker
          id={`arrow-${edgeType}`}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray,
        }}
        markerEnd={markerEnd}
        className={animated ? "react-flow__edge-animated" : ""}
      />
      {edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            className="cf-edge-label"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/** Memoised export of CFEdgeComponent for React Flow's edgeTypes registry. */
export const CFEdge = memo(CFEdgeComponent);
