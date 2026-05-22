/**
 * apps/web/src/routes/_auth.admin.index.tsx
 *
 * Admin user list at /admin.
 * TanStack Table v8 — server-driven sort, pagination, and search.
 */

import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table";
import {
  useAdminUsers,
  useUpdateUserRole,
  useDeleteUser,
} from "../features/f02-admin/useAdminQueries.js";
import { useCurrentUser } from "../features/f02-auth/useCurrentUser.js";
import { Modal } from "../components/Modal/Modal.js";
import type { AdminUserRowType } from "@cf-architect/shared";

export const Route = createFileRoute("/_auth/admin/")({
  component: AdminUsersPage,
});

type SortField = "name" | "email" | "role" | "joined_at";
type SortOrder = "asc" | "desc";

function AdminUsersPage() {
  const { data: me } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortField>("joined_at");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [q, setQ] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRowType | null>(null);

  const { data, isLoading, isError } = useAdminUsers({
    page,
    limit: 20,
    sort,
    order,
    ...(q ? { q } : {}),
  });
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();

  const handleSort = (field: SortField) => {
    if (sort === field) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder("asc");
    }
    setPage(1);
  };

  const columns: ColumnDef<AdminUserRowType>[] = [
    {
      accessorKey: "email",
      header: () => (
        <button type="button" onClick={() => handleSort("email")} style={sortBtnStyle}>
          Email {sort === "email" ? (order === "asc" ? "↑" : "↓") : ""}
        </button>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ getValue }) => (getValue() as string | null) ?? "—",
    },
    {
      accessorKey: "role",
      header: () => (
        <button type="button" onClick={() => handleSort("role")} style={sortBtnStyle}>
          Role {sort === "role" ? (order === "asc" ? "↑" : "↓") : ""}
        </button>
      ),
      cell: ({ getValue }) => {
        const role = getValue() as string;
        return (
          <span
            style={{
              padding: "0.125rem 0.375rem",
              borderRadius: "0.25rem",
              backgroundColor:
                role === "admin" ? "var(--color-accent-subtle)" : "var(--color-bg-secondary)",
              color: role === "admin" ? "var(--color-accent)" : "var(--color-text-secondary)",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            {role}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <button type="button" onClick={() => handleSort("joined_at")} style={sortBtnStyle}>
          Joined {sort === "joined_at" ? (order === "asc" ? "↑" : "↓") : ""}
        </button>
      ),
      cell: ({ getValue }) => new Date(getValue() as number).toLocaleDateString(),
    },
    {
      id: "diagramCount",
      header: "Diagrams",
      cell: () => 0, // Wired in Phase 05
    },
    {
      id: "shareCount",
      header: "Shares",
      cell: () => 0, // Wired in Phase 05
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const user = row.original;
        const isSelf = me?.id === user.id;
        const isAdmin = user.role === "admin";

        return (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              disabled={isSelf || updateRole.isPending}
              aria-label={
                isAdmin ? `Demote ${user.email} to user` : `Promote ${user.email} to admin`
              }
              onClick={() => updateRole.mutate({ id: user.id, role: isAdmin ? "user" : "admin" })}
              style={{
                ...actionBtnStyle,
                opacity: isSelf ? 0.4 : 1,
                cursor: isSelf ? "not-allowed" : "pointer",
              }}
            >
              {isAdmin ? "Demote" : "Promote"}
            </button>

            <button
              type="button"
              disabled={isSelf || deleteUser.isPending}
              aria-label={`Delete ${user.email}`}
              onClick={() => setDeleteTarget(user)}
              style={{
                ...actionBtnStyle,
                color: "var(--color-error)",
                borderColor: "var(--color-error)",
                opacity: isSelf ? 0.4 : 1,
                cursor: isSelf ? "not-allowed" : "pointer",
              }}
            >
              Delete
            </button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: data?.users ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    ...(data?.total !== undefined && { rowCount: data.total }),
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Users</h1>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Link
            to="/admin/audit"
            style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}
          >
            Audit log
          </Link>
        </div>
      </div>

      {/* Search */}
      <input
        type="search"
        aria-label="Search users by email or name"
        placeholder="Search by email or name…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        style={{
          marginBottom: "1rem",
          padding: "0.5rem 0.75rem",
          border: "1px solid var(--color-border-default)",
          borderRadius: "0.375rem",
          width: "100%",
          maxWidth: "24rem",
          backgroundColor: "var(--color-bg-surface)",
          color: "var(--color-text-primary)",
        }}
      />

      {isLoading && <p style={{ color: "var(--color-text-secondary)" }}>Loading…</p>}
      {isError && <p style={{ color: "var(--color-error)" }}>Failed to load users.</p>}

      {!isLoading && !isError && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "left",
                          borderBottom: "2px solid var(--color-border-default)",
                          color: "var(--color-text-secondary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: "1px solid var(--color-border-default)",
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} style={{ padding: "0.75rem" }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
              Page {page} of {totalPages} ({data?.total ?? 0} users)
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

      {/* Delete confirmation modal */}
      <Modal
        open={deleteTarget !== null}
        title="Delete user"
        message={
          <>
            Are you sure you want to delete <strong>{deleteTarget?.email}</strong>? This action
            cannot be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteTarget) {
            deleteUser.mutate({ id: deleteTarget.id });
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

const sortBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
  color: "inherit",
  fontWeight: "inherit",
  fontSize: "inherit",
};

const actionBtnStyle: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  border: "1px solid var(--color-border-default)",
  borderRadius: "0.25rem",
  background: "transparent",
  fontSize: "0.75rem",
  color: "var(--color-text-primary)",
};
