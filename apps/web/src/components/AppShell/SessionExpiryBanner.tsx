/**
 * apps/web/src/components/AppShell/SessionExpiryBanner.tsx
 *
 * Shows a dismissible banner when the user's JWT will expire within 30 min.
 * Reads `exp` from useCurrentUser() — the JWT expiry from GET /api/me.
 * The CF_Authorization cookie stays HttpOnly; we never read it directly.
 */

import React, { useState, useEffect } from "react";
import { useCurrentUser } from "../../features/f02-auth/useCurrentUser.js";

const WARN_BEFORE_SECONDS = 30 * 60; // 30 min
const CHECK_INTERVAL_MS = 60_000; // 1 min

export function SessionExpiryBanner() {
  const { data: user } = useCurrentUser();
  const [dismissed, setDismissed] = useState(false);
  // Tick once per minute so `showBanner` recalculates without setState in useEffect.
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const secondsRemaining = user?.exp !== undefined ? user.exp - now : Infinity;
  const showBanner = !dismissed && secondsRemaining > 0 && secondsRemaining <= WARN_BEFORE_SECONDS;

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (!showBanner) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        backgroundColor: "var(--color-warning)",
        color: "#000",
        padding: "0.5rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        fontSize: "0.875rem",
      }}
    >
      <span>
        Your session will expire soon.{" "}
        <a
          href={`/_auth/login?redirect=${encodeURIComponent(window.location.pathname)}`}
          style={{ color: "inherit", fontWeight: 600 }}
        >
          Re-authenticate
        </a>{" "}
        to continue working.
      </span>
      <button
        type="button"
        aria-label="Dismiss session expiry warning"
        onClick={handleDismiss}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem",
          padding: "0 0.25rem",
          color: "inherit",
        }}
      >
        &times;
      </button>
    </div>
  );
}
