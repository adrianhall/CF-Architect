/**
 * packages/shared/src/catalog/edge-types.ts
 *
 * The four canonical edge types for CF-Architect diagrams.
 * styleTokens are consumed by the Phase 04 React Flow edge renderer.
 *
 * Token keys follow a camelCase convention; values are CSS-compatible strings.
 */

import type { EdgeType } from "./types.js";

export const EDGE_TYPES: readonly EdgeType[] = [
  {
    id: "data-flow",
    label: "Data Flow",
    description:
      "A directional data or traffic flow between two components, e.g. an HTTP request or a stream of records.",
    styleTokens: {
      strokeColor: "#2563EB", // blue
      strokeDasharray: "none",
      strokeWidth: "2",
      markerEnd: "arrow",
    },
  },
  {
    id: "binding",
    label: "Binding",
    description:
      "A Cloudflare Workers binding that gives one Worker direct access to another resource, e.g. a KV namespace or D1 database.",
    styleTokens: {
      strokeColor: "#F6821F", // Cloudflare orange
      strokeDasharray: "6 3",
      strokeWidth: "2",
      markerEnd: "arrow",
    },
  },
  {
    id: "dependency",
    label: "Dependency",
    description:
      "A logical deployment dependency — component A must exist before component B is deployed.",
    styleTokens: {
      strokeColor: "#6B7280", // grey
      strokeDasharray: "none",
      strokeWidth: "1.5",
      markerEnd: "arrow",
    },
  },
  {
    id: "logical",
    label: "Logical",
    description:
      "A conceptual or organisational grouping relationship without an explicit runtime connection.",
    styleTokens: {
      strokeColor: "#7C3AED", // violet
      strokeDasharray: "3 3",
      strokeWidth: "1.5",
      markerEnd: "none",
    },
  },
];
