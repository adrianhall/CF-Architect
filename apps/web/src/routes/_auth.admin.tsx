/**
 * apps/web/src/routes/_auth.admin.tsx
 *
 * Admin gate layout. Redirects non-admin users to the home page.
 */

import React from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { apiFetch } from "../lib/api/client.js";
import type { CurrentUser } from "../features/f02-auth/useCurrentUser.js";

export const Route = createFileRoute("/_auth/admin")({
  beforeLoad: async () => {
    const res = await apiFetch<{ ok: true; data: CurrentUser }>("/api/me");
    if (res.data.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div style={{ padding: "1.5rem" }}>
      <Outlet />
    </div>
  );
}
