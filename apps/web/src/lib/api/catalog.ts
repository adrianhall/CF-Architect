/**
 * apps/web/src/lib/api/catalog.ts
 *
 * TanStack Query hook for the Cloudflare service catalog.
 *
 * The catalog is static per deploy, so we use a very long staleTime (24 h)
 * to avoid unnecessary re-fetches. The Worker responds with ETag / 304 for
 * browser-level caching even within the same session.
 *
 * Usage:
 *   const { data: catalog, isLoading } = useCatalog();
 *   if (catalog) {
 *     const workers = catalog.services.find(s => s.typeId === "workers");
 *   }
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client.js";
import type { Catalog } from "@cf-architect/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CatalogResponse {
  ok: true;
  data: Catalog;
  meta: { requestId: string };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches and caches the full Cloudflare service catalog from GET /api/catalog.
 *
 * staleTime: 24 h — the catalog is static per deploy; no need to re-fetch
 *   within the same session. Background refetch is disabled to avoid
 *   unnecessary network traffic.
 */
export function useCatalog() {
  return useQuery<Catalog, Error>({
    queryKey: ["catalog"],
    queryFn: async () => {
      const res = await apiFetch<CatalogResponse>("/api/catalog");
      return res.data;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // keep in cache for 24 hours after unmount
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
