import { useCallback, useRef } from "react";
import type { AdminUser } from "@lib/validation";

type ModalAction =
  | { type: "delete"; user: AdminUser }
  | { type: "promote"; user: AdminUser }
  | { type: "demote"; user: AdminUser }
  | null;

interface Props {
  action: ModalAction;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmUserActionModal({
  action,
  onConfirm,
  onCancel,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onCancel();
    },
    [onCancel],
  );

  if (!action) return null;

  const { type, user } = action;

  let title: string;
  let message: string;
  let confirmLabel: string;
  let isDanger: boolean;

  if (type === "delete") {
    title = "Delete User";
    message = `Are you sure you want to delete "${user.email ?? user.id}"? This will permanently remove their account along with ${user.diagramCount} diagram${user.diagramCount !== 1 ? "s" : ""} and ${user.shareCount} share link${user.shareCount !== 1 ? "s" : ""}. This action cannot be undone.`;
    confirmLabel = "Delete";
    isDanger = true;
  } else if (type === "promote") {
    title = "Promote to Admin";
    message = `Are you sure you want to grant admin privileges to "${user.email ?? user.id}"? They will be able to manage all users.`;
    confirmLabel = "Promote";
    isDanger = false;
  } else {
    title = "Demote to User";
    message = `Are you sure you want to revoke admin privileges from "${user.email ?? user.id}"?`;
    confirmLabel = "Demote";
    isDanger = true;
  }

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      data-testid="confirm-user-action-modal"
    >
      <div className="modal">
        <button className="modal-close-x" onClick={onCancel} aria-label="Close">
          &times;
        </button>
        <h2 className="modal-title">{title}</h2>
        <p className="modal-text">{message}</p>
        <div className="modal-actions">
          <button className="toolbar-btn" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className={`toolbar-btn ${isDanger ? "toolbar-btn-danger" : "toolbar-btn-primary"}`}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
