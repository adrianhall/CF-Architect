// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

import React from "react";
import { render, screen } from "@testing-library/react";
import BlueprintPreview from "@islands/blueprints/BlueprintPreview";

const VALID_GRAPH = JSON.stringify({
  nodes: [
    {
      id: "n1",
      type: "cf-node",
      position: { x: 0, y: 0 },
      data: { typeId: "worker", label: "Worker" },
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
});

describe("BlueprintPreview", () => {
  it("renders without crashing for valid graphData", () => {
    render(<BlueprintPreview graphData={VALID_GRAPH} />);
    expect(screen.getByTestId("blueprint-preview")).toBeInTheDocument();
  });

  it("renders without crashing for empty graphData", () => {
    const empty = JSON.stringify({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    render(<BlueprintPreview graphData={empty} />);
    expect(screen.getByTestId("blueprint-preview")).toBeInTheDocument();
  });

  it("handles invalid JSON gracefully", () => {
    render(<BlueprintPreview graphData="not-json" />);
    expect(screen.getByTestId("blueprint-preview")).toBeInTheDocument();
  });

  it("respects the height prop", () => {
    render(<BlueprintPreview graphData={VALID_GRAPH} height={300} />);
    const el = screen.getByTestId("blueprint-preview");
    expect(el.style.height).toBe("300px");
  });

  it("defaults to 200px height", () => {
    render(<BlueprintPreview graphData={VALID_GRAPH} />);
    const el = screen.getByTestId("blueprint-preview");
    expect(el.style.height).toBe("200px");
  });
});
