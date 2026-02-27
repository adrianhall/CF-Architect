import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Diagram,
  DiagramListResponseSchema,
  DiagramResponseSchema,
  fetchApi,
} from "../../lib/validation";
import BlueprintPreview from "../blueprints/BlueprintPreview";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

interface CardMenuProps {
  diagramId: string;
  onDuplicate: () => void;
  onDelete: () => void;
}

function CardMenu({ diagramId, onDuplicate, onDelete }: CardMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, close]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    close();
    action();
  };

  return (
    <div className="diagram-card-menu-wrapper" ref={menuRef}>
      <button
        className="diagram-card-menu-btn"
        onClick={handleToggle}
        aria-label="Card actions"
        data-testid="card-menu-btn"
      >
        <KebabIcon />
      </button>
      {open && (
        <div className="diagram-card-dropdown" data-testid="card-dropdown">
          <button
            className="diagram-card-dropdown-item"
            onClick={(e) =>
              handleAction(e, () => {
                window.location.href = `/diagram/${diagramId}`;
              })
            }
          >
            <span className="diagram-card-dropdown-icon">
              <OpenIcon />
            </span>
            Open
          </button>
          <button
            className="diagram-card-dropdown-item"
            onClick={(e) => handleAction(e, onDuplicate)}
          >
            <span className="diagram-card-dropdown-icon">
              <CopyIcon />
            </span>
            Duplicate
          </button>
          <hr className="diagram-card-dropdown-separator" />
          <button
            className="diagram-card-dropdown-item diagram-card-dropdown-danger"
            onClick={(e) => handleAction(e, onDelete)}
          >
            <span className="diagram-card-dropdown-icon">
              <TrashIcon />
            </span>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Dashboard page island. Fetches diagrams on mount, renders a responsive card grid.
 */
export default function DiagramList() {
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  /** Fetches the list of diagrams from the API. */
  const fetchDiagrams = async () => {
    try {
      const result = await fetchApi(
        "/api/v1/diagrams",
        DiagramListResponseSchema,
      );
      if (result.ok) {
        setDiagrams(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch diagrams:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDiagrams();
  }, []);

  /**
   * Duplicates a diagram by fetching its data and creating a new diagram with the same graph.
   *
   * @param diagram - The diagram to duplicate
   */
  const duplicateDiagram = async (diagram: Diagram) => {
    try {
      const origResult = await fetchApi(
        `/api/v1/diagrams/${diagram.id}`,
        DiagramResponseSchema,
      );
      if (!origResult.ok) return;

      const newResult = await fetchApi(
        "/api/v1/diagrams",
        DiagramResponseSchema,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `${diagram.title} (copy)` }),
        },
      );
      if (!newResult.ok) return;

      await fetch(`/api/v1/diagrams/${newResult.data.id}/graph`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graphData: origResult.data.graphData }),
      });

      await fetchDiagrams();
    } catch (err) {
      console.error("Failed to duplicate:", err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/v1/diagrams/${deleteTarget.id}`, { method: "DELETE" });
      setDiagrams((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setDeleteTarget(null);
    }
  };

  /**
   * Formats an ISO date string for display.
   *
   * @param iso - ISO 8601 date string
   * @returns Formatted date string (e.g. "Feb 25, 2025, 2:30 PM")
   */
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading diagrams...</p>
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-header">
        <h1 className="dashboard-title">My Diagrams</h1>
        {diagrams.length > 0 && (
          <a href="/blueprints" className="btn-create">
            + New Diagram
          </a>
        )}
      </div>

      {diagrams.length === 0 ? (
        <div className="empty-state">
          <h3>No diagrams yet</h3>
          <p>
            Create your first Cloudflare architecture diagram to get started.
          </p>
          <a
            href="/blueprints"
            className="btn-create"
            style={{ marginTop: "16px", display: "inline-block" }}
          >
            + New Diagram
          </a>
        </div>
      ) : (
        <div className="diagram-grid">
          {diagrams.map((d) => (
            <a key={d.id} href={`/diagram/${d.id}`} className="diagram-card">
              <div className="diagram-card-header">
                <div className="diagram-card-title">{d.title}</div>
                <span className="diagram-card-clock">
                  <ClockIcon />
                  <span className="diagram-card-clock-tooltip">
                    Created: {formatDate(d.createdAt)}
                    <br />
                    Updated: {formatDate(d.updatedAt)}
                  </span>
                </span>
                <CardMenu
                  diagramId={d.id}
                  onDuplicate={() => void duplicateDiagram(d)}
                  onDelete={() => setDeleteTarget({ id: d.id, title: d.title })}
                />
              </div>
              <div className="diagram-card-preview">
                <BlueprintPreview graphData={d.graphData} height={140} />
              </div>
            </a>
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        diagramTitle={deleteTarget?.title ?? ""}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
