/**
 * Static registry of Cloudflare Developer Platform services (spec §4.4).
 *
 * Each service has a unique type key, display name, category, icon path,
 * and description. The registry drives the service selector toolbar and
 * the custom `cf-service` tldraw shape.
 */

/** A category grouping for Cloudflare services, used for toolbar sections. */
export type CfServiceCategory = 'compute' | 'storage' | 'ai' | 'media' | 'messaging' | 'networking'

/** Definition of a single Cloudflare service in the registry. */
export interface CfServiceDefinition {
  /** Unique key used as the `serviceType` prop on shapes (e.g., `'workers'`). */
  type: string
  /** Human-readable name (e.g., `'Workers'`). */
  displayName: string
  /** Category for toolbar grouping. */
  category: CfServiceCategory
  /** Path to SVG icon in `/public/icons/cf/`. */
  iconPath: string
  /** Short description shown as toolbar tooltip. */
  description: string
}

/**
 * Display order for service categories in the toolbar.
 * This determines the order of category headings.
 */
const CATEGORY_ORDER: CfServiceCategory[] = [
  'compute',
  'storage',
  'ai',
  'media',
  'messaging',
  'networking',
]

/**
 * All Cloudflare Developer Platform services.
 *
 * The order within each category matches the order they appear in the
 * service selector toolbar.
 */
export const CF_SERVICES: CfServiceDefinition[] = [
  // Compute
  {
    type: 'workers',
    displayName: 'Workers',
    category: 'compute',
    iconPath: '/icons/cf/workers.svg',
    description: 'Serverless compute at the edge',
  },
  {
    type: 'pages',
    displayName: 'Pages',
    category: 'compute',
    iconPath: '/icons/cf/pages.svg',
    description: 'Full-stack application hosting',
  },
  {
    type: 'durable-objects',
    displayName: 'Durable Objects',
    category: 'compute',
    iconPath: '/icons/cf/durable-objects.svg',
    description: 'Stateful serverless coordination',
  },
  {
    type: 'browser-rendering',
    displayName: 'Browser Rendering',
    category: 'compute',
    iconPath: '/icons/cf/browser-rendering.svg',
    description: 'Headless browser API',
  },

  // Storage
  {
    type: 'd1',
    displayName: 'D1',
    category: 'storage',
    iconPath: '/icons/cf/d1.svg',
    description: 'Serverless SQL database',
  },
  {
    type: 'kv',
    displayName: 'KV',
    category: 'storage',
    iconPath: '/icons/cf/kv.svg',
    description: 'Global key-value storage',
  },
  {
    type: 'r2',
    displayName: 'R2',
    category: 'storage',
    iconPath: '/icons/cf/r2.svg',
    description: 'S3-compatible object storage',
  },
  {
    type: 'hyperdrive',
    displayName: 'Hyperdrive',
    category: 'storage',
    iconPath: '/icons/cf/hyperdrive.svg',
    description: 'Database connection pooling',
  },
  {
    type: 'vectorize',
    displayName: 'Vectorize',
    category: 'storage',
    iconPath: '/icons/cf/vectorize.svg',
    description: 'Vector database for embeddings',
  },

  // AI
  {
    type: 'workers-ai',
    displayName: 'Workers AI',
    category: 'ai',
    iconPath: '/icons/cf/workers-ai.svg',
    description: 'Serverless AI inference',
  },
  {
    type: 'ai-gateway',
    displayName: 'AI Gateway',
    category: 'ai',
    iconPath: '/icons/cf/ai-gateway.svg',
    description: 'AI API gateway and caching',
  },

  // Media
  {
    type: 'stream',
    displayName: 'Stream',
    category: 'media',
    iconPath: '/icons/cf/stream.svg',
    description: 'Video streaming and storage',
  },
  {
    type: 'images',
    displayName: 'Images',
    category: 'media',
    iconPath: '/icons/cf/images.svg',
    description: 'Image optimization and transformation',
  },

  // Messaging
  {
    type: 'queues',
    displayName: 'Queues',
    category: 'messaging',
    iconPath: '/icons/cf/queues.svg',
    description: 'Message queues',
  },
  {
    type: 'pub-sub',
    displayName: 'Pub/Sub',
    category: 'messaging',
    iconPath: '/icons/cf/pub-sub.svg',
    description: 'MQTT-compatible messaging',
  },
  {
    type: 'email-routing',
    displayName: 'Email Routing',
    category: 'messaging',
    iconPath: '/icons/cf/email-routing.svg',
    description: 'Email handling and forwarding',
  },

  // Networking
  {
    type: 'dns',
    displayName: 'DNS',
    category: 'networking',
    iconPath: '/icons/cf/dns.svg',
    description: 'DNS management',
  },
  {
    type: 'spectrum',
    displayName: 'Spectrum',
    category: 'networking',
    iconPath: '/icons/cf/spectrum.svg',
    description: 'TCP/UDP proxy',
  },
]

/**
 * Get a service definition by its unique type key.
 *
 * @param type - The service type key (e.g., `'workers'`, `'d1'`).
 * @returns The matching {@link CfServiceDefinition}, or `undefined` if not found.
 */
export function getServiceByType(type: string): CfServiceDefinition | undefined {
  return CF_SERVICES.find((s) => s.type === type)
}

/**
 * Get all services belonging to a specific category.
 *
 * @param category - The {@link CfServiceCategory} to filter by.
 * @returns Array of {@link CfServiceDefinition} in that category.
 */
export function getServicesByCategory(category: CfServiceCategory): CfServiceDefinition[] {
  return CF_SERVICES.filter((s) => s.category === category)
}

/**
 * Get all unique service categories in display order.
 *
 * @returns Array of {@link CfServiceCategory} in the order they should appear in the toolbar.
 */
export function getCategories(): CfServiceCategory[] {
  return [...CATEGORY_ORDER]
}
