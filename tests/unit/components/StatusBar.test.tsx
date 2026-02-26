// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

import React from "react";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "@islands/toolbar/StatusBar";
import { useDiagramStore } from "@islands/store/diagramStore";
import { resetStore } from "../../helpers/render-helpers";

beforeEach(() => {
  resetStore();
});

function renderStatusBar(readOnly = false) {
  return render(<StatusBar readOnly={readOnly} />);
}

describe("StatusBar", () => {
  it("displays node and edge count", () => {
    useDiagramStore.setState({
      nodes: [
        { id: "n1", type: "cf-node", position: { x: 0, y: 0 }, data: { typeId: "worker", label: "W" } },
        { id: "n2", type: "cf-node", position: { x: 0, y: 0 }, data: { typeId: "d1", label: "D" } },
      ] as any,
      edges: [
        { id: "e1", source: "n1", target: "n2", type: "cf-edge", data: { edgeType: "data-flow" } },
      ] as any,
    });
    renderStatusBar();
    expect(screen.getByText("2 nodes, 1 edges")).toBeInTheDocument();
  });

  it("displays zero counts when empty", () => {
    renderStatusBar();
    expect(screen.getByText("0 nodes, 0 edges")).toBeInTheDocument();
  });

  it("shows 'Read-only' when readOnly is true", () => {
    renderStatusBar(true);
    expect(screen.getByText("Read-only")).toBeInTheDocument();
  });

  it("shows 'Saving...' when saving is true", () => {
    useDiagramStore.setState({ saving: true });
    renderStatusBar();
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("shows error text when saveError is set", () => {
    useDiagramStore.setState({ saveError: "Network error" });
    renderStatusBar();
    expect(screen.getByText("Error: Network error")).toBeInTheDocument();
  });

  it("shows 'Unsaved changes' when dirty", () => {
    useDiagramStore.setState({ dirty: true });
    renderStatusBar();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("shows 'Saved just now' when lastSavedAt is very recent", () => {
    useDiagramStore.setState({ lastSavedAt: Date.now() });
    renderStatusBar();
    expect(screen.getByText("Saved just now")).toBeInTheDocument();
  });

  it("shows 'No changes' in default state", () => {
    renderStatusBar();
    expect(screen.getByText("No changes")).toBeInTheDocument();
  });

  it("displays zoom percentage", () => {
    renderStatusBar();
    expect(screen.getByText("Zoom: 100%")).toBeInTheDocument();
  });

  it("prioritizes 'Read-only' over saving status", () => {
    useDiagramStore.setState({ saving: true, dirty: true });
    renderStatusBar(true);
    expect(screen.getByText("Read-only")).toBeInTheDocument();
  });

  it("prioritizes 'Saving...' over dirty", () => {
    useDiagramStore.setState({ saving: true, dirty: true });
    renderStatusBar();
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("applies error class when saveError is set", () => {
    useDiagramStore.setState({ saveError: "Fail" });
    renderStatusBar();
    const el = screen.getByText("Error: Fail");
    expect(el.className).toContain("status-error");
  });

  it("applies dirty class when dirty and not saving", () => {
    useDiagramStore.setState({ dirty: true });
    renderStatusBar();
    const el = screen.getByText("Unsaved changes");
    expect(el.className).toContain("status-dirty");
  });
});
