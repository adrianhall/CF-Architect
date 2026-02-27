// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmDeleteModal from "@islands/dashboard/ConfirmDeleteModal";

describe("ConfirmDeleteModal", () => {
  const defaultProps = {
    open: true,
    diagramTitle: "My Architecture",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders nothing when open is false", () => {
    const { container } = render(
      <ConfirmDeleteModal {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the modal when open is true", () => {
    render(<ConfirmDeleteModal {...defaultProps} />);
    expect(screen.getByTestId("confirm-delete-modal")).toBeInTheDocument();
    expect(screen.getByText("Delete Diagram")).toBeInTheDocument();
  });

  it("displays the diagram title in the confirmation message", () => {
    render(<ConfirmDeleteModal {...defaultProps} />);
    expect(
      screen.getByText(/Are you sure you want to delete/),
    ).toBeInTheDocument();
    expect(screen.getByText(/My Architecture/)).toBeInTheDocument();
  });

  it("renders Cancel and Delete buttons", () => {
    render(<ConfirmDeleteModal {...defaultProps} />);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    const modal = screen.getByTestId("confirm-delete-modal");
    expect(modal.querySelector(".toolbar-btn-danger")).toBeInTheDocument();
  });

  it("calls onConfirm when Delete button is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDeleteModal {...defaultProps} onConfirm={onConfirm} />);
    const modal = screen.getByTestId("confirm-delete-modal");
    const deleteBtn = modal.querySelector(".toolbar-btn-danger") as HTMLElement;
    fireEvent.click(deleteBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDeleteModal {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when close-X button is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDeleteModal {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when overlay is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDeleteModal {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId("confirm-delete-modal"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not call onCancel when modal content is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDeleteModal {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Delete Diagram"));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
