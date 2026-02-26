import { describe, it, expect } from "vitest";
import {
  NODE_TYPES,
  EDGE_TYPES,
  NODE_TYPE_MAP,
  EDGE_TYPE_MAP,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  getNodesByCategory,
  type NodeCategory,
} from "@lib/catalog";

const VALID_CATEGORIES: NodeCategory[] = [
  "compute",
  "storage",
  "ai",
  "media",
  "network",
  "external",
];

// ---------------------------------------------------------------------------
// NODE_TYPES
// ---------------------------------------------------------------------------

describe("NODE_TYPES", () => {
  it("has exactly 30 entries", () => {
    expect(NODE_TYPES).toHaveLength(30);
  });

  it("has unique typeId values", () => {
    const ids = NODE_TYPES.map((n) => n.typeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every node has the required fields", () => {
    for (const node of NODE_TYPES) {
      expect(node.typeId).toBeTruthy();
      expect(node.label).toBeTruthy();
      expect(VALID_CATEGORIES).toContain(node.category);
      expect(node.iconPath).toBeTruthy();
      expect(node.description).toBeTruthy();
      expect(node.defaultHandles.length).toBeGreaterThan(0);
    }
  });

  it("every iconPath starts with /icons/ and ends with .svg", () => {
    for (const node of NODE_TYPES) {
      expect(node.iconPath).toMatch(/^\/icons\/.*\.svg$/);
    }
  });

  it("standard nodes have 4 handles (2 target + 2 source)", () => {
    const standard = NODE_TYPES.filter(
      (n) =>
        !["cron-trigger", "client-browser", "client-mobile"].includes(n.typeId),
    );
    for (const node of standard) {
      expect(node.defaultHandles).toHaveLength(4);
      const targets = node.defaultHandles.filter((h) => h.type === "target");
      const sources = node.defaultHandles.filter((h) => h.type === "source");
      expect(targets).toHaveLength(2);
      expect(sources).toHaveLength(2);
    }
  });

  it("cron-trigger has 2 source-only handles", () => {
    const cron = NODE_TYPE_MAP.get("cron-trigger");
    expect(cron).toBeDefined();
    expect(cron!.defaultHandles).toHaveLength(2);
    expect(cron!.defaultHandles.every((h) => h.type === "source")).toBe(true);
  });

  it("client-browser has 2 source-only handles", () => {
    const node = NODE_TYPE_MAP.get("client-browser");
    expect(node).toBeDefined();
    expect(node!.defaultHandles).toHaveLength(2);
    expect(node!.defaultHandles.every((h) => h.type === "source")).toBe(true);
  });

  it("client-mobile has 2 source-only handles", () => {
    const node = NODE_TYPE_MAP.get("client-mobile");
    expect(node).toBeDefined();
    expect(node!.defaultHandles).toHaveLength(2);
    expect(node!.defaultHandles.every((h) => h.type === "source")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NODE_TYPE_MAP
// ---------------------------------------------------------------------------

describe("NODE_TYPE_MAP", () => {
  it("returns correct definition for known typeId", () => {
    const worker = NODE_TYPE_MAP.get("worker");
    expect(worker).toBeDefined();
    expect(worker!.label).toBe("Workers");

    const d1 = NODE_TYPE_MAP.get("d1");
    expect(d1).toBeDefined();
    expect(d1!.label).toBe("D1 Database");
  });

  it("returns undefined for unknown typeId", () => {
    expect(NODE_TYPE_MAP.get("nonexistent")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// EDGE_TYPES
// ---------------------------------------------------------------------------

describe("EDGE_TYPES", () => {
  it("has exactly 4 entries", () => {
    expect(EDGE_TYPES).toHaveLength(4);
  });

  it("has unique edgeType values", () => {
    const ids = EDGE_TYPES.map((e) => e.edgeType);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("EDGE_TYPE_MAP", () => {
  it("returns correct definition for each edge type", () => {
    expect(EDGE_TYPE_MAP.get("data-flow")?.label).toBe("Data Flow");
    expect(EDGE_TYPE_MAP.get("service-binding")?.label).toBe("Service Binding");
    expect(EDGE_TYPE_MAP.get("trigger")?.label).toBe("Trigger");
    expect(EDGE_TYPE_MAP.get("external")?.label).toBe("External");
  });
});

// ---------------------------------------------------------------------------
// getNodesByCategory
// ---------------------------------------------------------------------------

describe("getNodesByCategory", () => {
  it("returns all 6 categories", () => {
    const grouped = getNodesByCategory();
    expect(Object.keys(grouped).sort()).toEqual([...VALID_CATEGORIES].sort());
  });

  it("total count across all categories equals 30", () => {
    const grouped = getNodesByCategory();
    const total = Object.values(grouped).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(total).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// CATEGORY_COLORS / CATEGORY_LABELS
// ---------------------------------------------------------------------------

describe("CATEGORY_COLORS", () => {
  it("has an entry for every NodeCategory", () => {
    for (const cat of VALID_CATEGORIES) {
      expect(CATEGORY_COLORS[cat]).toBeTruthy();
    }
  });
});

describe("CATEGORY_LABELS", () => {
  it("has an entry for every NodeCategory", () => {
    for (const cat of VALID_CATEGORIES) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});
