/**
 * apps/web/src/features/f02-admin/useAdminQueries.ts
 *
 * TanStack Query hooks for the admin user list, audit log, and mutations.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "../../lib/api/client.js";
import type { AdminUserRowType, AdminAuditEntryType } from "@cf-architect/shared";

// ---------------------------------------------------------------------------
// Users list
// ---------------------------------------------------------------------------

interface UsersResponse {
  ok: true;
  data: {
    users: AdminUserRowType[];
    total: number;
    page: number;
    limit: number;
  };
  meta: { requestId: string };
}

interface UsersParams {
  page?: number;
  limit?: number;
  sort?: "name" | "email" | "role" | "joined_at";
  order?: "asc" | "desc";
  q?: string;
}

export function useAdminUsers(params: UsersParams = {}) {
  const { page = 1, limit = 20, sort = "joined_at", order = "desc", q } = params;
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort,
    order,
  });
  if (q) searchParams.set("q", q);

  return useQuery<UsersResponse["data"], ApiError>({
    queryKey: ["adminUsers", params],
    queryFn: async () => {
      const res = await apiFetch<UsersResponse>(`/api/admin/users?${searchParams}`);
      return res.data;
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Update role
// ---------------------------------------------------------------------------

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation<AdminUserRowType, ApiError, { id: string; role: "user" | "admin" }>({
    mutationFn: async ({ id, role }) => {
      const res = await apiFetch<{ ok: true; data: AdminUserRowType }>(
        `/api/admin/users/${id}/role`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Delete user
// ---------------------------------------------------------------------------

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { id: string }>({
    mutationFn: async ({ id }) => {
      await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": getCsrfToken() ?? "" },
      }).then(async (res) => {
        if (!res.ok && res.status !== 204) {
          throw new ApiError("DELETE_FAILED", `Delete failed: ${res.status}`, res.status);
        }
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
    },
  });
}

function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const pair of document.cookie.split(";")) {
    const [name, ...rest] = pair.split("=");
    if (name?.trim() === "CF_CSRF") return rest.join("=").trim();
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

interface AuditResponse {
  ok: true;
  data: {
    entries: AdminAuditEntryType[];
    total: number;
    page: number;
    limit: number;
  };
  meta: { requestId: string };
}

interface AuditParams {
  page?: number;
  limit?: number;
}

export function useAuditLog(params: AuditParams = {}) {
  const { page = 1, limit = 20 } = params;
  const searchParams = new URLSearchParams({ page: String(page), limit: String(limit) });

  return useQuery<AuditResponse["data"], ApiError>({
    queryKey: ["auditLog", params],
    queryFn: async () => {
      const res = await apiFetch<AuditResponse>(`/api/admin/audit?${searchParams}`);
      return res.data;
    },
    staleTime: 30_000,
  });
}
