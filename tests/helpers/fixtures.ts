/**
 * Reusable test data constants and utilities.
 */
import { SEED_USER_ID } from "@lib/auth/types";

/**
 * Parse a Response body as JSON with a permissive type.
 * Cloudflare workers types make Response.json() return Promise<unknown>;
 * this wrapper avoids repetitive type assertions in test assertions.
 */
export async function jsonBody(res: Response): Promise<any> {
  return await res.json();
}

export const DEFAULT_GRAPH_DATA = JSON.stringify({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
});

export const SAMPLE_GRAPH_DATA = JSON.stringify({
  nodes: [
    {
      id: "n1",
      type: "cf-node",
      position: { x: 100, y: 100 },
      data: { typeId: "worker", label: "My Worker" },
    },
    {
      id: "n2",
      type: "cf-node",
      position: { x: 300, y: 100 },
      data: { typeId: "d1", label: "My DB" },
    },
  ],
  edges: [
    {
      id: "e1",
      source: "n1",
      target: "n2",
      type: "cf-edge",
      data: { edgeType: "data-flow" },
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
});

export function makeDiagramRow(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: "diag-001",
    ownerId: SEED_USER_ID,
    title: "Test Diagram",
    description: "A test diagram",
    graphData: DEFAULT_GRAPH_DATA,
    thumbnailKey: null,
    blueprintId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeShareLinkRow(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: "share-001",
    diagramId: "diag-001",
    token: "abc123token!",
    createdBy: SEED_USER_ID,
    expiresAt: null,
    createdAt: now,
    ...overrides,
  };
}
