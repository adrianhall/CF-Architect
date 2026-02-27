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

  it("renders formatted dates on cards", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    render(<DiagramList />);

    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });
    const dateElements = screen.getAllByText(/Updated/);
    expect(dateElements.length).toBe(2);
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

  it("opens delete confirmation modal when Delete is clicked", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    render(<DiagramList />);
    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

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

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

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

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

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

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    const overlay = screen.getByTestId("confirm-delete-modal");
    fireEvent.click(overlay);

    expect(
      screen.queryByTestId("confirm-delete-modal"),
    ).not.toBeInTheDocument();
  });

  it("duplicates a diagram", async () => {
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

    const duplicateButtons = screen.getAllByText("Duplicate");
    fireEvent.click(duplicateButtons[0]);

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

    const link = screen.getByText("First Diagram").closest("a");
    expect(link).toHaveAttribute("href", "/diagram/d1");
  });
});
