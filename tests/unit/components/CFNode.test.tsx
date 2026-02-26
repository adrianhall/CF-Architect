// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

import React from "react";
import { render, screen } from "@testing-library/react";
import { CFNode } from "@islands/nodes/CFNode";
import { NODE_TYPE_MAP, CATEGORY_COLORS } from "@lib/catalog";

function renderCFNode(data: Record<string, unknown>, selected = false) {
  const Unwrapped = (CFNode as any).type ?? CFNode;
  return render(
    <Unwrapped
      id="test-node"
      data={data}
      selected={selected}
      type="cf-node"
      isConnectable={true}
      positionAbsoluteX={0}
      positionAbsoluteY={0}
      zIndex={0}
      dragging={false}
    />,
  );
}

describe("CFNode", () => {
  it("renders label text", () => {
    renderCFNode({ typeId: "worker", label: "My Worker" });
    expect(screen.getByText("My Worker")).toBeInTheDocument();
  });

  it("renders description when set", () => {
    renderCFNode({
      typeId: "worker",
      label: "W",
      description: "Handles requests",
    });
    expect(screen.getByText("Handles requests")).toBeInTheDocument();
  });

  it("hides description when absent", () => {
    const { container } = renderCFNode({ typeId: "worker", label: "W" });
    expect(container.querySelector(".cf-node-description")).toBeNull();
  });

  it("renders correct icon from catalog", () => {
    const { container } = renderCFNode({ typeId: "d1", label: "DB" });
    const img = container.querySelector("img.cf-node-icon");
    expect(img).toHaveAttribute("src", "/icons/d1.svg");
  });

  it("falls back to /icons/worker.svg for unknown typeId", () => {
    const { container } = renderCFNode({ typeId: "nonexistent", label: "X" });
    const img = container.querySelector("img.cf-node-icon");
    expect(img).toHaveAttribute("src", "/icons/worker.svg");
  });

  it("renders handles matching typeDef.defaultHandles", () => {
    renderCFNode({ typeId: "worker", label: "W" });
    const typeDef = NODE_TYPE_MAP.get("worker")!;
    for (const h of typeDef.defaultHandles) {
      expect(screen.getByTestId(`handle-${h.id}`)).toBeInTheDocument();
    }
  });

  it("renders only 2 handles for cron-trigger type", () => {
    renderCFNode({ typeId: "cron-trigger", label: "Cron" });
    const typeDef = NODE_TYPE_MAP.get("cron-trigger")!;
    expect(typeDef.defaultHandles).toHaveLength(2);
    for (const h of typeDef.defaultHandles) {
      expect(screen.getByTestId(`handle-${h.id}`)).toBeInTheDocument();
    }
  });

  it("applies custom accentColor from data.style", () => {
    const { container } = renderCFNode({
      typeId: "worker",
      label: "W",
      style: { accentColor: "#FF0000" },
    });
    const node = container.querySelector(".cf-node") as HTMLElement;
    expect(node.style.borderColor).toContain("#FF0000");
  });

  it("falls back to category color when no accent override", () => {
    const { container } = renderCFNode({ typeId: "d1", label: "DB" });
    const node = container.querySelector(".cf-node") as HTMLElement;
    const expectedColor = CATEGORY_COLORS.storage;
    expect(node.style.borderColor).toContain(expectedColor);
  });

  it("applies selected box-shadow", () => {
    const { container } = renderCFNode({ typeId: "worker", label: "W" }, true);
    const node = container.querySelector(".cf-node") as HTMLElement;
    expect(node.style.boxShadow).not.toBe("none");
  });

  it("has no box-shadow when not selected", () => {
    const { container } = renderCFNode({ typeId: "worker", label: "W" }, false);
    const node = container.querySelector(".cf-node") as HTMLElement;
    expect(node.style.boxShadow).toBe("none");
  });
});
