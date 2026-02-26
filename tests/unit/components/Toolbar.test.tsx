// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createXyflowMock,
  mockFitView,
  mockZoomIn,
  mockZoomOut,
} from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());
vi.mock("@lib/validation", () => ({
  fetchApi: vi.fn(),
  ShareResponseSchema: {},
}));
vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
  toSvg: vi.fn(),
}));

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Toolbar } from "@islands/toolbar/Toolbar";
import { useDiagramStore } from "@islands/store/diagramStore";
import { resetStore } from "../../helpers/render-helpers";
import { fetchApi } from "@lib/validation";

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

describe("Toolbar", () => {
  it("renders title input with current store title", () => {
    useDiagramStore.setState({ title: "My Diagram" });
    render(<Toolbar />);
    expect(screen.getByDisplayValue("My Diagram")).toBeInTheDocument();
  });

  it("updates title in store on input change", () => {
    render(<Toolbar />);
    const input = screen.getByPlaceholderText("Untitled Diagram");
    fireEvent.change(input, { target: { value: "New Title" } });
    expect(useDiagramStore.getState().title).toBe("New Title");
  });

  it("disables undo when undoStack is empty", () => {
    render(<Toolbar />);
    const undoBtn = screen.getByTitle("Undo (Ctrl+Z)");
    expect(undoBtn).toBeDisabled();
  });

  it("disables redo when redoStack is empty", () => {
    render(<Toolbar />);
    const redoBtn = screen.getByTitle("Redo (Ctrl+Shift+Z)");
    expect(redoBtn).toBeDisabled();
  });

  it("enables undo when undoStack has entries", () => {
    useDiagramStore.setState({
      undoStack: [{ nodes: [], edges: [] }],
    });
    render(<Toolbar />);
    const undoBtn = screen.getByTitle("Undo (Ctrl+Z)");
    expect(undoBtn).not.toBeDisabled();
  });

  it("enables redo when redoStack has entries", () => {
    useDiagramStore.setState({
      redoStack: [{ nodes: [], edges: [] }],
    });
    render(<Toolbar />);
    const redoBtn = screen.getByTitle("Redo (Ctrl+Shift+Z)");
    expect(redoBtn).not.toBeDisabled();
  });

  it("calls undo on undo button click", () => {
    useDiagramStore.setState({
      nodes: [
        {
          id: "n1",
          type: "cf-node",
          position: { x: 0, y: 0 },
          data: { typeId: "worker", label: "W" },
        },
      ] as any,
      edges: [],
      undoStack: [{ nodes: [], edges: [] }],
    });
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle("Undo (Ctrl+Z)"));
    expect(useDiagramStore.getState().nodes).toHaveLength(0);
  });

  it("calls redo on redo button click", () => {
    useDiagramStore.setState({
      nodes: [],
      edges: [],
      redoStack: [
        {
          nodes: [
            {
              id: "n1",
              type: "cf-node",
              position: { x: 0, y: 0 },
              data: { typeId: "worker", label: "W" },
            },
          ] as any,
          edges: [],
        },
      ],
    });
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle("Redo (Ctrl+Shift+Z)"));
    expect(useDiagramStore.getState().nodes).toHaveLength(1);
  });

  it("calls zoomIn on zoom-in button click", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle("Zoom In"));
    expect(mockZoomIn).toHaveBeenCalled();
  });

  it("calls zoomOut on zoom-out button click", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle("Zoom Out"));
    expect(mockZoomOut).toHaveBeenCalled();
  });

  it("calls fitView on fit-view button click", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle("Fit View"));
    expect(mockFitView).toHaveBeenCalledWith({ duration: 300 });
  });

  it("has a dashboard link", () => {
    render(<Toolbar />);
    const link = screen.getByTitle("Back to Dashboard");
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("renders the share button", () => {
    render(<Toolbar />);
    expect(screen.getByTitle("Share")).toBeInTheDocument();
  });

  it("renders auto-layout button", () => {
    render(<Toolbar />);
    expect(screen.getByTitle("Auto Layout (ELK)")).toBeInTheDocument();
  });

  it("renders the export button", () => {
    render(<Toolbar />);
    expect(screen.getByTitle("Export")).toBeInTheDocument();
  });

  describe("readOnly mode", () => {
    it("shows title as text instead of input", () => {
      useDiagramStore.setState({ title: "Read Only Title" });
      render(<Toolbar readOnly />);
      expect(screen.getByText("Read Only Title")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Untitled Diagram")).toBeNull();
    });

    it("hides undo, redo, zoom, and layout controls", () => {
      render(<Toolbar readOnly />);
      expect(screen.queryByTitle("Undo (Ctrl+Z)")).toBeNull();
      expect(screen.queryByTitle("Redo (Ctrl+Shift+Z)")).toBeNull();
      expect(screen.queryByTitle("Zoom In")).toBeNull();
      expect(screen.queryByTitle("Zoom Out")).toBeNull();
      expect(screen.queryByTitle("Fit View")).toBeNull();
      expect(screen.queryByTitle("Auto Layout (ELK)")).toBeNull();
    });

    it("hides the share button", () => {
      render(<Toolbar readOnly />);
      expect(screen.queryByTitle("Share")).toBeNull();
    });

    it("still shows the export button", () => {
      render(<Toolbar readOnly />);
      expect(screen.getByTitle("Export")).toBeInTheDocument();
    });

    it("still shows the dashboard link", () => {
      render(<Toolbar readOnly />);
      expect(screen.getByTitle("Back to Dashboard")).toHaveAttribute(
        "href",
        "/dashboard",
      );
    });
  });

  describe("ShareButton", () => {
    it("opens modal with share URL on successful share", async () => {
      useDiagramStore.setState({ diagramId: "diag-1" });
      const mockUrl = "https://example.com/s/abc123";
      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: { url: mockUrl },
      });

      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });

      render(<Toolbar />);
      fireEvent.click(screen.getByTitle("Share"));

      await waitFor(() => {
        expect(screen.getByText("Share Diagram")).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue(mockUrl)).toBeInTheDocument();
    });

    it("closes modal when close button is clicked", async () => {
      useDiagramStore.setState({ diagramId: "diag-1" });
      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: { url: "https://example.com/s/abc" },
      });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });

      render(<Toolbar />);
      fireEvent.click(screen.getByTitle("Share"));

      await waitFor(() => {
        expect(screen.getByText("Share Diagram")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Close"));
      expect(screen.queryByText("Share Diagram")).toBeNull();
    });
  });
});
