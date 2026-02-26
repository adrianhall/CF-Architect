// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createXyflowMock } from "../../helpers/mock-xyflow";

vi.mock("@xyflow/react", () => createXyflowMock());

vi.mock("@lib/validation", () => ({
  fetchApi: vi.fn(),
  DiagramResponseSchema: {},
}));

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateDiagramModal from "@islands/blueprints/CreateDiagramModal";
import { fetchApi } from "@lib/validation";
import { BLUEPRINT_MAP } from "@lib/blueprints";

const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

const apiGateway = BLUEPRINT_MAP.get("api-gateway")!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CreateDiagramModal", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <CreateDiagramModal open={false} onClose={vi.fn()} blueprint={null} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders modal with 'Create New Diagram' title when blank", () => {
    render(
      <CreateDiagramModal open={true} onClose={vi.fn()} blueprint={null} />,
    );
    expect(screen.getByText("Create New Diagram")).toBeInTheDocument();
  });

  it("renders blueprint title when a blueprint is selected", () => {
    render(
      <CreateDiagramModal
        open={true}
        onClose={vi.fn()}
        blueprint={apiGateway}
      />,
    );
    expect(screen.getByText("API Gateway")).toBeInTheDocument();
    expect(screen.getByText("Serverless")).toBeInTheDocument();
  });

  it("pre-fills title with blueprint name", () => {
    render(
      <CreateDiagramModal
        open={true}
        onClose={vi.fn()}
        blueprint={apiGateway}
      />,
    );
    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe(
      "API Gateway",
    );
  });

  it("pre-fills title with 'Untitled Diagram' for blank", () => {
    render(
      <CreateDiagramModal open={true} onClose={vi.fn()} blueprint={null} />,
    );
    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe(
      "Untitled Diagram",
    );
  });

  it("pre-fills description from blueprint", () => {
    render(
      <CreateDiagramModal
        open={true}
        onClose={vi.fn()}
        blueprint={apiGateway}
      />,
    );
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("Description").value,
    ).toBe(apiGateway.description);
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <CreateDiagramModal open={true} onClose={onClose} blueprint={null} />,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when X button is clicked", () => {
    const onClose = vi.fn();
    render(
      <CreateDiagramModal open={true} onClose={onClose} blueprint={null} />,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("submits POST with correct payload for blank diagram", async () => {
    mockFetchApi.mockResolvedValueOnce({
      ok: true,
      data: { id: "new-1" },
    });

    const originalHref = window.location.href;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, href: originalHref },
    });

    render(
      <CreateDiagramModal open={true} onClose={vi.fn()} blueprint={null} />,
    );

    fireEvent.click(screen.getByText("Create Diagram"));

    await waitFor(() => {
      expect(mockFetchApi).toHaveBeenCalledWith(
        "/api/v1/diagrams",
        expect.anything(),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"title":"Untitled Diagram"'),
        }),
      );
    });
  });

  it("submits POST with blueprintId when blueprint selected", async () => {
    mockFetchApi.mockResolvedValueOnce({
      ok: true,
      data: { id: "new-2" },
    });

    const originalHref = window.location.href;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, href: originalHref },
    });

    render(
      <CreateDiagramModal
        open={true}
        onClose={vi.fn()}
        blueprint={apiGateway}
      />,
    );

    fireEvent.click(screen.getByText("Create Diagram"));

    await waitFor(() => {
      expect(mockFetchApi).toHaveBeenCalledWith(
        "/api/v1/diagrams",
        expect.anything(),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"blueprintId":"api-gateway"'),
        }),
      );
    });
  });

  it("shows loading state on the Create button during submission", async () => {
    mockFetchApi.mockReturnValue(new Promise(() => {}));

    render(
      <CreateDiagramModal open={true} onClose={vi.fn()} blueprint={null} />,
    );

    fireEvent.click(screen.getByText("Create Diagram"));

    await waitFor(() => {
      expect(screen.getByText("Creating...")).toBeInTheDocument();
    });
  });
});
