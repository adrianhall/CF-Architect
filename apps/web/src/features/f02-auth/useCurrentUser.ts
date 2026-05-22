/**
 * apps/web/src/features/f02-auth/useCurrentUser.ts
 *
 * TanStack Query hook for the current user profile.
 * Source of truth for userId, role, exp, and preferences.
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api/client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  /** JWT expiry in Unix seconds — used by SessionExpiryBanner. */
  exp: number;
}

interface MeResponse {
  ok: true;
  data: CurrentUser;
  meta: { requestId: string };
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export function useCurrentUser() {
  return useQuery<CurrentUser, Error>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await apiFetch<MeResponse>("/api/me");
      return res.data;
    },
    staleTime: 60_000, // 1 min — re-validate on focus
    refetchOnWindowFocus: true,
  });
}
