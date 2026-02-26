import { useDiagramStore } from "../store/diagramStore";
import { NODE_TYPE_MAP, EDGE_TYPES, CATEGORY_LABELS } from "../../lib/catalog";
import type { CFNodeData, CFEdgeData } from "../types";

/**
 * Right sidebar that shows editable properties for the currently selected node
 * or edge. For nodes: type, category, label, description, accent colour. For
 * edges: edge type selector, label, protocol, description. Shows empty-state
 * message when nothing is selected.
 */
export function PropertiesPanel() {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    updateNodeData,
    updateEdgeData,
  } = useDiagramStore();

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;
  const selectedEdge = selectedEdgeId
    ? edges.find((e) => e.id === selectedEdgeId)
    : null;

  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="properties-panel">
        <div className="properties-empty">
          <p>Select a node or edge to view its properties</p>
        </div>
      </aside>
    );
  }

  if (selectedNode) {
    const data = selectedNode.data as unknown as CFNodeData;
    const typeDef = NODE_TYPE_MAP.get(data.typeId);
    const category = typeDef?.category ?? "external";

    return (
      <aside className="properties-panel">
        <h3 className="properties-title">Node Properties</h3>

        <div className="properties-section">
          <div className="property-row">
            <span className="property-label-tag">Type</span>
            <span>{typeDef?.label ?? data.typeId}</span>
          </div>
          <div className="property-row">
            <span className="property-label-tag">Category</span>
            <span>{CATEGORY_LABELS[category]}</span>
          </div>
        </div>

        <div className="properties-section">
          <label className="property-label">Label</label>
          <input
            type="text"
            value={data.label}
            onChange={(e) =>
              updateNodeData(selectedNode.id, { label: e.target.value })
            }
            className="property-input"
          />
        </div>

        <div className="properties-section">
          <label className="property-label">Description</label>
          <textarea
            value={data.description ?? ""}
            onChange={(e) =>
              updateNodeData(selectedNode.id, { description: e.target.value })
            }
            className="property-input property-textarea"
            rows={3}
          />
        </div>

        <div className="properties-section">
          <label className="property-label">Accent Color</label>
          <input
            type="color"
            value={(data.style?.accentColor ?? typeDef) ? "#" : "#6B7280"}
            onChange={(e) =>
              updateNodeData(selectedNode.id, {
                style: { ...data.style, accentColor: e.target.value },
              })
            }
            className="property-color"
          />
        </div>
      </aside>
    );
  }

  if (selectedEdge) {
    const data = (selectedEdge.data as unknown as CFEdgeData) ?? {
      edgeType: "data-flow",
    };

    return (
      <aside className="properties-panel">
        <h3 className="properties-title">Edge Properties</h3>

        <div className="properties-section">
          <label className="property-label">Edge Type</label>
          <select
            value={data.edgeType}
            onChange={(e) =>
              updateEdgeData(selectedEdge.id, {
                edgeType: e.target.value as CFEdgeData["edgeType"],
              })
            }
            className="property-input"
          >
            {EDGE_TYPES.map((et) => (
              <option key={et.edgeType} value={et.edgeType}>
                {et.label}
              </option>
            ))}
          </select>
        </div>

        <div className="properties-section">
          <label className="property-label">Label</label>
          <input
            type="text"
            value={data.label ?? ""}
            onChange={(e) =>
              updateEdgeData(selectedEdge.id, { label: e.target.value })
            }
            className="property-input"
          />
        </div>

        <div className="properties-section">
          <label className="property-label">Protocol</label>
          <select
            value={data.protocol ?? ""}
            onChange={(e) =>
              updateEdgeData(selectedEdge.id, {
                protocol: e.target.value || undefined,
              })
            }
            className="property-input"
          >
            <option value="">None</option>
            <option value="http">HTTP</option>
            <option value="ws">WebSocket</option>
            <option value="binding">Binding</option>
            <option value="queue">Queue</option>
            <option value="email">Email</option>
          </select>
        </div>

        <div className="properties-section">
          <label className="property-label">Description</label>
          <textarea
            value={data.description ?? ""}
            onChange={(e) =>
              updateEdgeData(selectedEdge.id, { description: e.target.value })
            }
            className="property-input property-textarea"
            rows={3}
          />
        </div>
      </aside>
    );
  }

  return null;
}
