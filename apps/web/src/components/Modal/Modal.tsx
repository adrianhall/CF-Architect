/**
 * apps/web/src/components/Modal/Modal.tsx
 *
 * Accessible confirmation modal.
 * - Focus trapped inside while open
 * - ESC dismisses
 * - Confirm button receives initial focus
 */

import React, { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Modal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus confirm button when modal opens
  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  // ESC to dismiss + focus trap
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }

      // Trap focus inside the modal
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--color-bg-overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-message"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-default)",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          minWidth: "20rem",
          maxWidth: "90vw",
          boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
        }}
      >
        <h2 id="modal-title" style={{ margin: "0 0 0.75rem", fontSize: "1.1rem", fontWeight: 600 }}>
          {title}
        </h2>

        <div
          id="modal-message"
          style={{ marginBottom: "1.5rem", color: "var(--color-text-secondary)" }}
        >
          {message}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid var(--color-border-default)",
              borderRadius: "0.375rem",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-text-primary)",
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            style={{
              padding: "0.5rem 1rem",
              border: "none",
              borderRadius: "0.375rem",
              background: destructive ? "var(--color-error)" : "var(--color-accent)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
