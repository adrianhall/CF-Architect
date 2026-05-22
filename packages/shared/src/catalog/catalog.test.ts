/**
 * packages/shared/src/catalog/catalog.test.ts
 *
 * Unit tests for the service catalog — schema validation, referential
 * integrity, and getCatalog() factory behaviour.
 */

import { describe, it, expect } from "vitest";
import { CatalogSchema } from "./types.js";
import { getCatalog } from "./index.js";
import { SERVICES } from "./services.js";
import { CATEGORIES } from "./categories.js";
import { ALIASES } from "./aliases.js";
import { resolveTypeId } from "./aliases.js";

// ---------------------------------------------------------------------------
// getCatalog() — schema validity
// ---------------------------------------------------------------------------

describe("getCatalog()", () => {
  it("returns a catalog that passes full CatalogSchema.parse() with no errors", () => {
    const catalog = getCatalog();
    expect(() => CatalogSchema.parse(catalog)).not.toThrow();
  });

  it("always returns the same object reference (singleton)", () => {
    expect(getCatalog()).toBe(getCatalog());
  });

  it("includes at least 30 services", () => {
    const { services } = getCatalog();
    expect(services.length).toBeGreaterThanOrEqual(30);
  });

  it("includes at least 1 category", () => {
    const { categories } = getCatalog();
    expect(categories.length).toBeGreaterThan(0);
  });

  it("includes all 4 edge types", () => {
    const { edgeTypes } = getCatalog();
    const ids = edgeTypes.map((e) => e.id);
    expect(ids).toContain("data-flow");
    expect(ids).toContain("binding");
    expect(ids).toContain("dependency");
    expect(ids).toContain("logical");
  });

  it("contains the required minimum service set from the phase spec", () => {
    const { services } = getCatalog();
    const typeIds = new Set(services.map((s) => s.typeId));
    const required = [
      "workers",
      "workers-kv",
      "d1",
      "r2",
      "queues",
      "vectorize",
      "workers-ai",
      "browser-rendering",
      "containers",
      "mtls",
      "hyperdrive",
      "email-routing",
      "workers-vpc",
      "pipelines",
      "workers-artifacts",
      "dynamic-workers",
      "pages",
      "stream",
      "images",
      "ai-gateway",
      "zero-trust",
      "access",
      "warp",
      "magic-transit",
      "magic-wan",
      "cdn-cache",
      "dns",
      "argo-smart-routing",
      "rate-limiting",
      "zaraz",
      "r2-event-notifications",
      "workers-analytics-engine",
      "durable-objects",
      "service-bindings",
    ];
    for (const id of required) {
      expect(typeIds.has(id), `Missing required service: ${id}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Referential integrity
// ---------------------------------------------------------------------------

describe("catalog referential integrity", () => {
  const catalog = getCatalog();
  const categoryIds = new Set(catalog.categories.map((c) => c.id));
  const serviceTypeIds = new Set(catalog.services.map((s) => s.typeId));

  it("every service.categoryId references a valid category", () => {
    for (const service of catalog.services) {
      expect(
        categoryIds.has(service.categoryId),
        `Service "${service.typeId}" has unknown categoryId "${service.categoryId}"`,
      ).toBe(true);
    }
  });

  it("every service has a non-empty iconId", () => {
    for (const service of catalog.services) {
      expect(service.iconId.length, `Service "${service.typeId}" has empty iconId`).toBeGreaterThan(
        0,
      );
    }
  });

  it("every service has a non-empty description", () => {
    for (const service of catalog.services) {
      expect(
        service.description.length,
        `Service "${service.typeId}" has empty description`,
      ).toBeGreaterThan(0);
    }
  });

  it("Cloudflare services have a valid docLink URL", () => {
    for (const service of catalog.services) {
      if (service.categoryId === "generic") continue; // generic resources have no docLink
      expect(service.docLink, `CF service "${service.typeId}" is missing docLink`).toBeDefined();
      expect(
        () => new URL(service.docLink!),
        `CF service "${service.typeId}" has invalid docLink: ${service.docLink}`,
      ).not.toThrow();
    }
  });

  it("all typeIds are unique", () => {
    const ids = catalog.services.map((s) => s.typeId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every alias value is a typeId that exists in services", () => {
    for (const [old, current] of Object.entries(catalog.aliases)) {
      expect(
        serviceTypeIds.has(current),
        `Alias "${old}" → "${current}" but "${current}" is not in services`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Category colour format
// ---------------------------------------------------------------------------

describe("category colours", () => {
  it("every category colour is a valid 6-digit hex string", () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    for (const category of CATEGORIES) {
      expect(
        hexPattern.test(category.colour),
        `Category "${category.id}" has invalid colour "${category.colour}"`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// resolveTypeId
// ---------------------------------------------------------------------------

describe("resolveTypeId()", () => {
  it("returns the mapped value for a known alias", () => {
    const aliases = { "old-workers-kv": "workers-kv" };
    expect(resolveTypeId("old-workers-kv", aliases)).toBe("workers-kv");
  });

  it("returns the id unchanged for an unknown id", () => {
    expect(resolveTypeId("totally-unknown", ALIASES)).toBe("totally-unknown");
  });

  it("returns the id unchanged when aliases is empty", () => {
    expect(resolveTypeId("workers", {})).toBe("workers");
  });

  it("is idempotent — calling twice returns the same result", () => {
    const aliases = { "old-id": "new-id" };
    const first = resolveTypeId("old-id", aliases);
    const second = resolveTypeId(first, aliases);
    expect(first).toBe(second);
  });

  it("passes through IDs that are already current (no alias entry)", () => {
    const { aliases } = getCatalog();
    const services = SERVICES;
    for (const service of services) {
      const resolved = resolveTypeId(service.typeId, aliases);
      expect(resolved).toBe(service.typeId);
    }
  });
});
