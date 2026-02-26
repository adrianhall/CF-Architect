import { useState, useCallback, useRef } from "react";
import type { Blueprint } from "../../lib/blueprints";
import BlueprintPreview from "./BlueprintPreview";
import { fetchApi, DiagramResponseSchema } from "../../lib/validation";

interface CreateDiagramModalProps {
  open: boolean;
  onClose: () => void;
  blueprint: Blueprint | null;
}

/**
 * Inner form component that re-mounts when the selected blueprint changes,
 * ensuring form state resets cleanly without calling setState inside an effect.
 */
function CreateForm({
  blueprint,
  onClose,
}: {
  blueprint: Blueprint | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(blueprint?.title ?? "Untitled Diagram");
  const [description, setDescription] = useState(blueprint?.description ?? "");
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const body: Record<string, string> = { title };
      if (description) body.description = description;
      if (blueprint) body.blueprintId = blueprint.id;

      const result = await fetchApi("/api/v1/diagrams", DiagramResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (result.ok) {
        window.location.href = `/diagram/${result.data.id}`;
      } else {
        setCreating(false);
      }
    } catch {
      setCreating(false);
    }
  }, [title, description, blueprint]);

  return (
    <>
      <h2 className="modal-title">
        {blueprint ? blueprint.title : "Create New Diagram"}
      </h2>

      {blueprint && (
        <span className="blueprint-category-badge">{blueprint.category}</span>
      )}

      <div className="create-modal-layout">
        <div className="create-modal-preview">
          {blueprint ? (
            <BlueprintPreview graphData={blueprint.graphData} height={400} />
          ) : (
            <div className="create-modal-blank-preview">
              <span>Start with a blank canvas</span>
            </div>
          )}
        </div>

        <div className="create-modal-form">
          <label className="property-label" htmlFor="diagram-title">
            Title
          </label>
          <input
            id="diagram-title"
            className="property-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            autoFocus
          />

          <label
            className="property-label"
            htmlFor="diagram-description"
            style={{ marginTop: 12 }}
          >
            Description
          </label>
          <textarea
            id="diagram-description"
            className="property-input property-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
          />

          <div className="create-modal-actions">
            <button className="toolbar-btn" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="toolbar-btn toolbar-btn-primary"
              onClick={() => void handleCreate()}
              disabled={creating || !title.trim()}
              type="button"
            >
              {creating ? "Creating..." : "Create Diagram"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CreateDiagramModal({
  open,
  onClose,
  blueprint,
}: CreateDiagramModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      data-testid="create-diagram-modal"
    >
      <div className="modal modal-lg">
        <button className="modal-close-x" onClick={onClose} aria-label="Close">
          &times;
        </button>
        <CreateForm
          key={blueprint?.id ?? "__blank__"}
          blueprint={blueprint}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
