/**
 * apps/web/src/components/AppShell/ProfileWidget.tsx
 *
 * Top-right user identity widget: avatar (initials fallback), email, role badge.
 */

import React from "react";
import type { CurrentUser } from "../../features/f02-auth/useCurrentUser.js";

interface ProfileWidgetProps {
  user: CurrentUser;
}

function getInitials(user: CurrentUser): string {
  if (user.name) {
    return user.name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase();
  }
  return (user.email[0] ?? "?").toUpperCase();
}

export function ProfileWidget({ user }: ProfileWidgetProps) {
  const initials = getInitials(user);

  return (
    <div
      aria-label={`Signed in as ${user.email}${user.role === "admin" ? " (admin)" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.875rem",
      }}
    >
      {/* Avatar — shows image if available, falls back to initials */}
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={`Avatar for ${user.email}`}
          width={32}
          height={32}
          style={{ borderRadius: "50%" }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            backgroundColor: "var(--color-accent)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
      )}

      <span style={{ color: "var(--color-text-primary)" }}>{user.email}</span>

      {user.role === "admin" && (
        <span
          style={{
            padding: "0.125rem 0.375rem",
            borderRadius: "0.25rem",
            backgroundColor: "var(--color-accent-subtle)",
            color: "var(--color-accent)",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}
        >
          admin
        </span>
      )}
    </div>
  );
}
