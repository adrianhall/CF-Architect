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

  it("deletes a diagram after confirmation", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));

    render(<DiagramList />);
    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/v1/diagrams/d1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    expect(screen.queryByText("First Diagram")).toBeNull();
  });

  it("does not delete when confirmation is cancelled", async () => {
    mockFetchApi.mockResolvedValueOnce({ ok: true, data: DIAGRAMS });
    vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));

    render(<DiagramList />);
    await waitFor(() => {
      expect(screen.getByText("First Diagram")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    expect(fetchSpy).not.toHaveBeenCalledWith(
      "/api/v1/diagrams/d1",
      expect.objectContaining({ method: "DELETE" }),
    );
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
