// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrintButton } from "@islands/toolbar/PrintButton";
import { useDiagramStore } from "@islands/store/diagramStore";
import { resetStore } from "../../helpers/render-helpers";

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

describe("PrintButton", () => {
  it("renders a button with title Print", () => {
    render(<PrintButton />);
    expect(screen.getByTitle("Print")).toBeInTheDocument();
  });

  it("sets printMode to true in the store on click", () => {
    render(<PrintButton />);
    fireEvent.click(screen.getByTitle("Print"));
    expect(useDiagramStore.getState().printMode).toBe(true);
  });
});
