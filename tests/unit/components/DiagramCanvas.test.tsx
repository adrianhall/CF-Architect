// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

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
  });
});
