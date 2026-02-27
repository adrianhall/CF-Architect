import { useCallback, useRef } from "react";

interface ConfirmDeleteModalProps {
  open: boolean;
  diagramTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({
  open,
  diagramTitle,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onCancel();
    },
    [onCancel],
  );

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      data-testid="confirm-delete-modal"
    >
      <div className="modal">
        <button className="modal-close-x" onClick={onCancel} aria-label="Close">
          &times;
        </button>
        <h2 className="modal-title">Delete Diagram</h2>
        <p className="modal-text">
          Are you sure you want to delete &ldquo;{diagramTitle}&rdquo;? This
          action cannot be undone.
        </p>
        <div className="modal-actions">
          <button className="toolbar-btn" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="toolbar-btn toolbar-btn-danger"
            onClick={onConfirm}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
