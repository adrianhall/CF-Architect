// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProfileButton } from "@islands/toolbar/ProfileButton";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfileButton", () => {
  it("renders a button with the email as title", () => {
    render(<ProfileButton email="alice@example.com" />);
    expect(screen.getByTitle("alice@example.com")).toBeInTheDocument();
  });

  it("shows a person icon when no displayName is provided", () => {
    const { container } = render(<ProfileButton email="alice@example.com" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows initials when displayName is provided", () => {
    render(
      <ProfileButton email="alice@example.com" displayName="Alice Builder" />,
    );
    expect(screen.getByTitle("alice@example.com")).toHaveTextContent("AB");
  });

  it("shows single initial for a one-word displayName", () => {
    render(<ProfileButton email="alice@example.com" displayName="Alice" />);
    expect(screen.getByTitle("alice@example.com")).toHaveTextContent("A");
  });

  it("uses at most two initials for longer names", () => {
    render(
      <ProfileButton email="a@example.com" displayName="Alice B. Charlie" />,
    );
    expect(screen.getByTitle("a@example.com")).toHaveTextContent("AB");
  });

  it("does not show the dropdown initially", () => {
    render(<ProfileButton email="alice@example.com" />);
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
  });

  it("opens the dropdown on click and shows the email", () => {
    render(<ProfileButton email="alice@example.com" />);
    fireEvent.click(screen.getByTitle("alice@example.com"));
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("shows displayName in the dropdown when provided", () => {
    render(
      <ProfileButton email="alice@example.com" displayName="Alice Builder" />,
    );
    fireEvent.click(screen.getByTitle("alice@example.com"));
    expect(screen.getByText("Alice Builder")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("does not show displayName row when displayName is omitted", () => {
    const { container } = render(<ProfileButton email="alice@example.com" />);
    fireEvent.click(screen.getByTitle("alice@example.com"));
    expect(container.querySelector(".profile-dropdown-name")).toBeNull();
  });

  it("closes the dropdown when clicking the button again", () => {
    render(<ProfileButton email="alice@example.com" />);
    const btn = screen.getByTitle("alice@example.com");
    fireEvent.click(btn);
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
  });

  it("closes the dropdown when clicking outside", () => {
    render(
      <div>
        <span data-testid="outside">outside</span>
        <ProfileButton email="alice@example.com" />
      </div>,
    );
    fireEvent.click(screen.getByTitle("alice@example.com"));
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
  });

  it("does not show Admin link when isAdmin is false", () => {
    render(<ProfileButton email="alice@example.com" isAdmin={false} />);
    fireEvent.click(screen.getByTitle("alice@example.com"));
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("does not show Admin link when isAdmin is omitted", () => {
    render(<ProfileButton email="alice@example.com" />);
    fireEvent.click(screen.getByTitle("alice@example.com"));
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows Admin link when isAdmin is true", () => {
    render(<ProfileButton email="alice@example.com" isAdmin={true} />);
    fireEvent.click(screen.getByTitle("alice@example.com"));
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders the Admin link pointing to /admin", () => {
    render(<ProfileButton email="alice@example.com" isAdmin={true} />);
    fireEvent.click(screen.getByTitle("alice@example.com"));
    const link = screen.getByText("Admin").closest("a");
    expect(link).toHaveAttribute("href", "/admin");
  });

  it("shows a separator before the Admin link", () => {
    const { container } = render(
      <ProfileButton email="alice@example.com" isAdmin={true} />,
    );
    fireEvent.click(screen.getByTitle("alice@example.com"));
    expect(
      container.querySelector(".profile-dropdown-separator"),
    ).toBeInTheDocument();
  });
});
