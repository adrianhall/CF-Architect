import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// ---------------------------------------------------------------------------
// Health API response type (mirrors PLAN.md §7 success envelope)
// ---------------------------------------------------------------------------
interface HealthData {
  ok: true;
  data: { status: string; timestamp: string };
  meta: { requestId: string };
}

async function fetchHealth(): Promise<HealthData> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json() as Promise<HealthData>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function HomePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
  });

  let statusText: string;
  let statusColor: string;
  if (isLoading) {
    statusText = "Checking…";
    statusColor = "var(--color-text-secondary)";
  } else if (isError || !data?.data?.status) {
    statusText = "Unavailable";
    statusColor = "var(--color-error)";
  } else {
    statusText = data.data.status === "ok" ? "Operational" : data.data.status;
    statusColor = "var(--color-success)";
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "var(--color-bg-primary)",
        color: "var(--color-text-primary)",
        gap: "1rem",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", fontWeight: 700, margin: 0 }}>CF-Architect</h1>
      <p style={{ fontSize: "1.1rem", color: "var(--color-text-secondary)", margin: 0 }}>
        Visual architecture design for Cloudflare
      </p>

      <div
        aria-label="System health status"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          borderRadius: "0.5rem",
          border: `1px solid var(--color-border-default)`,
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        <span role="img" aria-hidden="true" style={{ fontSize: "0.75rem", color: statusColor }}>
          ●
        </span>
        <span style={{ fontSize: "0.875rem" }}>
          System status: <strong style={{ color: statusColor }}>{statusText}</strong>
        </span>
      </div>
    </main>
  );
}
