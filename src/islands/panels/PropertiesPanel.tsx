import { useDiagramStore } from "../store/diagramStore";
import { NODE_TYPE_MAP, EDGE_TYPES, CATEGORY_LABELS } from "../../lib/catalog";
import type { DocLinkIcon } from "../../lib/catalog";
import type { CFNodeData, CFEdgeData } from "../types";

function BookIcon() {
  return (
    <svg
      className="properties-doc-icon"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 2.5A1.5 1.5 0 0 1 3.5 1h2A1.5 1.5 0 0 1 7 2.5V4h2V2.5A1.5 1.5 0 0 1 10.5 1h2A1.5 1.5 0 0 1 14 2.5v10a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 9 12.5V11H7v1.5A1.5 1.5 0 0 1 5.5 14h-2A1.5 1.5 0 0 1 2 12.5v-10ZM5.5 2.5h-2v10h2v-10Zm5 0v10h2v-10h-2ZM7 5.5v4h2v-4H7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg
      className="properties-doc-icon"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9.5l2.4 1.8A.75.75 0 0 0 14.6 11V5a.75.75 0 0 0-1.2-.6L11 6.2V5a2 2 0 0 0-2-2H3Z"
        fill="currentColor"
      />
    </svg>
  );
}

const DOC_LINK_ICONS: Record<DocLinkIcon, () => React.ReactNode> = {
  doc: BookIcon,
  video: VideoIcon,
};

/**
 * Right sidebar that shows editable properties for the currently selected node
 * or edge. For nodes: type, category, label, description, accent colour,
 * documentation links. For edges: edge type selector, label, protocol,
 * description. Shows empty-state message when nothing is selected.
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

        {typeDef?.docLinks && typeDef.docLinks.length > 0 && (
          <div className="properties-section">
            <label className="property-label">Documentation</label>
            <ul className="properties-doc-list">
              {typeDef.docLinks.map((link) => {
                const Icon = DOC_LINK_ICONS[link.icon];
                return (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="properties-doc-link"
                    >
                      <Icon />
                      <span>{link.title}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
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
