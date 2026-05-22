/**
 * apps/web/src/components/AppShell/AppShell.tsx
 *
 * Top-level page chrome: header with nav + ProfileWidget, session banner.
 * Renders an Outlet for nested route content.
 */

import React from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { ProfileWidget } from "./ProfileWidget.js";
import { SessionExpiryBanner } from "./SessionExpiryBanner.js";
import { useCurrentUser } from "../../features/f02-auth/useCurrentUser.js";

export function AppShell() {
  const { data: user } = useCurrentUser();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg-primary)",
        color: "var(--color-text-primary)",
      }}
    >
      {/* Session expiry banner — shows above the header when active */}
      <SessionExpiryBanner />

      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1.5rem",
          height: "3.5rem",
          borderBottom: "1px solid var(--color-border-default)",
          backgroundColor: "var(--color-bg-surface)",
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <Link
          to="/"
          style={{
            fontWeight: 700,
            fontSize: "1.1rem",
            color: "var(--color-text-primary)",
            textDecoration: "none",
          }}
        >
          CF-Architect
        </Link>

        {/* Nav */}
        <nav aria-label="Main navigation" style={{ display: "flex", gap: "1.5rem" }}>
          {user?.role === "admin" && (
            <Link
              to="/admin"
              style={{
                color: "var(--color-text-secondary)",
                textDecoration: "none",
                fontSize: "0.875rem",
              }}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Profile widget */}
        {user && <ProfileWidget user={user} />}
      </header>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
