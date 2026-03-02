// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
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
import { render, screen } from "@testing-library/react";
import DiagramCanvasWrapper from "@islands/DiagramCanvasWrapper";

const initialData = {
  title: "Wrapper Test",
  description: "desc",
  graphData: JSON.stringify({
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }),
};

describe("DiagramCanvasWrapper", () => {
  it("renders DiagramCanvas inside ReactFlowProvider", () => {
    render(
      <DiagramCanvasWrapper diagramId="wrap-1" initialData={initialData} />,
    );
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("passes readOnly prop through to DiagramCanvas", () => {
    render(
      <DiagramCanvasWrapper
        diagramId="wrap-2"
        readOnly={true}
        initialData={initialData}
      />,
    );
    expect(screen.getByText("Read-only")).toBeInTheDocument();
  });
});
