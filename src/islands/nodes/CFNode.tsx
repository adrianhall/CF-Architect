import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_TYPE_MAP, CATEGORY_COLORS } from "../../lib/catalog";
import type { CFNodeData } from "../types";

function CFNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CFNodeData;
  const typeDef = NODE_TYPE_MAP.get(nodeData.typeId);
  const category = typeDef?.category ?? "external";
  const accentColor =
    nodeData.style?.accentColor ?? CATEGORY_COLORS[category] ?? "#6B7280";
  const handles = typeDef?.defaultHandles ?? [];

  return (
    <div
      className="cf-node"
      style={{
        borderColor: selected ? accentColor : `${accentColor}66`,
        boxShadow: selected ? `0 0 0 2px ${accentColor}44` : "none",
      }}
    >
      <div className="cf-node-header" style={{ backgroundColor: `${accentColor}14` }}>
        <img
          src={typeDef?.iconPath ?? "/icons/worker.svg"}
          alt=""
          className="cf-node-icon"
          width={24}
          height={24}
        />
        <span className="cf-node-label" title={nodeData.label}>
          {nodeData.label}
        </span>
      </div>

      {nodeData.description && (
        <div className="cf-node-description">{nodeData.description}</div>
      )}

      {handles.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type={h.type}
          position={
            h.position === "top"
              ? Position.Top
              : h.position === "bottom"
                ? Position.Bottom
                : h.position === "left"
                  ? Position.Left
                  : Position.Right
          }
          style={{ background: accentColor }}
        />
      ))}
    </div>
  );
}

export const CFNode = memo(CFNodeComponent);
