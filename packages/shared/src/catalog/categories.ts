/**
 * packages/shared/src/catalog/categories.ts
 *
 * Canonical category definitions for the Cloudflare service catalog.
 * Colours are chosen to be accessible and distinct on both light and dark themes.
 */

import type { Category } from "./types.js";

export const CATEGORIES: readonly Category[] = [
  {
    id: "compute",
    label: "Compute",
    colour: "#F6821F", // Cloudflare orange
  },
  {
    id: "storage",
    label: "Storage",
    colour: "#2E8B57", // sea green
  },
  {
    id: "data",
    label: "Data",
    colour: "#1D6EB5", // Cloudflare blue
  },
  {
    id: "ai-ml",
    label: "AI & ML",
    colour: "#7C3AED", // violet
  },
  {
    id: "networking",
    label: "Networking",
    colour: "#0284C7", // sky blue
  },
  {
    id: "security",
    label: "Security",
    colour: "#DC2626", // red
  },
  {
    id: "developer-tools",
    label: "Developer Tools",
    colour: "#0D9488", // teal
  },
  {
    id: "communication",
    label: "Communication",
    colour: "#0EA5E9", // light blue
  },
  {
    id: "platform",
    label: "Platform",
    colour: "#374151", // dark grey
  },
  {
    id: "generic",
    label: "Generic",
    colour: "#6B7280", // neutral grey — non-Cloudflare resources (D13)
  },
];
