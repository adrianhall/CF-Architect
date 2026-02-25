import { useEffect, useState } from "react";

interface Diagram {
  id: string;
  title: string;
  description: string | null;
  updatedAt: string;
  createdAt: string;
}

export default function DiagramList() {
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDiagrams = async () => {
    try {
      const res = await fetch("/api/v1/diagrams");
      const data = await res.json();
      if (data.ok) {
        setDiagrams(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch diagrams:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagrams();
  }, []);

  const createDiagram = async () => {
    try {
      const res = await fetch("/api/v1/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = `/diagram/${data.data.id}`;
      }
    } catch (err) {
      console.error("Failed to create diagram:", err);
    }
  };

  const duplicateDiagram = async (diagram: Diagram) => {
    try {
      const origRes = await fetch(`/api/v1/diagrams/${diagram.id}`);
      const origData = await origRes.json();
      if (!origData.ok) return;

      const res = await fetch("/api/v1/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `${diagram.title} (copy)` }),
      });
      const newData = await res.json();
      if (!newData.ok) return;

      await fetch(`/api/v1/diagrams/${newData.data.id}/graph`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graphData: origData.data.graphData }),
      });

      fetchDiagrams();
    } catch (err) {
      console.error("Failed to duplicate:", err);
    }
  };

  const deleteDiagram = async (id: string) => {
    if (!confirm("Are you sure you want to delete this diagram?")) return;
    try {
      await fetch(`/api/v1/diagrams/${id}`, { method: "DELETE" });
      setDiagrams((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

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
          <button onClick={createDiagram} className="btn-create">
            + New Diagram
          </button>
        )}
      </div>

      {diagrams.length === 0 ? (
        <div className="empty-state">
          <h3>No diagrams yet</h3>
          <p>Create your first Cloudflare architecture diagram to get started.</p>
          <button
            onClick={createDiagram}
            className="btn-create"
            style={{ marginTop: "16px" }}
          >
            + New Diagram
          </button>
        </div>
      ) : (
        <div className="diagram-grid">
          {diagrams.map((d) => (
            <div key={d.id} className="diagram-card">
              <a
                href={`/diagram/${d.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="diagram-card-preview">Preview</div>
                <div className="diagram-card-body">
                  <div className="diagram-card-title">{d.title}</div>
                  <div className="diagram-card-meta">
                    Updated {formatDate(d.updatedAt)}
                  </div>
                </div>
              </a>
              <div className="diagram-card-actions">
                <button
                  onClick={() => duplicateDiagram(d)}
                  className="btn-sm"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => deleteDiagram(d.id)}
                  className="btn-sm btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
