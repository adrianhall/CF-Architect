/**
 * apps/web/src/routes/_auth.tsx
 *
 * Pathless auth-gate layout. Wraps all protected routes.
 *
 * `beforeLoad` prefetches /api/me. On 401 (ApiError thrown by apiFetch),
 * the page is redirected to /_auth/login by apiFetch itself, so we don't
 * need explicit redirect logic here — the redirect is handled in the client.
 *
 * The Outlet renders nested route components inside this auth boundary.
 */

import React from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { apiFetch } from "../lib/api/client.js";
import type { CurrentUser } from "../features/f02-auth/useCurrentUser.js";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    // Warm up the /api/me query so child routes can use it synchronously.
    // ApiError with status 401 triggers apiFetch's redirect to /_auth/login.
    await apiFetch<{ ok: true; data: CurrentUser }>("/api/me");
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
