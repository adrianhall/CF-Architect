// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ServicePalette } from "@islands/panels/ServicePalette";
import {
  CATEGORY_LABELS,
  NODE_TYPES,
  getNodesByCategory,
  type NodeCategory,
} from "@lib/catalog";

describe("ServicePalette", () => {
  it("renders all category sections", () => {
    render(<ServicePalette />);
    const categories = Object.keys(getNodesByCategory()) as NodeCategory[];
    for (const cat of categories) {
      expect(screen.getByText(CATEGORY_LABELS[cat])).toBeInTheDocument();
    }
  });

  it("renders palette items with correct labels", () => {
    render(<ServicePalette />);
    expect(screen.getByText("Workers")).toBeInTheDocument();
    expect(screen.getByText("D1 Database")).toBeInTheDocument();
    expect(screen.getByText("Workers AI")).toBeInTheDocument();
  });

  it("renders palette items with icons", () => {
    const { container } = render(<ServicePalette />);
    const images = container.querySelectorAll("img");
    expect(images.length).toBe(NODE_TYPES.length);
  });

  it("filters items by label (case-insensitive)", () => {
    render(<ServicePalette />);
    const searchInput = screen.getByPlaceholderText("Search services...");
    fireEvent.change(searchInput, { target: { value: "queue" } });

    expect(screen.getByText("Queues")).toBeInTheDocument();
    expect(screen.queryByText("Workers AI")).toBeNull();
  });

  it("filters items by typeId", () => {
    render(<ServicePalette />);
    const searchInput = screen.getByPlaceholderText("Search services...");
    fireEvent.change(searchInput, { target: { value: "d1" } });

    expect(screen.getByText("D1 Database")).toBeInTheDocument();
    expect(screen.queryByText("R2 Storage")).toBeNull();
  });

  it("shows all items when search is cleared", () => {
    render(<ServicePalette />);
    const searchInput = screen.getByPlaceholderText("Search services...");

    fireEvent.change(searchInput, { target: { value: "queue" } });
    fireEvent.change(searchInput, { target: { value: "" } });

    expect(screen.getByText("Workers")).toBeInTheDocument();
    expect(screen.getByText("D1 Database")).toBeInTheDocument();
    expect(screen.getByText("Workers AI")).toBeInTheDocument();
  });

  it("toggles category collapse on header click", () => {
    render(<ServicePalette />);
    const computeHeader = screen.getByText("Compute");
    fireEvent.click(computeHeader);

    expect(screen.queryByText("Workers")).toBeNull();

    fireEvent.click(computeHeader);
    expect(screen.getByText("Workers")).toBeInTheDocument();
  });

  it("auto-expands collapsed categories when search is active", () => {
    render(<ServicePalette />);
    const computeHeader = screen.getByText("Compute");
    fireEvent.click(computeHeader);
    expect(screen.queryByText("Workers")).toBeNull();

    const searchInput = screen.getByPlaceholderText("Search services...");
    fireEvent.change(searchInput, { target: { value: "worker" } });
    expect(screen.getByText("Workers")).toBeInTheDocument();
  });

  it("hides empty categories when all items are filtered out", () => {
    render(<ServicePalette />);
    const searchInput = screen.getByPlaceholderText("Search services...");
    fireEvent.change(searchInput, { target: { value: "d1" } });

    expect(screen.queryByText("Compute")).toBeNull();
    expect(screen.getByText("Storage & Data")).toBeInTheDocument();
  });

  it("sets drag transfer data on drag start", () => {
    render(<ServicePalette />);
    const workerItem = screen.getByText("Workers").closest(".palette-item")!;

    const setData = vi.fn();
    fireEvent.dragStart(workerItem, {
      dataTransfer: { setData, effectAllowed: "" },
    });

    expect(setData).toHaveBeenCalledWith("application/cf-node-type", "worker");
  });

  it("renders search input", () => {
    render(<ServicePalette />);
    expect(screen.getByPlaceholderText("Search services...")).toBeInTheDocument();
  });

  it("shows the Services heading", () => {
    render(<ServicePalette />);
    expect(screen.getByText("Services")).toBeInTheDocument();
  });
});
