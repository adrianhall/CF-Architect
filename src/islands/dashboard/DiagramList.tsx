import { useEffect, useState } from "react";
import {
  type Diagram,
  DiagramListResponseSchema,
  DiagramResponseSchema,
  fetchApi,
} from "../../lib/validation";
import BlueprintPreview from "../blueprints/BlueprintPreview";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

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
            <div key={d.id} className="diagram-card">
              <a
                href={`/diagram/${d.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="diagram-card-preview">
                  <BlueprintPreview graphData={d.graphData} height={140} />
                </div>
                <div className="diagram-card-body">
                  <div className="diagram-card-title">{d.title}</div>
                  <div className="diagram-card-meta">
                    Updated {formatDate(d.updatedAt)}
                  </div>
                </div>
              </a>
              <div className="diagram-card-actions">
                <button
                  onClick={() => void duplicateDiagram(d)}
                  className="btn-sm"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: d.id, title: d.title })}
                  className="btn-sm btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
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
