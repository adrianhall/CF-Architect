export interface CFNodeData {
  typeId: string;
  label: string;
  description?: string;
  config?: Record<string, unknown>;
  style?: {
    accentColor?: string;
  };
  [key: string]: unknown;
}

export interface CFEdgeData {
  edgeType: "data-flow" | "service-binding" | "trigger" | "external";
  label?: string;
  description?: string;
  protocol?: string;
  [key: string]: unknown;
}
