// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmUserActionModal from "@islands/admin/ConfirmUserActionModal";
import type { AdminUser } from "@lib/validation";

const mockUser: AdminUser = {
  id: "u1",
  email: "alice@example.com",
  displayName: "Alice",
  avatarUrl: null,
  isAdmin: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  diagramCount: 5,
  shareCount: 2,
};

describe("ConfirmUserActionModal", () => {
  const defaultProps = {
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders nothing when action is null", () => {
    const { container } = render(
      <ConfirmUserActionModal {...defaultProps} action={null} />,
    );
    expect(container.innerHTML).toBe("");
  });

  describe("delete action", () => {
    const deleteAction = { type: "delete" as const, user: mockUser };

    it("shows Delete User title", () => {
      render(
        <ConfirmUserActionModal {...defaultProps} action={deleteAction} />,
      );
      expect(screen.getByText("Delete User")).toBeInTheDocument();
    });

    it("shows the user email in the message", () => {
      render(
        <ConfirmUserActionModal {...defaultProps} action={deleteAction} />,
      );
      expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
    });

    it("shows diagram and share counts in the message", () => {
      render(
        <ConfirmUserActionModal {...defaultProps} action={deleteAction} />,
      );
      expect(screen.getByText(/5 diagrams/)).toBeInTheDocument();
      expect(screen.getByText(/2 share links/)).toBeInTheDocument();
    });

    it("renders a danger-styled Delete button", () => {
      render(
        <ConfirmUserActionModal {...defaultProps} action={deleteAction} />,
      );
      const modal = screen.getByTestId("confirm-user-action-modal");
      expect(modal.querySelector(".toolbar-btn-danger")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    it("uses singular form for 1 diagram", () => {
      const userWith1 = { ...mockUser, diagramCount: 1, shareCount: 1 };
      render(
        <ConfirmUserActionModal
          {...defaultProps}
          action={{ type: "delete", user: userWith1 }}
        />,
      );
      expect(screen.getByText(/1 diagram(?!s)/)).toBeInTheDocument();
      expect(screen.getByText(/1 share link(?!s)/)).toBeInTheDocument();
    });
  });

  describe("promote action", () => {
    const promoteAction = { type: "promote" as const, user: mockUser };

    it("shows Promote to Admin title", () => {
      render(
        <ConfirmUserActionModal {...defaultProps} action={promoteAction} />,
      );
      expect(screen.getByText("Promote to Admin")).toBeInTheDocument();
    });

    it("renders a primary-styled Promote button", () => {
      render(
        <ConfirmUserActionModal {...defaultProps} action={promoteAction} />,
      );
      const modal = screen.getByTestId("confirm-user-action-modal");
      expect(modal.querySelector(".toolbar-btn-primary")).toBeInTheDocument();
      expect(screen.getByText("Promote")).toBeInTheDocument();
    });
  });

  describe("demote action", () => {
    const adminUser = { ...mockUser, isAdmin: true };
    const demoteAction = { type: "demote" as const, user: adminUser };

    it("shows Demote to User title", () => {
      render(
        <ConfirmUserActionModal {...defaultProps} action={demoteAction} />,
      );
      expect(screen.getByText("Demote to User")).toBeInTheDocument();
    });

    it("renders a danger-styled Demote button", () => {
      render(
        <ConfirmUserActionModal {...defaultProps} action={demoteAction} />,
      );
      const modal = screen.getByTestId("confirm-user-action-modal");
      expect(modal.querySelector(".toolbar-btn-danger")).toBeInTheDocument();
      expect(screen.getByText("Demote")).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    const deleteAction = { type: "delete" as const, user: mockUser };

    it("calls onConfirm when confirm button is clicked", () => {
      const onConfirm = vi.fn();
      render(
        <ConfirmUserActionModal
          action={deleteAction}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />,
      );
      const modal = screen.getByTestId("confirm-user-action-modal");
      const deleteBtn = modal.querySelector(
        ".toolbar-btn-danger",
      ) as HTMLElement;
      fireEvent.click(deleteBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when Cancel button is clicked", () => {
      const onCancel = vi.fn();
      render(
        <ConfirmUserActionModal
          action={deleteAction}
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />,
      );
      fireEvent.click(screen.getByText("Cancel"));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when close-X button is clicked", () => {
      const onCancel = vi.fn();
      render(
        <ConfirmUserActionModal
          action={deleteAction}
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />,
      );
      fireEvent.click(screen.getByLabelText("Close"));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when overlay is clicked", () => {
      const onCancel = vi.fn();
      render(
        <ConfirmUserActionModal
          action={deleteAction}
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />,
      );
      fireEvent.click(screen.getByTestId("confirm-user-action-modal"));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("does not call onCancel when modal content is clicked", () => {
      const onCancel = vi.fn();
      render(
        <ConfirmUserActionModal
          action={deleteAction}
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />,
      );
      fireEvent.click(screen.getByText("Delete User"));
      expect(onCancel).not.toHaveBeenCalled();
    });
  });
});
