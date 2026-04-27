// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createXyflowMock,
  mockGetNodes,
  mockGetNodesBounds,
} from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());
vi.mock("@lib/validation", () => ({
  fetchApi: vi.fn(),
  DiagramResponseSchema: {},
  GraphDataSchema: {
    parse: (data: any) => ({
      nodes: data?.nodes ?? [],
      edges: data?.edges ?? [],
      viewport: data?.viewport ?? { x: 0, y: 0, zoom: 1 },
    }),
  },
  ShareResponseSchema: {},
}));
vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
  toSvg: vi.fn(),
}));

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import DiagramCanvas from "@islands/DiagramCanvas";
import { useDiagramStore } from "@islands/store/diagramStore";
import { resetStore } from "../../helpers/render-helpers";
import { fetchApi } from "@lib/validation";

const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

const sampleInitialData = {
  title: "Test Diagram",
  description: "Test desc",
  graphData: JSON.stringify({
    nodes: [
      {
        id: "n1",
        type: "cf-node",
        position: { x: 0, y: 0 },
        data: { typeId: "worker", label: "W" },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }),
};

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
});

describe("DiagramCanvas", () => {
  describe("data loading", () => {
    it("loads from initialData prop and populates store", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      const state = useDiagramStore.getState();
      expect(state.diagramId).toBe("diag-1");
      expect(state.title).toBe("Test Diagram");
      expect(state.nodes).toHaveLength(1);
    });

    it("falls back to API fetch when initialData is absent", async () => {
      mockFetchApi.mockResolvedValueOnce({
        ok: true,
        data: {
          title: "Fetched",
          description: "desc",
          graphData: JSON.stringify({
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          }),
        },
      });

      render(<DiagramCanvas diagramId="diag-2" />);

      await waitFor(() => {
        expect(mockFetchApi).toHaveBeenCalledWith(
          "/api/v1/diagrams/diag-2",
          expect.anything(),
        );
      });
    });
  });

  describe("edit mode layout", () => {
    it("renders Toolbar in edit mode", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      expect(screen.getByTitle("Back to Dashboard")).toBeInTheDocument();
    });

    it("renders ServicePalette in edit mode", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      expect(screen.getByText("Services")).toBeInTheDocument();
    });

    it("renders PropertiesPanel in edit mode", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      expect(
        screen.getByText("Select a node or edge to view its properties"),
      ).toBeInTheDocument();
    });

    it("renders StatusBar in edit mode", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      expect(screen.getByText(/nodes,/)).toBeInTheDocument();
    });

    it("renders ReactFlow canvas", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
  });

  describe("read-only mode", () => {
    it("renders simplified Toolbar in read-only mode (no editing controls)", () => {
      render(
        <DiagramCanvas
          diagramId="diag-1"
          readOnly={true}
          initialData={sampleInitialData}
        />,
      );
      expect(screen.getByTitle("Back to Dashboard")).toBeInTheDocument();
      expect(screen.getByTitle("Export")).toBeInTheDocument();
      expect(screen.queryByTitle("Undo (Ctrl+Z)")).toBeNull();
      expect(screen.queryByTitle("Share")).toBeNull();
    });

    it("hides ServicePalette in read-only mode", () => {
      render(
        <DiagramCanvas
          diagramId="diag-1"
          readOnly={true}
          initialData={sampleInitialData}
        />,
      );
      expect(screen.queryByText("Services")).toBeNull();
    });

    it("hides PropertiesPanel in read-only mode", () => {
      render(
        <DiagramCanvas
          diagramId="diag-1"
          readOnly={true}
          initialData={sampleInitialData}
        />,
      );
      expect(
        screen.queryByText("Select a node or edge to view its properties"),
      ).toBeNull();
    });

    it("still renders StatusBar in read-only mode", () => {
      render(
        <DiagramCanvas
          diagramId="diag-1"
          readOnly={true}
          initialData={sampleInitialData}
        />,
      );
      expect(screen.getByText("Read-only")).toBeInTheDocument();
    });
  });

  describe("keyboard shortcuts", () => {
    it("Delete key calls removeSelected", () => {
      useDiagramStore.setState({
        diagramId: "diag-1",
        nodes: [
          {
            id: "n1",
            type: "cf-node",
            position: { x: 0, y: 0 },
            data: { typeId: "worker", label: "W" },
            selected: true,
          },
        ] as any,
        edges: [],
      });

      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      const editor = document.querySelector(".diagram-editor")!;
      fireEvent.keyDown(editor, { key: "Delete" });

      expect(useDiagramStore.getState().selectedNodeId).toBeNull();
    });

    it("Ctrl+Z calls undo", () => {
      useDiagramStore.setState({
        diagramId: "diag-1",
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

      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      const editor = document.querySelector(".diagram-editor")!;
      fireEvent.keyDown(editor, { key: "z", ctrlKey: true });

      expect(useDiagramStore.getState().undoStack).toHaveLength(0);
    });

    it("Ctrl+Shift+Z calls redo", () => {
      useDiagramStore.setState({
        diagramId: "diag-1",
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

      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      const editor = document.querySelector(".diagram-editor")!;
      fireEvent.keyDown(editor, { key: "Z", ctrlKey: true, shiftKey: true });

      expect(useDiagramStore.getState().redoStack).toHaveLength(0);
    });

    it("Delete key inside an input element does not call removeSelected", () => {
      useDiagramStore.setState({
        diagramId: "diag-1",
        nodes: [
          {
            id: "n1",
            type: "cf-node",
            position: { x: 0, y: 0 },
            data: { typeId: "worker", label: "W" },
            selected: true,
          },
        ] as any,
        edges: [],
      });

      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      const input = document.createElement("input");
      const editor = document.querySelector(".diagram-editor")!;
      editor.appendChild(input);

      fireEvent.keyDown(input, { key: "Delete", bubbles: true });

      // Node should still be present — removeSelected must not have fired.
      expect(useDiagramStore.getState().nodes).toHaveLength(1);
    });

    it("Backspace key inside a textarea element does not call removeSelected", () => {
      useDiagramStore.setState({
        diagramId: "diag-1",
        nodes: [
          {
            id: "n1",
            type: "cf-node",
            position: { x: 0, y: 0 },
            data: { typeId: "worker", label: "W" },
            selected: true,
          },
        ] as any,
        edges: [],
      });

      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      const textarea = document.createElement("textarea");
      const editor = document.querySelector(".diagram-editor")!;
      editor.appendChild(textarea);

      fireEvent.keyDown(textarea, { key: "Backspace", bubbles: true });

      // Node should still be present — removeSelected must not have fired.
      expect(useDiagramStore.getState().nodes).toHaveLength(1);
    });

    it("keyboard shortcuts are no-ops in read-only mode", () => {
      render(
        <DiagramCanvas
          diagramId="diag-1"
          readOnly={true}
          initialData={sampleInitialData}
        />,
      );

      act(() => {
        useDiagramStore.setState({
          nodes: [
            {
              id: "n1",
              type: "cf-node",
              position: { x: 0, y: 0 },
              data: { typeId: "worker", label: "W" },
              selected: true,
            },
          ] as any,
          edges: [],
          undoStack: [{ nodes: [], edges: [] }],
        });
      });

      const editor = document.querySelector(".diagram-editor")!;
      fireEvent.keyDown(editor, { key: "Delete" });
      fireEvent.keyDown(editor, { key: "z", ctrlKey: true });

      expect(useDiagramStore.getState().nodes).toHaveLength(1);
      expect(useDiagramStore.getState().undoStack).toHaveLength(1);
    });
  });

  describe("React Flow callbacks", () => {
    it("onNodeClick sets selectedNodeId", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      fireEvent.click(screen.getByTestId("rf-node-click"));
      expect(useDiagramStore.getState().selectedNodeId).toBe("test-node");
    });

    it("onEdgeClick sets selectedEdgeId", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      fireEvent.click(screen.getByTestId("rf-edge-click"));
      expect(useDiagramStore.getState().selectedEdgeId).toBe("test-edge");
    });

    it("onPaneClick clears selection", () => {
      useDiagramStore.setState({
        selectedNodeId: "n1",
        selectedEdgeId: "e1",
      });
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      fireEvent.click(screen.getByTestId("rf-pane-click"));
      expect(useDiagramStore.getState().selectedNodeId).toBeNull();
      expect(useDiagramStore.getState().selectedEdgeId).toBeNull();
    });

    it("onDragOver sets dropEffect to move", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      const canvas = screen.getByTestId("react-flow");
      const dataTransfer = { dropEffect: "" };
      const event = new Event("dragover", {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      canvas.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(dataTransfer.dropEffect).toBe("move");
    });

    it("onDrop creates a node from palette data", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      const canvas = screen.getByTestId("react-flow");
      const nodesBefore = useDiagramStore.getState().nodes.length;
      fireEvent.drop(canvas, {
        clientX: 100,
        clientY: 200,
        dataTransfer: {
          getData: (type: string) =>
            type === "application/cf-node-type" ? "worker" : "",
        },
      });
      expect(useDiagramStore.getState().nodes.length).toBe(nodesBefore + 1);
    });

    it("onDrop ignores unknown typeId", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      const canvas = screen.getByTestId("react-flow");
      const nodesBefore = useDiagramStore.getState().nodes.length;
      fireEvent.drop(canvas, {
        clientX: 100,
        clientY: 200,
        dataTransfer: {
          getData: () => "nonexistent-type",
        },
      });
      expect(useDiagramStore.getState().nodes.length).toBe(nodesBefore);
    });

    it("onDrop ignores empty typeId", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      const canvas = screen.getByTestId("react-flow");
      const nodesBefore = useDiagramStore.getState().nodes.length;
      fireEvent.drop(canvas, {
        clientX: 100,
        clientY: 200,
        dataTransfer: {
          getData: () => "",
        },
      });
      expect(useDiagramStore.getState().nodes.length).toBe(nodesBefore);
    });
  });

  describe("autosave", () => {
    it("saves graph data when dirty flag is set", async () => {
      vi.useFakeTimers();
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("{}", { status: 200 }));

      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      act(() => {
        useDiagramStore.setState({ dirty: true });
      });

      await act(async () => {
        vi.advanceTimersByTime(600);
        await Promise.resolve();
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/v1/diagrams/diag-1/graph",
        expect.objectContaining({ method: "PUT" }),
      );
      vi.useRealTimers();
    });

    it("marks save error on failed response", async () => {
      vi.useFakeTimers();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("error", { status: 500 }),
      );

      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      act(() => {
        useDiagramStore.setState({ dirty: true });
      });

      await act(async () => {
        vi.advanceTimersByTime(600);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(useDiagramStore.getState().saveError).toBe("Failed to save");
      vi.useRealTimers();
    });

    it("marks save error on network error", async () => {
      vi.useFakeTimers();
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      act(() => {
        useDiagramStore.setState({ dirty: true });
      });

      await act(async () => {
        vi.advanceTimersByTime(600);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(useDiagramStore.getState().saveError).toBe("Network error");
      vi.useRealTimers();
    });

    it("does not autosave in read-only mode", async () => {
      vi.useFakeTimers();
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("{}"));

      render(
        <DiagramCanvas
          diagramId="diag-1"
          readOnly
          initialData={sampleInitialData}
        />,
      );

      act(() => {
        useDiagramStore.setState({ dirty: true });
      });

      await act(async () => {
        vi.advanceTimersByTime(600);
        await Promise.resolve();
      });

      const graphCalls = fetchSpy.mock.calls.filter(
        (c) => typeof c[0] === "string" && c[0].includes("/graph"),
      );
      expect(graphCalls).toHaveLength(0);
      vi.useRealTimers();
    });
  });

  describe("title save", () => {
    it("PATCHes title changes to API after debounce", async () => {
      vi.useFakeTimers();
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("{}"));

      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      act(() => {
        useDiagramStore.setState({ title: "New Title" });
      });

      await act(async () => {
        vi.advanceTimersByTime(1100);
        await Promise.resolve();
      });

      const patchCalls = fetchSpy.mock.calls.filter(
        (c) =>
          typeof c[0] === "string" &&
          c[0] === "/api/v1/diagrams/diag-1" &&
          (c[1] as RequestInit)?.method === "PATCH",
      );
      expect(patchCalls.length).toBeGreaterThan(0);
      vi.useRealTimers();
    });
  });

  describe("window event handlers", () => {
    it("beforeunload calls preventDefault when dirty", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      act(() => {
        useDiagramStore.setState({ dirty: true });
      });
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it("beforeunload does not preventDefault when not dirty", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      act(() => {
        useDiagramStore.setState({ dirty: false });
      });
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });

    it("afterprint exits print mode and restores dark class", () => {
      window.print = vi.fn();
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        cb(0);
        return 0;
      });

      document.documentElement.classList.add("dark");
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      act(() => {
        useDiagramStore.setState({ printMode: true });
      });

      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.body.classList.contains("cf-print-mode")).toBe(true);

      act(() => {
        window.dispatchEvent(new Event("afterprint"));
      });

      expect(useDiagramStore.getState().printMode).toBe(false);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.body.classList.contains("cf-print-mode")).toBe(false);
      expect(document.getElementById("cf-print-orientation")).toBeNull();
    });
  });

  describe("drag and drop", () => {
    it("adds a node on drop from palette", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      const canvas = screen.getByTestId("react-flow");
      fireEvent.dragOver(canvas, {
        preventDefault: vi.fn(),
        dataTransfer: { dropEffect: "" },
      });
      fireEvent.drop(canvas, {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
        dataTransfer: {
          getData: (type: string) =>
            type === "application/cf-node-type" ? "worker" : "",
        },
      });

      const nodes = useDiagramStore.getState().nodes;
      expect(nodes.length).toBeGreaterThanOrEqual(1);
    });

    it("ignores drop with empty typeId", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );

      const nodesBefore = useDiagramStore.getState().nodes.length;
      const canvas = screen.getByTestId("react-flow");
      fireEvent.drop(canvas, {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
        dataTransfer: { getData: () => "" },
      });

      expect(useDiagramStore.getState().nodes.length).toBe(nodesBefore);
    });
  });

  describe("print mode", () => {
    beforeEach(() => {
      window.print = vi.fn();
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        cb(0);
        return 0;
      });
    });

    it("hides toolbar when printMode is true", () => {
      useDiagramStore.setState({ printMode: true });
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      expect(screen.queryByTitle("Back to Dashboard")).toBeNull();
    });

    it("hides status bar when printMode is true", () => {
      useDiagramStore.setState({ printMode: true });
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      expect(screen.queryByText(/nodes,/)).toBeNull();
    });

    it("hides service palette when printMode is true", () => {
      useDiagramStore.setState({ printMode: true });
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      expect(screen.queryByText("Services")).toBeNull();
    });

    it("shows print title overlay with diagram title", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      act(() => {
        useDiagramStore.setState({ printMode: true, title: "My Print Title" });
      });
      expect(screen.getByText("My Print Title")).toBeInTheDocument();
    });

    it("shows description in print overlay when present", () => {
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      act(() => {
        useDiagramStore.setState({
          printMode: true,
          title: "T",
          description: "A test description",
        });
      });
      expect(screen.getByText("A test description")).toBeInTheDocument();
    });

    it("renders exit print mode button", () => {
      useDiagramStore.setState({ printMode: true });
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      expect(screen.getByTitle("Exit Print Mode")).toBeInTheDocument();
    });

    it("clicking exit button sets printMode to false", () => {
      useDiagramStore.setState({ printMode: true });
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      fireEvent.click(screen.getByTitle("Exit Print Mode"));
      expect(useDiagramStore.getState().printMode).toBe(false);
    });

    it("adds print-mode class to editor container", () => {
      useDiagramStore.setState({ printMode: true });
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      expect(document.querySelector(".print-mode")).not.toBeNull();
    });

    it("adds cf-print-mode class to body and creates orientation style", () => {
      useDiagramStore.setState({ printMode: true });
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      expect(document.body.classList.contains("cf-print-mode")).toBe(true);
      expect(document.getElementById("cf-print-orientation")).not.toBeNull();
    });

    it("calls window.print after entering print mode", () => {
      vi.useFakeTimers();
      useDiagramStore.setState({ printMode: true });
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      vi.advanceTimersByTime(400);
      expect(window.print).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("uses landscape orientation when bounds are wider than tall", () => {
      mockGetNodes.mockReturnValue([{ id: "n1" }]);
      mockGetNodesBounds.mockReturnValue({
        x: 0,
        y: 0,
        width: 800,
        height: 400,
      });
      useDiagramStore.setState({ printMode: true });
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      const styleEl = document.getElementById("cf-print-orientation");
      expect(styleEl).not.toBeNull();
      expect(styleEl!.textContent).toContain("landscape");
    });

    it("uses portrait orientation when bounds are taller than wide", () => {
      mockGetNodes.mockReturnValue([{ id: "n1" }]);
      mockGetNodesBounds.mockReturnValue({
        x: 0,
        y: 0,
        width: 300,
        height: 600,
      });
      useDiagramStore.setState({ printMode: true });
      render(
        <DiagramCanvas diagramId="diag-1" initialData={sampleInitialData} />,
      );
      const styleEl = document.getElementById("cf-print-orientation");
      expect(styleEl).not.toBeNull();
      expect(styleEl!.textContent).toContain("portrait");
    });
  });
});
