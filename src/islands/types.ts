/**
 * Shared data interfaces for React Flow nodes and edges on the canvas.
 *
 * These types define the `data` payload attached to each React Flow `Node`
 * and `Edge`. They are used by the Zustand store, custom node/edge renderers,
 * the properties panel, and the autosave serialisation logic.
 */

/**
 * Data payload for a Cloudflare service node on the canvas.
 *
 * Stored as `node.data` in the React Flow graph and serialised into `graph_data`
 * in D1 on every autosave.
 */
export interface CFNodeData {
  /** Catalog type identifier (e.g. "worker", "d1"). Links to the product catalog. */
  typeId: string;
  /** User-editable display label shown on the canvas. Defaults to the catalog label. */
  label: string;
  /** Optional free-text annotation shown below the label. */
  description?: string;
  /** Type-specific configuration metadata (reserved for future use). */
  config?: Record<string, unknown>;
  /** Visual style overrides. */
  style?: {
    /** Override the default category border/handle colour. */
    accentColor?: string;
  };
  /** Index signature required by React Flow's generic `Node<T>` constraint. */
  [key: string]: unknown;
}

/**
 * Data payload for a connection edge between two nodes on the canvas.
 *
 * Stored as `edge.data` in the React Flow graph and serialised into `graph_data`
 * in D1 on every autosave.
 */
export interface CFEdgeData {
  /** Visual/semantic type controlling stroke style, animation, and arrowheads. */
  edgeType: "data-flow" | "service-binding" | "trigger" | "external";
  /** Optional label rendered at the edge midpoint. */
  label?: string;
  /** Optional tooltip annotation. */
  description?: string;
  /** Communication protocol hint (e.g. "http", "ws", "binding"). */
  protocol?: string;
  /** Index signature required by React Flow's generic `Edge<T>` constraint. */
  [key: string]: unknown;
}
