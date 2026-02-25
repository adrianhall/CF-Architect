/**
 * Blueprint template definitions.
 *
 * Blueprints are pre-built diagram templates representing common Cloudflare
 * architecture patterns. They are hard-coded as static data rather than stored
 * in D1. "Start from blueprint" copies the blueprint's `graphData` into a new
 * diagram row.
 *
 * The array is empty in the MVP. Post-MVP (PG1) will populate it with patterns
 * such as API Gateway, Full-Stack App, AI RAG Pipeline, etc.
 */

/** A pre-built architecture diagram template. */
export interface Blueprint {
  /** Stable slug identifier (e.g. "api-gateway"). */
  id: string;
  /** Human-readable template name. */
  title: string;
  /** Short summary of the architecture pattern. */
  description: string;
  /** Grouping category (e.g. "Serverless", "AI", "Storage"). */
  category: string;
  /** Pre-built React Flow JSON (nodes, edges, viewport) as a serialised string. */
  graphData: string;
}

/** All available blueprint templates. Empty in MVP. */
export const BLUEPRINTS: Blueprint[] = [];

/** Lookup map from blueprint ID to its definition. */
export const BLUEPRINT_MAP = new Map(BLUEPRINTS.map((b) => [b.id, b]));
