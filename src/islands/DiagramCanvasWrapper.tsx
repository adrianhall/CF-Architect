import { ReactFlowProvider } from "@xyflow/react";
import DiagramCanvas from "./DiagramCanvas";

/** Props passed through to DiagramCanvas. */
interface Props {
  diagramId: string;
  readOnly?: boolean;
  initialData?: {
    title: string;
    description: string;
    graphData: string;
  };
}

/**
 * Wrapper that provides ReactFlowProvider context required by React Flow hooks.
 * Passes all props through to DiagramCanvas.
 */
export default function DiagramCanvasWrapper(props: Props) {
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  );
}
