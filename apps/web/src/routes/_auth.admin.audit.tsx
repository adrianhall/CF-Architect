/**
 * apps/web/src/routes/_auth.admin.audit.tsx
 *
 * Admin audit log at /admin/audit.
 */

import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuditLog } from "../features/f02-admin/useAdminQueries.js";
import type { AdminAuditEntryType } from "@cf-architect/shared";

export const Route = createFileRoute("/_auth/admin/audit")({
  component: AuditLogPage,
});

const ACTION_LABELS: Record<AdminAuditEntryType["action"], { label: string; color: string }> = {
  promote: { label: "Promote", color: "var(--color-success)" },
  demote: { label: "Demote", color: "var(--color-warning)" },
  delete: { label: "Delete", color: "var(--color-error)" },
};

function AuditLogPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAuditLog({ page, limit: 20 });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <Link to="/admin" style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
          ← Users
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Audit log</h1>
      </div>

      {isLoading && <p style={{ color: "var(--color-text-secondary)" }}>Loading…</p>}
      {isError && <p style={{ color: "var(--color-error)" }}>Failed to load audit log.</p>}

      {!isLoading && !isError && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  {["When", "Actor", "Action", "Target", "Details"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.5rem 0.75rem",
                        textAlign: "left",
                        borderBottom: "2px solid var(--color-border-default)",
                        color: "var(--color-text-secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.entries.map((entry) => {
                  const { label, color } = ACTION_LABELS[entry.action];
                  return (
                    <tr
                      key={entry.id}
                      style={{ borderBottom: "1px solid var(--color-border-default)" }}
                    >
                      <td
                        style={{
                          padding: "0.75rem",
                          whiteSpace: "nowrap",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {new Date(entry.at).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.75rem" }}>{entry.actorEmail}</td>
                      <td style={{ padding: "0.75rem" }}>
                        <span
                          style={{
                            padding: "0.125rem 0.375rem",
                            borderRadius: "0.25rem",
                            backgroundColor: "transparent",
                            border: `1px solid ${color}`,
                            color,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {label}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "0.75rem",
                          fontFamily: "monospace",
                          fontSize: "0.8rem",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {entry.targetId}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem",
                          color: "var(--color-text-secondary)",
                          fontSize: "0.8rem",
                        }}
                      >
                        {entry.payloadJson ? <code>{entry.payloadJson}</code> : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
              Page {page} of {totalPages} ({data?.total ?? 0} entries)
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
