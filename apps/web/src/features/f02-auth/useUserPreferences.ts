/**
 * apps/web/src/features/f02-auth/useUserPreferences.ts
 *
 * TanStack Query hook + mutation for user preferences.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api/client.js";
import type { UpdateUserPreferencesInputType } from "@cf-architect/shared";

export interface UserPreferences {
  userId: string;
  theme: "system" | "light" | "dark" | "high-contrast";
  paletteStateJson: string | null;
  aiPanelEnabled: boolean;
  updatedAt: number;
}

interface PrefsResponse {
  ok: true;
  data: UserPreferences;
  meta: { requestId: string };
}

export function useUserPreferences() {
  return useQuery<UserPreferences, Error>({
    queryKey: ["userPreferences"],
    queryFn: async () => {
      const res = await apiFetch<PrefsResponse>("/api/me/preferences");
      return res.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();

  return useMutation<UserPreferences, Error, UpdateUserPreferencesInputType>({
    mutationFn: async (input) => {
      const res = await apiFetch<PrefsResponse>("/api/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["userPreferences"], data);
    },
  });
}
