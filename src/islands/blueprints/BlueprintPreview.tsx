import { useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "../nodes/nodeTypes";
import { edgeTypes } from "../edges/edgeTypes";

interface BlueprintPreviewProps {
  graphData: string;
  height?: number;
}

function PreviewInner({ graphData, height = 200 }: BlueprintPreviewProps) {
  const { nodes, edges } = useMemo(() => {
    try {
      const parsed = JSON.parse(graphData) as {
        nodes?: Node[];
        edges?: Edge[];
      };
      return {
        nodes: parsed.nodes ?? [],
        edges: parsed.edges ?? [],
      };
    } catch {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }
  }, [graphData]);

  return (
    <div style={{ height, width: "100%" }} data-testid="blueprint-preview">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}

export default function BlueprintPreview(props: BlueprintPreviewProps) {
  return (
    <ReactFlowProvider>
      <PreviewInner {...props} />
    </ReactFlowProvider>
  );
}
