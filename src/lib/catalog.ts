export type NodeCategory =
  | "compute"
  | "storage"
  | "ai"
  | "media"
  | "network"
  | "external";

export interface HandleDef {
  id: string;
  type: "source" | "target";
  position: "top" | "bottom" | "left" | "right";
}

export interface NodeTypeDef {
  typeId: string;
  label: string;
  category: NodeCategory;
  iconPath: string;
  description: string;
  defaultHandles: HandleDef[];
  wranglerBinding?: string;
}

export interface EdgeTypeDef {
  edgeType: string;
  label: string;
  style: "solid" | "dashed" | "dotted";
  animated: boolean;
  markerEnd: boolean;
  color: string;
  description: string;
  bindingType?: string;
}

const defaultHandles: HandleDef[] = [
  { id: "target-top", type: "target", position: "top" },
  { id: "source-bottom", type: "source", position: "bottom" },
  { id: "target-left", type: "target", position: "left" },
  { id: "source-right", type: "source", position: "right" },
];

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  compute: "#3B82F6",
  storage: "#10B981",
  ai: "#8B5CF6",
  media: "#EC4899",
  network: "#F59E0B",
  external: "#6B7280",
};

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  compute: "Compute",
  storage: "Storage & Data",
  ai: "AI",
  media: "Media",
  network: "Networking & Security",
  external: "External / Generic",
};

export const NODE_TYPES: NodeTypeDef[] = [
  // Compute
  {
    typeId: "worker",
    label: "Workers",
    category: "compute",
    iconPath: "/icons/worker.svg",
    description: "Cloudflare Workers serverless compute",
    defaultHandles,
    wranglerBinding: "worker",
  },
  {
    typeId: "pages",
    label: "Pages",
    category: "compute",
    iconPath: "/icons/pages.svg",
    description: "Cloudflare Pages for static sites and SSR",
    defaultHandles,
  },
  {
    typeId: "durable-object",
    label: "Durable Objects",
    category: "compute",
    iconPath: "/icons/durable-object.svg",
    description: "Stateful serverless objects with transactional storage",
    defaultHandles,
    wranglerBinding: "durable_objects",
  },
  {
    typeId: "workflow",
    label: "Workflows",
    category: "compute",
    iconPath: "/icons/workflow.svg",
    description: "Durable execution workflows",
    defaultHandles,
  },
  {
    typeId: "workers-for-platforms",
    label: "Workers for Platforms",
    category: "compute",
    iconPath: "/icons/workers-for-platforms.svg",
    description: "Multi-tenant Workers platform",
    defaultHandles,
    wranglerBinding: "dispatch_namespaces",
  },
  {
    typeId: "cron-trigger",
    label: "Cron Trigger",
    category: "compute",
    iconPath: "/icons/cron-trigger.svg",
    description: "Scheduled Worker execution via cron",
    defaultHandles: [
      { id: "source-bottom", type: "source", position: "bottom" },
      { id: "source-right", type: "source", position: "right" },
    ],
  },

  // Storage & Data
  {
    typeId: "d1",
    label: "D1 Database",
    category: "storage",
    iconPath: "/icons/d1.svg",
    description: "Serverless SQLite database at the edge",
    defaultHandles,
    wranglerBinding: "d1_databases",
  },
  {
    typeId: "kv",
    label: "Workers KV",
    category: "storage",
    iconPath: "/icons/kv.svg",
    description: "Global low-latency key-value store",
    defaultHandles,
    wranglerBinding: "kv_namespaces",
  },
  {
    typeId: "r2",
    label: "R2 Storage",
    category: "storage",
    iconPath: "/icons/r2.svg",
    description: "S3-compatible object storage with zero egress fees",
    defaultHandles,
    wranglerBinding: "r2_buckets",
  },
  {
    typeId: "queues",
    label: "Queues",
    category: "storage",
    iconPath: "/icons/queues.svg",
    description: "Message queues for async processing",
    defaultHandles,
    wranglerBinding: "queues",
  },
  {
    typeId: "hyperdrive",
    label: "Hyperdrive",
    category: "storage",
    iconPath: "/icons/hyperdrive.svg",
    description: "Connection pooling and caching for external databases",
    defaultHandles,
    wranglerBinding: "hyperdrive",
  },
  {
    typeId: "analytics-engine",
    label: "Analytics Engine",
    category: "storage",
    iconPath: "/icons/analytics-engine.svg",
    description: "High-cardinality time-series analytics",
    defaultHandles,
    wranglerBinding: "analytics_engine_datasets",
  },
  {
    typeId: "vectorize",
    label: "Vectorize",
    category: "storage",
    iconPath: "/icons/vectorize.svg",
    description: "Vector database for AI embeddings",
    defaultHandles,
    wranglerBinding: "vectorize",
  },

  // AI
  {
    typeId: "workers-ai",
    label: "Workers AI",
    category: "ai",
    iconPath: "/icons/workers-ai.svg",
    description: "Run AI models on Cloudflare's GPU network",
    defaultHandles,
    wranglerBinding: "ai",
  },
  {
    typeId: "ai-gateway",
    label: "AI Gateway",
    category: "ai",
    iconPath: "/icons/ai-gateway.svg",
    description: "Proxy, cache, and observe AI API calls",
    defaultHandles,
  },
  {
    typeId: "autorag",
    label: "AutoRAG",
    category: "ai",
    iconPath: "/icons/autorag.svg",
    description: "Automated retrieval-augmented generation",
    defaultHandles,
  },
  {
    typeId: "browser-rendering",
    label: "Browser Rendering",
    category: "ai",
    iconPath: "/icons/browser-rendering.svg",
    description: "Headless browser for rendering and scraping",
    defaultHandles,
    wranglerBinding: "browser",
  },
  {
    typeId: "agents",
    label: "AI Agents",
    category: "ai",
    iconPath: "/icons/agents.svg",
    description: "Autonomous AI agents on Cloudflare",
    defaultHandles,
  },

  // Media
  {
    typeId: "images",
    label: "Images",
    category: "media",
    iconPath: "/icons/images.svg",
    description: "On-the-fly image resizing and optimization",
    defaultHandles,
  },
  {
    typeId: "stream",
    label: "Stream",
    category: "media",
    iconPath: "/icons/stream.svg",
    description: "Video encoding, storage, and delivery",
    defaultHandles,
  },

  // Networking & Security
  {
    typeId: "dns",
    label: "DNS",
    category: "network",
    iconPath: "/icons/dns.svg",
    description: "Cloudflare DNS management",
    defaultHandles,
  },
  {
    typeId: "cdn",
    label: "CDN / Cache",
    category: "network",
    iconPath: "/icons/cdn.svg",
    description: "Global content delivery and caching",
    defaultHandles,
  },
  {
    typeId: "email-routing",
    label: "Email Routing",
    category: "network",
    iconPath: "/icons/email-routing.svg",
    description: "Email forwarding and Worker-based processing",
    defaultHandles,
  },
  {
    typeId: "access",
    label: "Cloudflare Access",
    category: "network",
    iconPath: "/icons/access.svg",
    description: "Zero Trust identity-aware proxy",
    defaultHandles,
  },
  {
    typeId: "waf",
    label: "WAF",
    category: "network",
    iconPath: "/icons/waf.svg",
    description: "Web Application Firewall",
    defaultHandles,
  },
  {
    typeId: "load-balancer",
    label: "Load Balancer",
    category: "network",
    iconPath: "/icons/load-balancer.svg",
    description: "Traffic distribution and health checks",
    defaultHandles,
  },

  // External / Generic
  {
    typeId: "external-api",
    label: "External API",
    category: "external",
    iconPath: "/icons/external-api.svg",
    description: "Third-party API endpoint",
    defaultHandles,
  },
  {
    typeId: "client-browser",
    label: "Client (Browser)",
    category: "external",
    iconPath: "/icons/client-browser.svg",
    description: "End-user web browser",
    defaultHandles: [
      { id: "source-bottom", type: "source", position: "bottom" },
      { id: "source-right", type: "source", position: "right" },
    ],
  },
  {
    typeId: "client-mobile",
    label: "Client (Mobile)",
    category: "external",
    iconPath: "/icons/client-mobile.svg",
    description: "End-user mobile application",
    defaultHandles: [
      { id: "source-bottom", type: "source", position: "bottom" },
      { id: "source-right", type: "source", position: "right" },
    ],
  },
  {
    typeId: "external-db",
    label: "External Database",
    category: "external",
    iconPath: "/icons/external-db.svg",
    description: "External database (Postgres, MySQL, etc.)",
    defaultHandles,
  },
];

export const EDGE_TYPES: EdgeTypeDef[] = [
  {
    edgeType: "data-flow",
    label: "Data Flow",
    style: "solid",
    animated: true,
    markerEnd: true,
    color: "#F6821F",
    description: "Primary data movement between services",
    bindingType: "http",
  },
  {
    edgeType: "service-binding",
    label: "Service Binding",
    style: "dashed",
    animated: false,
    markerEnd: false,
    color: "#3B82F6",
    description: "Worker-to-Worker service bindings",
    bindingType: "service",
  },
  {
    edgeType: "trigger",
    label: "Trigger",
    style: "dotted",
    animated: false,
    markerEnd: true,
    color: "#F59E0B",
    description: "Event triggers (Cron, Queue consumer, etc.)",
    bindingType: "event",
  },
  {
    edgeType: "external",
    label: "External",
    style: "solid",
    animated: false,
    markerEnd: true,
    color: "#9CA3AF",
    description: "Communication with external systems",
    bindingType: "http",
  },
];

export const NODE_TYPE_MAP = new Map(NODE_TYPES.map((n) => [n.typeId, n]));
export const EDGE_TYPE_MAP = new Map(EDGE_TYPES.map((e) => [e.edgeType, e]));

export function getNodesByCategory(): Record<NodeCategory, NodeTypeDef[]> {
  const grouped = {} as Record<NodeCategory, NodeTypeDef[]>;
  for (const node of NODE_TYPES) {
    if (!grouped[node.category]) grouped[node.category] = [];
    grouped[node.category].push(node);
  }
  return grouped;
}
