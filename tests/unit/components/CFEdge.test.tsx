// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

import React from "react";
import { render, screen } from "@testing-library/react";
import { CFEdge } from "@islands/edges/CFEdge";
import { EDGE_TYPE_MAP } from "@lib/catalog";

const baseProps = {
  id: "e1",
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: "right" as const,
  targetPosition: "left" as const,
  sourceHandleId: null,
  targetHandleId: null,
  source: "n1",
  target: "n2",
  interactionWidth: 20,
};

function renderCFEdge(
  data: Record<string, unknown> | undefined,
  selected = false,
) {
  const Unwrapped = (CFEdge as any).type ?? CFEdge;
  return render(
    <svg>
      <Unwrapped
        {...baseProps}
        data={data}
        selected={selected}
        type="cf-edge"
      />
    </svg>,
  );
}

describe("CFEdge", () => {
  it("renders BaseEdge with solid stroke for data-flow", () => {
    renderCFEdge({ edgeType: "data-flow" });
    const edge = screen.getByTestId("base-edge");
    expect(edge).toBeInTheDocument();
    expect(edge.style.strokeDasharray).toBeFalsy();
  });

  it("renders dashed stroke for service-binding", () => {
    renderCFEdge({ edgeType: "service-binding" });
    const edge = screen.getByTestId("base-edge");
    expect(edge.style.strokeDasharray).toBe("8 4");
  });

  it("renders dotted stroke for trigger", () => {
    renderCFEdge({ edgeType: "trigger" });
    const edge = screen.getByTestId("base-edge");
    expect(edge.style.strokeDasharray).toBe("3 3");
  });

  it("renders thin gray stroke for external", () => {
    renderCFEdge({ edgeType: "external" });
    const edge = screen.getByTestId("base-edge");
    const typeDef = EDGE_TYPE_MAP.get("external")!;
    expect(edge.style.stroke).toBe(typeDef.color);
  });

  it("shows label when data.label is set", () => {
    renderCFEdge({ edgeType: "data-flow", label: "REST" });
    expect(screen.getByText("REST")).toBeInTheDocument();
  });

  it("hides label when data.label is absent", () => {
    renderCFEdge({ edgeType: "data-flow" });
    expect(screen.queryByTestId("edge-label-renderer")).toBeNull();
  });

  it("uses orange highlight when selected", () => {
    renderCFEdge({ edgeType: "data-flow" }, true);
    const edge = screen.getByTestId("base-edge");
    expect(edge.style.stroke).toBe("#F6821F");
  });

  it("uses wider stroke when selected", () => {
    renderCFEdge({ edgeType: "data-flow" }, true);
    const edge = screen.getByTestId("base-edge");
    expect(edge.style.strokeWidth).toBe("2.5");
  });

  it("defaults to data-flow when data is undefined", () => {
    renderCFEdge(undefined);
    const edge = screen.getByTestId("base-edge");
    const typeDef = EDGE_TYPE_MAP.get("data-flow")!;
    expect(edge.style.stroke).toBe(typeDef.color);
  });

  it("renders arrow marker for types with markerEnd", () => {
    renderCFEdge({ edgeType: "data-flow" });
    const edge = screen.getByTestId("base-edge");
    expect(edge.getAttribute("data-marker-end")).toBe("url(#arrow-data-flow)");
  });

  it("does not render arrow marker for service-binding", () => {
    renderCFEdge({ edgeType: "service-binding" });
    const edge = screen.getByTestId("base-edge");
    expect(edge.getAttribute("data-marker-end")).toBe("");
  });

  it("applies animated class for data-flow", () => {
    renderCFEdge({ edgeType: "data-flow" });
    const edge = screen.getByTestId("base-edge");
    expect(edge.className).toContain("react-flow__edge-animated");
  });

  it("does not apply animated class for service-binding", () => {
    renderCFEdge({ edgeType: "service-binding" });
    const edge = screen.getByTestId("base-edge");
    expect(edge.className).not.toContain("react-flow__edge-animated");
  });
});
