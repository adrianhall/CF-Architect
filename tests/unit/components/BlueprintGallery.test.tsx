// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

vi.mock("@lib/validation", () => ({
  fetchApi: vi.fn(),
  DiagramResponseSchema: {},
}));

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import BlueprintGallery from "@islands/blueprints/BlueprintGallery";
import { BLUEPRINTS } from "@lib/blueprints";

describe("BlueprintGallery", () => {
  it("renders Blank Canvas card plus all blueprint cards", () => {
    render(<BlueprintGallery />);
    expect(screen.getByText("Blank Canvas")).toBeInTheDocument();
    for (const bp of BLUEPRINTS) {
      expect(screen.getByText(bp.title)).toBeInTheDocument();
    }
  });

  it("shows 9 total cards (1 blank + 8 blueprints)", () => {
    render(<BlueprintGallery />);
    const cards = screen
      .getAllByRole("button")
      .filter((btn) => btn.classList.contains("blueprint-card"));
    expect(cards).toHaveLength(9);
  });

  it("renders category filter tabs including All", () => {
    render(<BlueprintGallery />);

    const filterContainer = screen
      .getByText("All")
      .closest(".blueprint-filters") as HTMLElement;
    expect(filterContainer).toBeInTheDocument();

    const categories = Array.from(new Set(BLUEPRINTS.map((b) => b.category)));
    for (const cat of categories) {
      const tabs = within(filterContainer).getAllByText(cat);
      expect(tabs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("filtering by category hides non-matching blueprint cards", () => {
    render(<BlueprintGallery />);

    const filterContainer = screen
      .getByText("All")
      .closest(".blueprint-filters") as HTMLElement;
    fireEvent.click(within(filterContainer).getByText("AI"));

    const aiBlueprints = BLUEPRINTS.filter((b) => b.category === "AI");
    const nonAiBlueprints = BLUEPRINTS.filter((b) => b.category !== "AI");

    for (const bp of aiBlueprints) {
      expect(screen.getByText(bp.title)).toBeInTheDocument();
    }

    for (const bp of nonAiBlueprints) {
      expect(screen.queryByText(bp.title)).not.toBeInTheDocument();
    }

    expect(screen.getByText("Blank Canvas")).toBeInTheDocument();
  });

  it("clicking a blueprint card opens the create modal", () => {
    render(<BlueprintGallery />);

    fireEvent.click(screen.getByText("API Gateway"));

    expect(screen.getByTestId("create-diagram-modal")).toBeInTheDocument();
  });

  it("clicking Blank Canvas card opens the create modal", () => {
    render(<BlueprintGallery />);

    fireEvent.click(screen.getByText("Blank Canvas"));

    expect(screen.getByTestId("create-diagram-modal")).toBeInTheDocument();
    expect(screen.getByText("Create New Diagram")).toBeInTheDocument();
  });
});
