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
vi.mock("@lib/preferences", () => ({
  setTheme: vi.fn(),
}));

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { Toolbar } from "@islands/toolbar/Toolbar";
import { useDiagramStore } from "@islands/store/diagramStore";
import { resetStore } from "../../helpers/render-helpers";
import { fetchApi } from "@lib/validation";
import { setTheme } from "@lib/preferences";

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

  it("renders auto-layout button with default TB direction", () => {
    render(<Toolbar />);
    expect(
      screen.getByTitle("Auto Layout (Top to Bottom)"),
    ).toBeInTheDocument();
    expect(screen.getByTitle("Layout direction")).toBeInTheDocument();
  });

  it("shows layout direction dropdown on chevron click", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle("Layout direction"));
    expect(screen.getByText("↓ Top to Bottom")).toBeInTheDocument();
    expect(screen.getByText("→ Left to Right")).toBeInTheDocument();
  });

  it("switches to LR direction when Left to Right is selected", async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle("Layout direction"));
    fireEvent.click(screen.getByText("→ Left to Right"));
    await waitFor(() => {
      expect(
        screen.getByTitle("Auto Layout (Left to Right)"),
      ).toBeInTheDocument();
    });
  });

  it("switches back to TB direction when Top to Bottom is selected", async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTitle("Layout direction"));
    fireEvent.click(screen.getByText("→ Left to Right"));
    await waitFor(() => {
      expect(screen.getByTitle("Layout direction")).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTitle("Layout direction"));
    fireEvent.click(screen.getByText("↓ Top to Bottom"));
    await waitFor(() => {
      expect(
        screen.getByTitle("Auto Layout (Top to Bottom)"),
      ).toBeInTheDocument();
    });
  });

  it("renders the export button", () => {
    render(<Toolbar />);
    expect(screen.getByTitle("Export")).toBeInTheDocument();
  });

  it("renders the print button", () => {
    render(<Toolbar />);
    expect(screen.getByTitle("Print")).toBeInTheDocument();
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
      expect(screen.queryByTitle("Auto Layout (Top to Bottom)")).toBeNull();
      expect(screen.queryByTitle("Layout direction")).toBeNull();
    });

    it("hides the share button", () => {
      render(<Toolbar readOnly />);
      expect(screen.queryByTitle("Share")).toBeNull();
    });

    it("still shows the export button", () => {
      render(<Toolbar readOnly />);
      expect(screen.getByTitle("Export")).toBeInTheDocument();
    });

    it("still shows the print button", () => {
      render(<Toolbar readOnly />);
      expect(screen.getByTitle("Print")).toBeInTheDocument();
    });

    it("still shows the dashboard link", () => {
      render(<Toolbar readOnly />);
      expect(screen.getByTitle("Back to Dashboard")).toHaveAttribute(
        "href",
        "/dashboard",
      );
    });
  });

  it("renders the dark mode toggle", () => {
    render(<Toolbar />);
    expect(screen.getByTitle("Toggle dark mode")).toBeInTheDocument();
  });

  it("toggles dark class on <html> when dark toggle is clicked", async () => {
    document.documentElement.classList.remove("dark");
    render(<Toolbar />);
    const btn = screen.getByTitle("Toggle dark mode");
    expect(btn.textContent).toBe("☾");

    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(setTheme).toHaveBeenCalledWith("dark");

    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  describe("ShareButton", () => {
    const shareUrl = "https://example.com/s/abc123";

    function setupClipboard() {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });
    }

    async function openShareModal() {
      useDiagramStore.setState({ diagramId: "diag-1" });
      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: { url: shareUrl },
      });
      setupClipboard();

      render(<Toolbar />);
      fireEvent.click(screen.getByTitle("Share"));

      await waitFor(() => {
        expect(screen.getByText("Share Diagram")).toBeInTheDocument();
      });
    }

    it("opens modal with share URL on successful share", async () => {
      await openShareModal();
      expect(screen.getByDisplayValue(shareUrl)).toBeInTheDocument();
    });

    it("auto-copies URL to clipboard on share", async () => {
      await openShareModal();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(shareUrl);
    });

    it("closes modal when close button is clicked", async () => {
      await openShareModal();
      fireEvent.click(screen.getByTitle("Close"));
      expect(screen.queryByText("Share Diagram")).toBeNull();
    });

    it("closes modal when overlay is clicked", async () => {
      await openShareModal();
      const overlay = document.querySelector(".modal-overlay")!;
      fireEvent.click(overlay);
      expect(screen.queryByText("Share Diagram")).toBeNull();
    });

    it("does not close modal when inner modal is clicked", async () => {
      await openShareModal();
      const modal = document.querySelector(".modal")!;
      fireEvent.click(modal);
      expect(screen.getByText("Share Diagram")).toBeInTheDocument();
    });

    it("shows toast after clipboard copy", async () => {
      await openShareModal();
      await waitFor(() => {
        expect(screen.getByText("URL Copied!")).toBeInTheDocument();
      });
    });

    it("copies URL when copy button is clicked", async () => {
      await openShareModal();
      const writeMock = vi.mocked(navigator.clipboard.writeText); // eslint-disable-line @typescript-eslint/unbound-method
      writeMock.mockClear();
      fireEvent.click(screen.getByTitle("Copy URL"));
      await waitFor(() => {
        expect(writeMock).toHaveBeenCalledWith(shareUrl);
      });
    });

    it("opens share dropdown with open options", async () => {
      await openShareModal();
      fireEvent.click(screen.getByTitle("Open options"));
      expect(screen.getByText("Open in new tab")).toBeInTheDocument();
      expect(screen.getByText("Open in new window")).toBeInTheDocument();
    });

    it("Open button calls window.open in new tab", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      await openShareModal();
      fireEvent.click(screen.getByText("Open"));
      expect(openSpy).toHaveBeenCalledWith(shareUrl, "_blank");
      openSpy.mockRestore();
    });

    it("Open in new window calls window.open with dimensions", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      await openShareModal();
      fireEvent.click(screen.getByTitle("Open options"));
      fireEvent.click(screen.getByText("Open in new window"));
      expect(openSpy).toHaveBeenCalledWith(
        shareUrl,
        "_blank",
        "width=1024,height=768",
      );
      openSpy.mockRestore();
    });

    it("does nothing when diagramId is null", async () => {
      useDiagramStore.setState({ diagramId: null });
      render(<Toolbar />);
      fireEvent.click(screen.getByTitle("Share"));
      await act(async () => {
        await Promise.resolve();
      });
      expect(fetchApi).not.toHaveBeenCalled();
    });

    it("handles share API error gracefully", async () => {
      useDiagramStore.setState({ diagramId: "diag-1" });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      (fetchApi as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network fail"),
      );

      render(<Toolbar />);
      fireEvent.click(screen.getByTitle("Share"));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Share failed:",
          expect.any(Error),
        );
      });
      consoleSpy.mockRestore();
    });

    it("handles clipboard failure gracefully", async () => {
      useDiagramStore.setState({ diagramId: "diag-1" });
      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: { url: shareUrl },
      });
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: vi.fn().mockRejectedValue(new Error("No clipboard")),
        },
        writable: true,
        configurable: true,
      });

      render(<Toolbar />);
      fireEvent.click(screen.getByTitle("Share"));

      await waitFor(() => {
        expect(screen.getByText("Share Diagram")).toBeInTheDocument();
      });
    });

    it("does not open modal when result is not ok", async () => {
      useDiagramStore.setState({ diagramId: "diag-1" });
      (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        error: "Bad request",
      });

      render(<Toolbar />);
      fireEvent.click(screen.getByTitle("Share"));

      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByText("Share Diagram")).toBeNull();
    });
  });
});
