// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

vi.mock("@lib/validation", () => ({
  fetchApi: vi.fn(),
  DiagramListResponseSchema: {},
  DiagramResponseSchema: {},
}));

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DiagramList from "@islands/dashboard/DiagramList";
import { fetchApi } from "@lib/validation";

const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

const DIAGRAMS = [
  {
    id: "d1",
    title: "First Diagram",
    description: "",
    graphData: "{}",
    createdAt: "2025-06-15T10:00:00Z",
    updatedAt: "2025-06-15T12:30:00Z",
  },
  {
    id: "d2",
    title: "Second Diagram",
    description: "",
    graphData: "{}",
    createdAt: "2025-06-14T08:00:00Z",
    updatedAt: "2025-06-14T09:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
});

describe("DiagramList", () => {
  it("shows loading state initially", () => {
    mockFetchApi.mockReturnValue(new Promise(() => {}));
    render(<DiagramList />);
    expect(screen.getByText("Loading diagrams...")).toBeInTheDocument();
  });

  it("shows empty state when no diagrams", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: [] });
    render(<DiagramList />);

    await waitFor(() => {
      expect(screen.getByText("No diagrams yet")).toBeInTheDocument();
    });
    expect(screen.getByText("+ New Diagram")).toBeInTheDocument();
  });

  it("renders diagram cards with titles", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    render(<DiagramList />);

    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });
    expect(screen.getByText("Second Diagram")).toBeInTheDocument();
  });

  it("renders clock icon with date tooltip on cards", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    render(<DiagramList />);

    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });
    const tooltips = document.querySelectorAll(".diagram-card-clock-tooltip");
    expect(tooltips).toHaveLength(2);
    expect(tooltips[0].textContent).toMatch(/Created:/);
    expect(tooltips[0].textContent).toMatch(/Updated:/);
  });

  it("shows '+ New Diagram' link in header when diagrams exist", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    render(<DiagramList />);

    await waitFor(() => {
      expect(screen.getByText("My Diagrams")).toBeInTheDocument();
    });
    const link = screen.getByText("+ New Diagram");
    expect(link.closest("a")).toHaveAttribute("href", "/blueprints");
  });

  it("'+ New Diagram' links to /blueprints in empty state", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: [] });
    render(<DiagramList />);

    await waitFor(() => {
      expect(screen.getByText("No diagrams yet")).toBeInTheDocument();
    });
    const link = screen.getByText("+ New Diagram");
    expect(link.closest("a")).toHaveAttribute("href", "/blueprints");
  });

  it("opens delete confirmation modal when Delete is clicked via menu", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    render(<DiagramList />);
    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    const menuBtns = screen.getAllByTestId("card-menu-btn");
    fireEvent.click(menuBtns[0]);

    const deleteBtn = screen.getAllByText("Delete")[0];
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId("confirm-delete-modal")).toBeInTheDocument();
    expect(screen.getByText("Delete Diagram")).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete/),
    ).toBeInTheDocument();
  });

  it("deletes a diagram after confirming in the modal", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));

    render(<DiagramList />);
    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    const menuBtns = screen.getAllByTestId("card-menu-btn");
    fireEvent.click(menuBtns[0]);

    const deleteBtn = screen.getAllByText("Delete")[0];
    fireEvent.click(deleteBtn);

    const modal = screen.getByTestId("confirm-delete-modal");
    const confirmBtn = modal.querySelector(
      ".toolbar-btn-danger",
    ) as HTMLElement;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/v1/diagrams/d1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    expect(screen.queryByText("First Diagram")).toBeNull();
    expect(
      screen.queryByTestId("confirm-delete-modal"),
    ).not.toBeInTheDocument();
  });

  it("does not delete when Cancel is clicked in the modal", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));

    render(<DiagramList />);
    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    const menuBtns = screen.getAllByTestId("card-menu-btn");
    fireEvent.click(menuBtns[0]);

    const deleteBtn = screen.getAllByText("Delete")[0];
    fireEvent.click(deleteBtn);

    fireEvent.click(screen.getByText("Cancel"));

    expect(fetchSpy).not.toHaveBeenCalledWith(
      "/api/v1/diagrams/d1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(screen.getByText("First Diagram")).toBeInTheDocument();
    expect(
      screen.queryByTestId("confirm-delete-modal"),
    ).not.toBeInTheDocument();
  });

  it("closes the modal when overlay is clicked", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    render(<DiagramList />);
    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    const menuBtns = screen.getAllByTestId("card-menu-btn");
    fireEvent.click(menuBtns[0]);

    const deleteBtn = screen.getAllByText("Delete")[0];
    fireEvent.click(deleteBtn);

    const overlay = screen.getByTestId("confirm-delete-modal");
    fireEvent.click(overlay);

    expect(
      screen.queryByTestId("confirm-delete-modal"),
    ).not.toBeInTheDocument();
  });

  it("duplicates a diagram via menu", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });

    render(<DiagramList />);
    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    mockFetchApi
      .mockResolvedValueOnce({
        ok: true,
        data: { ...DIAGRAMS[0], graphData: '{"nodes":[],"edges":[]}' },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { id: "d3", title: "First Diagram (copy)" },
      })
      .mockResolvedValueOnce({ ok: true, data: DIAGRAMS });

    const menuBtns = screen.getAllByTestId("card-menu-btn");
    fireEvent.click(menuBtns[0]);

    const duplicateBtn = screen.getAllByText("Duplicate")[0];
    fireEvent.click(duplicateBtn);

    await waitFor(() => {
      expect(mockFetchApi).toHaveBeenCalledWith(
        "/api/v1/diagrams/d1",
        expect.anything(),
      );
    });
  });

  it("renders a visual preview for each diagram card", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    render(<DiagramList />);

    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    const previews = screen.getAllByTestId("blueprint-preview");
    expect(previews).toHaveLength(DIAGRAMS.length);
  });

  it("renders diagram card links to editor", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    render(<DiagramList />);

    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    const card = screen.getByText("First Diagram").closest("a");
    expect(card).toHaveAttribute("href", "/diagram/d1");
    expect(card).toHaveClass("diagram-card");
  });

  it("opens and closes kebab menu", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    render(<DiagramList />);
    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    const menuBtns = screen.getAllByTestId("card-menu-btn");
    fireEvent.click(menuBtns[0]);
    expect(screen.getByTestId("card-dropdown")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Duplicate")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId("card-dropdown")).not.toBeInTheDocument();
  });

  it("closes kebab menu on Escape key", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    render(<DiagramList />);
    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    const menuBtns = screen.getAllByTestId("card-menu-btn");
    fireEvent.click(menuBtns[0]);
    expect(screen.getByTestId("card-dropdown")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("card-dropdown")).not.toBeInTheDocument();
  });
});
