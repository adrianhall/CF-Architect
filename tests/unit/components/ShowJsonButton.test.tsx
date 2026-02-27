// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  ShowJsonButton,
  buildBlueprintJson,
} from "@islands/toolbar/ShowJsonButton";
import { useDiagramStore } from "@islands/store/diagramStore";
import { resetStore } from "../../helpers/render-helpers";

beforeEach(() => {
  resetStore();
});

const SAMPLE_NODES = [
  {
    id: "n1",
    type: "cf-node",
    position: { x: 0, y: 0 },
    data: { typeId: "worker", label: "My Worker" },
  },
] as any;

const SAMPLE_EDGES = [
  {
    id: "e1",
    source: "n1",
    target: "n2",
    type: "cf-edge",
    data: { edgeType: "data-flow" },
  },
] as any;

describe("buildBlueprintJson", () => {
  it("serialises nodes, edges, and viewport as formatted JSON", () => {
    const viewport = { x: 10, y: 20, zoom: 1.5 };
    const result = buildBlueprintJson(SAMPLE_NODES, SAMPLE_EDGES, viewport);
    const parsed = JSON.parse(result);

    expect(parsed).toEqual({
      nodes: SAMPLE_NODES,
      edges: SAMPLE_EDGES,
      viewport,
    });
    expect(result).toContain("\n");
  });

  it("returns valid JSON for empty diagram", () => {
    const result = buildBlueprintJson([], [], { x: 0, y: 0, zoom: 1 });
    const parsed = JSON.parse(result);
    expect(parsed.nodes).toEqual([]);
    expect(parsed.edges).toEqual([]);
    expect(parsed.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

describe("ShowJsonButton", () => {
  it("renders an icon button with 'Show JSON' title", () => {
    render(<ShowJsonButton />);
    expect(screen.getByTitle("Show JSON")).toBeInTheDocument();
  });

  it("does not show modal initially", () => {
    render(<ShowJsonButton />);
    expect(screen.queryByTestId("json-modal")).toBeNull();
  });

  it("opens modal on click", () => {
    render(<ShowJsonButton />);
    fireEvent.click(screen.getByTitle("Show JSON"));
    expect(screen.getByTestId("json-modal")).toBeInTheDocument();
    expect(screen.getByText("Diagram JSON")).toBeInTheDocument();
  });

  it("displays the current diagram JSON in the modal", () => {
    useDiagramStore.setState({
      nodes: SAMPLE_NODES,
      edges: SAMPLE_EDGES,
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    render(<ShowJsonButton />);
    fireEvent.click(screen.getByTitle("Show JSON"));

    const output = screen.getByTestId("json-output");
    const parsed = JSON.parse(output.textContent);
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0].id).toBe("n1");
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.edges[0].id).toBe("e1");
  });

  it("closes modal when Close button is clicked", () => {
    render(<ShowJsonButton />);
    fireEvent.click(screen.getByTitle("Show JSON"));
    expect(screen.getByTestId("json-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close"));
    expect(screen.queryByTestId("json-modal")).toBeNull();
  });

  it("closes modal when X button is clicked", () => {
    render(<ShowJsonButton />);
    fireEvent.click(screen.getByTitle("Show JSON"));
    expect(screen.getByTestId("json-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByTestId("json-modal")).toBeNull();
  });

  it("closes modal when overlay is clicked", () => {
    render(<ShowJsonButton />);
    fireEvent.click(screen.getByTitle("Show JSON"));

    const overlay = screen.getByTestId("json-modal");
    fireEvent.click(overlay);
    expect(screen.queryByTestId("json-modal")).toBeNull();
  });

  it("does not close modal when clicking inside the modal content", () => {
    render(<ShowJsonButton />);
    fireEvent.click(screen.getByTitle("Show JSON"));

    fireEvent.click(screen.getByText("Diagram JSON"));
    expect(screen.getByTestId("json-modal")).toBeInTheDocument();
  });

  it("copies JSON to clipboard and shows confirmation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    useDiagramStore.setState({
      nodes: SAMPLE_NODES,
      edges: SAMPLE_EDGES,
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    render(<ShowJsonButton />);
    fireEvent.click(screen.getByTitle("Show JSON"));
    fireEvent.click(screen.getByText("Copy to Clipboard"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    const clipboardArg = writeText.mock.calls[0][0];
    const parsed = JSON.parse(clipboardArg);
    expect(parsed.nodes[0].id).toBe("n1");

    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("handles clipboard failure gracefully", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<ShowJsonButton />);
    fireEvent.click(screen.getByTitle("Show JSON"));
    fireEvent.click(screen.getByText("Copy to Clipboard"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("Copied!")).toBeNull();
  });

  it("shows empty arrays for a blank diagram", () => {
    render(<ShowJsonButton />);
    fireEvent.click(screen.getByTitle("Show JSON"));

    const output = screen.getByTestId("json-output");
    const parsed = JSON.parse(output.textContent);
    expect(parsed.nodes).toEqual([]);
    expect(parsed.edges).toEqual([]);
  });
});
