import { useState, useMemo } from "react";
import { BLUEPRINTS, type Blueprint } from "../../lib/blueprints";
import BlueprintPreview from "./BlueprintPreview";
import CreateDiagramModal from "./CreateDiagramModal";

const ALL_CATEGORY = "All";

export default function BlueprintGallery() {
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(
    null,
  );

  const categories = useMemo(() => {
    const unique = Array.from(new Set(BLUEPRINTS.map((b) => b.category)));
    return [ALL_CATEGORY, ...unique];
  }, []);

  const filtered =
    activeCategory === ALL_CATEGORY
      ? BLUEPRINTS
      : BLUEPRINTS.filter((b) => b.category === activeCategory);

  const openModal = (bp: Blueprint | null) => {
    setSelectedBlueprint(bp);
    setModalOpen(true);
  };

  return (
    <>
      <div className="blueprint-filters">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`blueprint-filter-tab${activeCategory === cat ? " blueprint-filter-tab--active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="blueprint-grid">
        {/* Blank canvas card -- always visible */}
        <button
          className="blueprint-card blueprint-card--blank"
          onClick={() => openModal(null)}
          type="button"
        >
          <div className="blueprint-card-preview blueprint-blank-preview">
            <span className="blueprint-blank-icon">+</span>
          </div>
          <div className="blueprint-card-body">
            <div className="blueprint-card-title">Blank Canvas</div>
            <div className="blueprint-card-desc">
              Start from scratch with an empty diagram.
            </div>
          </div>
        </button>

        {filtered.map((bp) => (
          <button
            key={bp.id}
            className="blueprint-card"
            onClick={() => openModal(bp)}
            type="button"
          >
            <div className="blueprint-card-preview">
              <BlueprintPreview graphData={bp.graphData} height={200} />
            </div>
            <div className="blueprint-card-body">
              <div className="blueprint-card-title">{bp.title}</div>
              <span className="blueprint-category-badge">{bp.category}</span>
              <div className="blueprint-card-desc">{bp.description}</div>
            </div>
          </button>
        ))}
      </div>

      <CreateDiagramModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        blueprint={selectedBlueprint}
      />
    </>
  );
}
