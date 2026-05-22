/**
 * packages/shared/src/catalog/types.ts
 *
 * Zod v3 schemas for the Cloudflare service catalog.
 * Consumed by the Worker (GET /api/catalog) and the SPA (useCatalog hook).
 *
 * All schemas use Zod v3 per D09 in docs/DECISION_LOG.md.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// OtherLink — supplementary link attached to a service
// ---------------------------------------------------------------------------

export const OtherLinkSchema = z.object({
  /** Category of link. */
  type: z.enum(["video", "audio", "document", "example"]),
  /** Human-readable link text, e.g. "Getting started guide". */
  text: z.string().min(1),
  /** Absolute URL. */
  href: z.string().url(),
});

export type OtherLink = z.infer<typeof OtherLinkSchema>;

// ---------------------------------------------------------------------------
// Service — one entry in the Cloudflare product catalogue
// ---------------------------------------------------------------------------

export const ServiceSchema = z.object({
  /**
   * Stable kebab-case identifier, e.g. "workers-kv".
   * Never changes after publication — use the alias map to handle renames.
   */
  typeId: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "typeId must be kebab-case"),

  /** Official product name, e.g. "Workers KV". */
  name: z.string().min(1),

  /** Shortened display name for tight spaces, e.g. "KV". */
  shortName: z.string().min(1),

  /** ID of the parent category (must resolve to a CategorySchema entry). */
  categoryId: z.string().min(1),

  /**
   * ID used to look up the icon in the SVG sprite.
   * Matches the filename stem of the SVG in apps/web/src/icons/src/.
   * e.g. "kv" → sprite symbol #kv.
   */
  iconId: z.string().min(1),

  /** One-sentence description for tooltips and the properties panel. */
  description: z.string().min(1),

  /**
   * URL to the primary Cloudflare documentation page.
   * Optional to accommodate generic non-Cloudflare resources (D13).
   */
  docLink: z.string().url().optional(),

  /**
   * Supplementary links — videos, examples, guides.
   * Empty array in Phase 03; populated post-launch (D11 in DECISION_LOG.md).
   */
  otherLinks: z.array(OtherLinkSchema).default([]),

  /**
   * Wrangler binding type string used by the scaffold exporter (Phase 09).
   * Absent for services without a native Workers binding.
   * e.g. "kv_namespaces", "d1_databases", "r2_buckets".
   */
  scaffoldBindingType: z.string().optional(),
});

export type Service = z.infer<typeof ServiceSchema>;

// ---------------------------------------------------------------------------
// Category — a grouping of services shown as a palette section
// ---------------------------------------------------------------------------

export const CategorySchema = z.object({
  /** Stable kebab-case identifier, e.g. "compute". */
  id: z.string().min(1),

  /** Human-readable label, e.g. "Compute". */
  label: z.string().min(1),

  /**
   * CSS hex colour for this category's palette header and node accent.
   * Must be a 6-digit hex string, e.g. "#F6821F".
   */
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, "colour must be a 6-digit hex string"),
});

export type Category = z.infer<typeof CategorySchema>;

// ---------------------------------------------------------------------------
// EdgeType — connection style between diagram nodes
// ---------------------------------------------------------------------------

/**
 * Style tokens consumed by Phase 04's @xyflow/react edge renderer.
 * Keys are CSS custom property names (without the `--` prefix), values are
 * their resolved values.
 *
 * e.g. { strokeColor: "#2563EB", strokeDasharray: "none", strokeWidth: "2" }
 */
export const EdgeTypeSchema = z.object({
  /** Stable kebab-case identifier, e.g. "data-flow". */
  id: z.string().min(1),

  /** Human-readable label shown in edge type pickers. */
  label: z.string().min(1),

  /** One-sentence description of when to use this edge type. */
  description: z.string().min(1),

  /** Style tokens forwarded to the React Flow edge renderer in Phase 04. */
  styleTokens: z.record(z.string(), z.string()),
});

export type EdgeType = z.infer<typeof EdgeTypeSchema>;

// ---------------------------------------------------------------------------
// AliasMap — old typeId → current typeId
// ---------------------------------------------------------------------------

/**
 * A flat map of renamed/merged service type IDs.
 * Keys are old type IDs; values are the current canonical typeId that
 * appears in the `services` array.
 */
export const AliasMapSchema = z.record(z.string(), z.string());

export type AliasMap = z.infer<typeof AliasMapSchema>;

// ---------------------------------------------------------------------------
// Catalog — top-level registry returned by GET /api/catalog
// ---------------------------------------------------------------------------

export const CatalogSchema = z.object({
  /** Semver string. Bump on breaking changes to the shape. */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver"),

  services: z.array(ServiceSchema).min(1),
  categories: z.array(CategorySchema).min(1),
  edgeTypes: z.array(EdgeTypeSchema).min(1),
  aliases: AliasMapSchema,
});

export type Catalog = z.infer<typeof CatalogSchema>;
