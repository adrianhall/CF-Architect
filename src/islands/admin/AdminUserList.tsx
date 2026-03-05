import { useEffect, useRef, useState } from "react";
import {
  fetchApi,
  AdminUserListResponseSchema,
  type AdminUser,
} from "@lib/validation";
import ConfirmUserActionModal from "./ConfirmUserActionModal";

type SortBy = "email" | "displayName" | "createdAt";
type SortOrder = "asc" | "desc";

interface ApiEnvelope {
  ok: boolean;
  error?: { message: string };
}

interface Props {
  currentUserId: string;
}

export default function AdminUserList({ currentUserId }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [sortBy, setSortBy] = useState<SortBy>("email");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalAction, setModalAction] = useState<
    | { type: "delete"; user: AdminUser }
    | { type: "promote"; user: AdminUser }
    | { type: "demote"; user: AdminUser }
    | null
  >(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    const doFetch = async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortOrder,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const result = await fetchApi(
        `/api/v1/admin/users?${params}`,
        AdminUserListResponseSchema,
      );

      if (cancelled) return;
      if (result.ok) {
        setUsers(result.data.users);
        setTotal(result.data.total);
      } else {
        setError(result.error.message);
      }
      setLoading(false);
    };

    void doFetch();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleSort(col: SortBy) {
    if (sortBy === col) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder("asc");
    }
    setPage(1);
  }

  function sortIndicator(col: SortBy) {
    if (sortBy !== col) return "";
    return sortOrder === "asc" ? " \u25B2" : " \u25BC";
  }

  function handleCopyId(id: string) {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedId(null), 1500);
  }

  function handleConfirmAction() {
    if (!modalAction) return;
    const { type, user } = modalAction;

    const doAction = async () => {
      if (type === "delete") {
        const res = await fetch(`/api/v1/admin/users/${user.id}`, {
          method: "DELETE",
        });
        const json: ApiEnvelope = await res.json();
        if (!json.ok) {
          setError(json.error?.message ?? "Delete failed");
        }
      } else {
        const isAdmin = type === "promote";
        const res = await fetch(`/api/v1/admin/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAdmin }),
        });
        const json: ApiEnvelope = await res.json();
        if (!json.ok) {
          setError(json.error?.message ?? "Update failed");
        }
      }

      setModalAction(null);
      setRefreshKey((k) => k + 1);
    };

    void doAction();
  }

  return (
    <div>
      <div className="admin-controls">
        <input
          type="text"
          className="admin-search"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("email")}>
                Email{sortIndicator("email")}
              </th>
              <th onClick={() => handleSort("displayName")}>
                Name{sortIndicator("displayName")}
              </th>
              <th>Diagrams</th>
              <th>Shares</th>
              <th>Admin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="admin-table-empty">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-table-empty">
                  No users found.
                </td>
              </tr>
            )}
            {!loading &&
              users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id}>
                    <td>{u.email ?? "\u2014"}</td>
                    <td>{u.displayName ?? "\u2014"}</td>
                    <td>{u.diagramCount}</td>
                    <td>{u.shareCount}</td>
                    <td>
                      {u.isAdmin ? (
                        <span className="admin-badge admin-badge--active">
                          Admin
                        </span>
                      ) : (
                        <span className="admin-badge">User</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-actions-cell">
                        <button
                          className="toolbar-btn"
                          title={u.id}
                          onClick={() => handleCopyId(u.id)}
                        >
                          {copiedId === u.id ? "Copied!" : "Copy ID"}
                        </button>
                        {u.isAdmin && !isSelf && (
                          <button
                            className="toolbar-btn"
                            onClick={() =>
                              setModalAction({ type: "demote", user: u })
                            }
                          >
                            Demote
                          </button>
                        )}
                        {!u.isAdmin && (
                          <button
                            className="toolbar-btn"
                            onClick={() =>
                              setModalAction({ type: "promote", user: u })
                            }
                          >
                            Promote
                          </button>
                        )}
                        {!isSelf && (
                          <button
                            className="toolbar-btn toolbar-btn-danger"
                            onClick={() =>
                              setModalAction({ type: "delete", user: u })
                            }
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination">
        <button
          className="toolbar-btn"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span className="admin-pagination-info">
          Page {page} of {totalPages}
        </span>
        <button
          className="toolbar-btn"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      <ConfirmUserActionModal
        action={modalAction}
        onConfirm={handleConfirmAction}
        onCancel={() => setModalAction(null)}
      />
    </div>
  );
}
