// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockToPng, mockToSvg, mockTriggerDownload } = vi.hoisted(() => ({
  mockToPng: vi.fn().mockResolvedValue("data:image/png;base64,abc"),
  mockToSvg: vi.fn().mockResolvedValue("data:image/svg+xml,<svg/>"),
  mockTriggerDownload: vi.fn(),
}));

import {
  createXyflowMock,
  mockGetNodes,
  mockGetNodesBounds,
  mockGetViewportForBounds,
} from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

vi.mock("html-to-image", () => ({
  toPng: mockToPng,
  toSvg: mockToSvg,
}));

vi.mock("@lib/export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lib/export")>();
  return {
    ...actual,
    triggerDownload: mockTriggerDownload,
  };
});

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { ExportButton } from "@islands/toolbar/ExportButton";
import { useDiagramStore } from "@islands/store/diagramStore";
import { resetStore } from "../../helpers/render-helpers";

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
  mockToPng.mockResolvedValue("data:image/png;base64,abc");
  mockToSvg.mockResolvedValue("data:image/svg+xml,<svg/>");
  document.body.innerHTML = "";
});

describe("ExportButton", () => {
  it("renders with the Export title", () => {
    render(<ExportButton />);
    expect(screen.getByTitle("Export")).toBeInTheDocument();
  });

  it("opens dropdown on click", () => {
    render(<ExportButton />);
    fireEvent.click(screen.getByTitle("Export"));
    expect(screen.getByText("Export as PNG")).toBeInTheDocument();
    expect(screen.getByText("Export as SVG")).toBeInTheDocument();
  });

  it("closes dropdown on second click (toggle)", () => {
    render(<ExportButton />);
    const btn = screen.getByTitle("Export");
    fireEvent.click(btn);
    expect(screen.getByText("Export as PNG")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText("Export as PNG")).toBeNull();
  });

  it("closes dropdown on outside mousedown", () => {
    render(
      <div>
        <ExportButton />
        <div data-testid="outside">outside</div>
      </div>,
    );
    fireEvent.click(screen.getByTitle("Export"));
    expect(screen.getByText("Export as PNG")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByText("Export as PNG")).toBeNull();
  });

  it("does nothing when there are no nodes", async () => {
    mockGetNodes.mockReturnValue([]);
    render(<ExportButton />);
    fireEvent.click(screen.getByTitle("Export"));
    fireEvent.click(screen.getByText("Export as PNG"));

    await waitFor(() => {
      expect(mockToPng).not.toHaveBeenCalled();
    });
  });

  it("exports PNG when nodes exist", async () => {
    const fakeNodes = [
      { id: "n1", position: { x: 0, y: 0 }, data: { label: "A" } },
    ];
    mockGetNodes.mockReturnValue(fakeNodes);
    mockGetNodesBounds.mockReturnValue({ x: 0, y: 0, width: 200, height: 150 });
    mockGetViewportForBounds.mockReturnValue({ x: 10, y: 10, zoom: 1 });
    useDiagramStore.setState({ title: "Test Diagram" });

    const viewportEl = document.createElement("div");
    viewportEl.className = "react-flow__viewport";
    document.body.appendChild(viewportEl);

    render(<ExportButton />);
    fireEvent.click(screen.getByTitle("Export"));
    fireEvent.click(screen.getByText("Export as PNG"));

    await waitFor(() => {
      expect(mockToPng).toHaveBeenCalledTimes(1);
    });

    expect(mockGetNodesBounds).toHaveBeenCalledWith(fakeNodes);
    expect(mockGetViewportForBounds).toHaveBeenCalled();
    expect(mockTriggerDownload).toHaveBeenCalledWith(
      "data:image/png;base64,abc",
      expect.stringMatching(/^Test_Diagram_.*\.png$/),
    );
  });

  it("exports SVG when nodes exist", async () => {
    const fakeNodes = [
      { id: "n1", position: { x: 0, y: 0 }, data: { label: "A" } },
    ];
    mockGetNodes.mockReturnValue(fakeNodes);
    mockGetNodesBounds.mockReturnValue({ x: 0, y: 0, width: 200, height: 150 });
    mockGetViewportForBounds.mockReturnValue({ x: 10, y: 10, zoom: 1 });
    useDiagramStore.setState({ title: "My SVG" });

    const viewportEl = document.createElement("div");
    viewportEl.className = "react-flow__viewport";
    document.body.appendChild(viewportEl);

    render(<ExportButton />);
    fireEvent.click(screen.getByTitle("Export"));
    fireEvent.click(screen.getByText("Export as SVG"));

    await waitFor(() => {
      expect(mockToSvg).toHaveBeenCalledTimes(1);
    });

    expect(mockTriggerDownload).toHaveBeenCalledWith(
      "data:image/svg+xml,<svg/>",
      expect.stringMatching(/^My_SVG_.*\.svg$/),
    );
  });

  it("handles export failure gracefully", async () => {
    const fakeNodes = [
      { id: "n1", position: { x: 0, y: 0 }, data: { label: "A" } },
    ];
    mockGetNodes.mockReturnValue(fakeNodes);
    mockGetNodesBounds.mockReturnValue({ x: 0, y: 0, width: 200, height: 150 });
    mockGetViewportForBounds.mockReturnValue({ x: 10, y: 10, zoom: 1 });
    mockToPng.mockRejectedValueOnce(new Error("Canvas tainted"));

    const viewportEl = document.createElement("div");
    viewportEl.className = "react-flow__viewport";
    document.body.appendChild(viewportEl);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<ExportButton />);
    fireEvent.click(screen.getByTitle("Export"));
    fireEvent.click(screen.getByText("Export as PNG"));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        "Export failed:",
        expect.any(Error),
      );
    });

    expect(mockTriggerDownload).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("does nothing when viewport element is missing", async () => {
    const fakeNodes = [
      { id: "n1", position: { x: 0, y: 0 }, data: { label: "A" } },
    ];
    mockGetNodes.mockReturnValue(fakeNodes);
    mockGetNodesBounds.mockReturnValue({ x: 0, y: 0, width: 200, height: 150 });
    mockGetViewportForBounds.mockReturnValue({ x: 10, y: 10, zoom: 1 });

    render(<ExportButton />);
    fireEvent.click(screen.getByTitle("Export"));
    fireEvent.click(screen.getByText("Export as PNG"));

    await waitFor(() => {
      expect(mockGetNodesBounds).toHaveBeenCalled();
    });
    expect(mockToPng).not.toHaveBeenCalled();
  });

  it("disables button while exporting", async () => {
    let resolveCapture!: (value: string) => void;
    mockToPng.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveCapture = resolve;
      }),
    );

    const fakeNodes = [
      { id: "n1", position: { x: 0, y: 0 }, data: { label: "A" } },
    ];
    mockGetNodes.mockReturnValue(fakeNodes);
    mockGetNodesBounds.mockReturnValue({ x: 0, y: 0, width: 200, height: 150 });
    mockGetViewportForBounds.mockReturnValue({ x: 10, y: 10, zoom: 1 });

    const viewportEl = document.createElement("div");
    viewportEl.className = "react-flow__viewport";
    document.body.appendChild(viewportEl);

    render(<ExportButton />);
    fireEvent.click(screen.getByTitle("Export"));
    fireEvent.click(screen.getByText("Export as PNG"));

    await waitFor(() => {
      expect(screen.getByTitle("Export")).toBeDisabled();
    });
    expect(screen.getByTitle("Export").textContent).toBe("...");

    act(() => {
      resolveCapture("data:image/png;base64,abc");
    });

    await waitFor(() => {
      expect(screen.getByTitle("Export")).not.toBeDisabled();
    });
  });

  it("uses minimum dimensions when diagram is small", async () => {
    const fakeNodes = [
      { id: "n1", position: { x: 0, y: 0 }, data: { label: "A" } },
    ];
    mockGetNodes.mockReturnValue(fakeNodes);
    mockGetNodesBounds.mockReturnValue({ x: 0, y: 0, width: 50, height: 50 });
    mockGetViewportForBounds.mockReturnValue({ x: 10, y: 10, zoom: 1 });

    const viewportEl = document.createElement("div");
    viewportEl.className = "react-flow__viewport";
    document.body.appendChild(viewportEl);

    render(<ExportButton />);
    fireEvent.click(screen.getByTitle("Export"));
    fireEvent.click(screen.getByText("Export as PNG"));

    await waitFor(() => {
      expect(mockGetViewportForBounds).toHaveBeenCalledWith(
        { x: 0, y: 0, width: 50, height: 50 },
        400,
        400,
        0.5,
        2,
        0.25,
      );
    });
  });
});
