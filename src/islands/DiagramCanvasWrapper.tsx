import { ReactFlowProvider } from "@xyflow/react";
import DiagramCanvas from "./DiagramCanvas";

interface Props {
  diagramId: string;
  readOnly?: boolean;
  initialData?: {
    title: string;
    description: string;
    graphData: string;
  };
}

export default function DiagramCanvasWrapper(props: Props) {
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  );
}
