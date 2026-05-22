/**
 * apps/web/src/routes/_auth.index.tsx
 *
 * Protected home page — the entry point after authentication.
 */

import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentUser } from "../features/f02-auth/useCurrentUser.js";

export const Route = createFileRoute("/_auth/")({
  component: HomePage,
});

function HomePage() {
  const { data: user } = useCurrentUser();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        fontFamily: "system-ui, sans-serif",
        gap: "1rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>CF-Architect</h1>
      <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>
        Visual architecture design for Cloudflare
      </p>

      {user && (
        <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
          Signed in as <strong>{user.email}</strong>
        </p>
      )}

      {user?.role === "admin" && (
        <Link
          to="/admin"
          style={{
            padding: "0.5rem 1rem",
            background: "var(--color-accent)",
            color: "#fff",
            borderRadius: "0.375rem",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
          }}
        >
          Admin panel
        </Link>
      )}
    </div>
  );
}
