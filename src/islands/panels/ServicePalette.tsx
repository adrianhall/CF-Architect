import { useState, DragEvent } from "react";
import {
  getNodesByCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type NodeCategory,
  type NodeTypeDef,
} from "../../lib/catalog";

const grouped = getNodesByCategory();
const categories = Object.keys(grouped) as NodeCategory[];

export function ServicePalette() {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filterTerm = search.toLowerCase().trim();

  const onDragStart = (event: DragEvent, typeId: string) => {
    event.dataTransfer.setData("application/cf-node-type", typeId);
    event.dataTransfer.effectAllowed = "move";
  };

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <aside className="service-palette">
      <div className="palette-header">
        <h2 className="palette-title">Services</h2>
        <input
          type="text"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="palette-search"
        />
      </div>

      <div className="palette-list">
        {categories.map((cat) => {
          const items = grouped[cat].filter(
            (n) =>
              !filterTerm ||
              n.label.toLowerCase().includes(filterTerm) ||
              n.typeId.toLowerCase().includes(filterTerm),
          );
          if (items.length === 0) return null;

          const isCollapsed = collapsed[cat] && !filterTerm;

          return (
            <div key={cat} className="palette-category">
              <button
                className="palette-category-header"
                onClick={() => toggleCategory(cat)}
                style={{ borderLeftColor: CATEGORY_COLORS[cat] }}
              >
                <span>{CATEGORY_LABELS[cat]}</span>
                <span className="palette-chevron">
                  {isCollapsed ? "+" : "\u2013"}
                </span>
              </button>

              {!isCollapsed && (
                <div className="palette-items">
                  {items.map((node) => (
                    <PaletteItem
                      key={node.typeId}
                      node={node}
                      onDragStart={onDragStart}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function PaletteItem({
  node,
  onDragStart,
}: {
  node: NodeTypeDef;
  onDragStart: (e: DragEvent, typeId: string) => void;
}) {
  return (
    <div
      className="palette-item"
      draggable
      onDragStart={(e) => onDragStart(e, node.typeId)}
      title={node.description}
    >
      <img src={node.iconPath} alt="" width={20} height={20} />
      <span>{node.label}</span>
    </div>
  );
}
