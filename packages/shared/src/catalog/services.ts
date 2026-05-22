/**
 * packages/shared/src/catalog/services.ts
 *
 * Seed data for every Cloudflare service (and generic architecture primitives)
 * in the CF-Architect catalog.
 *
 * Rules:
 *  - typeId is permanent and kebab-case. Never rename — add an alias instead.
 *  - iconId matches the filename stem of the SVG in apps/web/src/icons/src/.
 *  - docLink must be a valid URL for Cloudflare products; omitted for generic resources.
 *  - otherLinks is always [] in Phase 03 (D11 in docs/DECISION_LOG.md).
 *  - scaffoldBindingType is absent until Phase 09 wires it in.
 *
 * See packages/shared/src/catalog/CONTRIBUTING.md for the step-by-step guide
 * to adding a new service.
 */

import type { Service } from "./types.js";

export const SERVICES: readonly Service[] = [
  // -------------------------------------------------------------------------
  // Compute
  // -------------------------------------------------------------------------
  {
    typeId: "workers",
    name: "Cloudflare Workers",
    shortName: "Workers",
    categoryId: "compute",
    iconId: "workers",
    description:
      "Deploy serverless JavaScript/TypeScript functions at the edge across 300+ global locations.",
    docLink: "https://developers.cloudflare.com/workers/",
    otherLinks: [],
  },
  {
    typeId: "dynamic-workers",
    name: "Dynamic Workers",
    shortName: "Dynamic Workers",
    categoryId: "compute",
    iconId: "dynamic-workers",
    description: "Create and deploy Workers programmatically at runtime using the Cloudflare API.",
    docLink: "https://developers.cloudflare.com/workers/platform/dynamic-workers/",
    otherLinks: [],
  },
  {
    typeId: "containers",
    name: "Cloudflare Containers",
    shortName: "Containers",
    categoryId: "compute",
    iconId: "containers",
    description:
      "Run containerised workloads alongside Workers with co-located compute and storage.",
    docLink: "https://developers.cloudflare.com/workers/platform/containers/",
    otherLinks: [],
  },
  {
    typeId: "pages",
    name: "Cloudflare Pages",
    shortName: "Pages",
    categoryId: "compute",
    iconId: "pages",
    description: "Build and deploy full-stack web applications directly from a Git repository.",
    docLink: "https://developers.cloudflare.com/pages/",
    otherLinks: [],
  },

  // -------------------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------------------
  {
    typeId: "workers-kv",
    name: "Workers KV",
    shortName: "KV",
    categoryId: "storage",
    iconId: "kv",
    description:
      "Low-latency global key-value store optimised for read-heavy workloads in Workers.",
    docLink: "https://developers.cloudflare.com/kv/",
    otherLinks: [],
    scaffoldBindingType: "kv_namespaces",
  },
  {
    typeId: "r2",
    name: "Cloudflare R2",
    shortName: "R2",
    categoryId: "storage",
    iconId: "r2",
    description: "S3-compatible object storage with zero egress fees and global distribution.",
    docLink: "https://developers.cloudflare.com/r2/",
    otherLinks: [],
    scaffoldBindingType: "r2_buckets",
  },
  {
    typeId: "r2-event-notifications",
    name: "R2 Event Notifications",
    shortName: "R2 Events",
    categoryId: "storage",
    iconId: "notifications",
    description:
      "Trigger Workers or Queues consumers on R2 object create, delete, and restore events.",
    docLink: "https://developers.cloudflare.com/r2/buckets/event-notifications/",
    otherLinks: [],
  },
  {
    typeId: "workers-artifacts",
    name: "Workers Artifacts",
    shortName: "Artifacts",
    categoryId: "storage",
    iconId: "artifacts",
    description:
      "Store and retrieve immutable build artifacts produced during Workers deployments.",
    docLink: "https://developers.cloudflare.com/workers/platform/artifacts/",
    otherLinks: [],
  },

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------
  {
    typeId: "d1",
    name: "D1",
    shortName: "D1",
    categoryId: "data",
    iconId: "d1",
    description: "Serverless relational database built on SQLite, co-located with your Workers.",
    docLink: "https://developers.cloudflare.com/d1/",
    otherLinks: [],
    scaffoldBindingType: "d1_databases",
  },
  {
    typeId: "hyperdrive",
    name: "Hyperdrive",
    shortName: "Hyperdrive",
    categoryId: "data",
    iconId: "hyperdrive",
    description:
      "Accelerate queries to existing PostgreSQL or MySQL databases from Workers with connection pooling.",
    docLink: "https://developers.cloudflare.com/hyperdrive/",
    otherLinks: [],
    scaffoldBindingType: "hyperdrive",
  },
  {
    typeId: "durable-objects",
    name: "Durable Objects",
    shortName: "Durable Objects",
    categoryId: "data",
    iconId: "durable-objects",
    description:
      "Stateful serverless objects with strongly consistent co-located storage and coordination.",
    docLink: "https://developers.cloudflare.com/durable-objects/",
    otherLinks: [],
    scaffoldBindingType: "durable_objects",
  },
  {
    typeId: "pipelines",
    name: "Cloudflare Pipelines",
    shortName: "Pipelines",
    categoryId: "data",
    iconId: "pipelines",
    description: "Ingest, buffer, transform, and deliver high-volume event streams at scale.",
    docLink: "https://developers.cloudflare.com/pipelines/",
    otherLinks: [],
    scaffoldBindingType: "pipelines",
  },
  {
    typeId: "workers-analytics-engine",
    name: "Workers Analytics Engine",
    shortName: "Analytics Engine",
    categoryId: "data",
    iconId: "analytics",
    description: "Write high-volume time-series data from Workers and query it via SQL over HTTP.",
    docLink: "https://developers.cloudflare.com/analytics/analytics-engine/",
    otherLinks: [],
    scaffoldBindingType: "analytics_engine_datasets",
  },

  // -------------------------------------------------------------------------
  // AI & ML
  // -------------------------------------------------------------------------
  {
    typeId: "workers-ai",
    name: "Workers AI",
    shortName: "Workers AI",
    categoryId: "ai-ml",
    iconId: "workers-ai",
    description:
      "Run AI inference on Cloudflare's GPU network directly from Workers using a broad model catalogue.",
    docLink: "https://developers.cloudflare.com/workers-ai/",
    otherLinks: [],
    scaffoldBindingType: "ai",
  },
  {
    typeId: "vectorize",
    name: "Vectorize",
    shortName: "Vectorize",
    categoryId: "ai-ml",
    iconId: "vectorize",
    description:
      "Fully managed vector database for semantic search, recommendations, and RAG pipelines.",
    docLink: "https://developers.cloudflare.com/vectorize/",
    otherLinks: [],
    scaffoldBindingType: "vectorize",
  },
  {
    typeId: "ai-gateway",
    name: "AI Gateway",
    shortName: "AI Gateway",
    categoryId: "ai-ml",
    iconId: "ai-gateway",
    description:
      "Observe, cache, rate-limit, and control requests to AI providers like OpenAI and Anthropic.",
    docLink: "https://developers.cloudflare.com/ai-gateway/",
    otherLinks: [],
  },

  // -------------------------------------------------------------------------
  // Networking
  // -------------------------------------------------------------------------
  {
    typeId: "cdn-cache",
    name: "CDN & Cache",
    shortName: "CDN/Cache",
    categoryId: "networking",
    iconId: "cache",
    description:
      "Globally distributed content delivery network with flexible caching rules at the edge.",
    docLink: "https://developers.cloudflare.com/cache/",
    otherLinks: [],
  },
  {
    typeId: "dns",
    name: "Cloudflare DNS",
    shortName: "DNS",
    categoryId: "networking",
    iconId: "dns",
    description: "Authoritative DNS with DDoS protection, DNSSEC, and instant global propagation.",
    docLink: "https://developers.cloudflare.com/dns/",
    otherLinks: [],
  },
  {
    typeId: "magic-transit",
    name: "Magic Transit",
    shortName: "Magic Transit",
    categoryId: "networking",
    iconId: "magic-transit",
    description:
      "Network-layer DDoS protection, traffic acceleration, and policy enforcement for IP infrastructure.",
    docLink: "https://developers.cloudflare.com/magic-transit/",
    otherLinks: [],
  },
  {
    typeId: "magic-wan",
    name: "Magic WAN",
    shortName: "Magic WAN",
    categoryId: "networking",
    iconId: "cloudflare-wan",
    description:
      "Replace MPLS and SD-WAN hardware with Cloudflare's global network for secure connectivity.",
    docLink: "https://developers.cloudflare.com/magic-wan/",
    otherLinks: [],
  },
  {
    typeId: "argo-smart-routing",
    name: "Argo Smart Routing",
    shortName: "Argo",
    categoryId: "networking",
    iconId: "argo-smart-routing",
    description:
      "Route traffic across the fastest uncongested network paths using real-time Cloudflare telemetry.",
    docLink: "https://developers.cloudflare.com/argo-smart-routing/",
    otherLinks: [],
  },
  {
    typeId: "workers-vpc",
    name: "Workers VPC",
    shortName: "Workers VPC",
    categoryId: "networking",
    iconId: "workers-vpc",
    description: "Isolate Workers and their bindings into private virtual network segments.",
    docLink: "https://developers.cloudflare.com/workers/vpc/",
    otherLinks: [],
  },

  // -------------------------------------------------------------------------
  // Security
  // -------------------------------------------------------------------------
  {
    typeId: "zero-trust",
    name: "Cloudflare Zero Trust",
    shortName: "Zero Trust",
    categoryId: "security",
    iconId: "cloudflare-one",
    description:
      "Cloudflare One: a comprehensive SASE platform replacing VPNs with identity-aware access.",
    docLink: "https://developers.cloudflare.com/cloudflare-one/",
    otherLinks: [],
  },
  {
    typeId: "access",
    name: "Cloudflare Access",
    shortName: "Access",
    categoryId: "security",
    iconId: "access",
    description:
      "Enforce identity, device posture, and context-aware policies in front of any application.",
    docLink: "https://developers.cloudflare.com/cloudflare-one/policies/access/",
    otherLinks: [],
  },
  {
    typeId: "warp",
    name: "WARP Client",
    shortName: "WARP",
    categoryId: "security",
    iconId: "warp-client",
    description:
      "Device client that routes user traffic through Cloudflare's secure network for Zero Trust enforcement.",
    docLink: "https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/",
    otherLinks: [],
  },
  {
    typeId: "mtls",
    name: "mTLS",
    shortName: "mTLS",
    categoryId: "security",
    iconId: "ssl",
    description: "Mutual TLS authentication for Worker-to-Worker and client-to-Worker connections.",
    docLink: "https://developers.cloudflare.com/workers/runtime-apis/bindings/mtls/",
    otherLinks: [],
    scaffoldBindingType: "mtls_certificates",
  },
  {
    typeId: "rate-limiting",
    name: "Rate Limiting",
    shortName: "Rate Limiting",
    categoryId: "security",
    iconId: "rules",
    description: "Protect endpoints from abuse with configurable threshold rules at the edge.",
    docLink: "https://developers.cloudflare.com/waf/rate-limiting-rules/",
    otherLinks: [],
  },

  // -------------------------------------------------------------------------
  // Developer Tools
  // -------------------------------------------------------------------------
  {
    typeId: "browser-rendering",
    name: "Browser Rendering",
    shortName: "Browser Rendering",
    categoryId: "developer-tools",
    iconId: "browser-run",
    description:
      "Run headless Chromium from Workers for screenshots, PDF generation, and web scraping.",
    docLink: "https://developers.cloudflare.com/browser-rendering/",
    otherLinks: [],
    scaffoldBindingType: "browser",
  },
  {
    typeId: "workflows",
    name: "Cloudflare Workflows",
    shortName: "Workflows",
    categoryId: "developer-tools",
    iconId: "workflows",
    description:
      "Build durable, resumable multi-step workflows in Workers with automatic state persistence.",
    docLink: "https://developers.cloudflare.com/workflows/",
    otherLinks: [],
    scaffoldBindingType: "workflows",
  },

  // -------------------------------------------------------------------------
  // Communication
  // -------------------------------------------------------------------------
  {
    typeId: "queues",
    name: "Cloudflare Queues",
    shortName: "Queues",
    categoryId: "communication",
    iconId: "queues",
    description:
      "Message queue for decoupled, at-least-once delivery between Workers producers and consumers.",
    docLink: "https://developers.cloudflare.com/queues/",
    otherLinks: [],
    scaffoldBindingType: "queues",
  },
  {
    typeId: "email-routing",
    name: "Email Routing",
    shortName: "Email Routing",
    categoryId: "communication",
    iconId: "email-routing",
    description:
      "Process and route inbound email with custom Worker-based logic and forwarding rules.",
    docLink: "https://developers.cloudflare.com/email-routing/",
    otherLinks: [],
    scaffoldBindingType: "email",
  },
  {
    typeId: "stream",
    name: "Cloudflare Stream",
    shortName: "Stream",
    categoryId: "communication",
    iconId: "stream",
    description: "Video hosting, transcoding, and live streaming built for developers.",
    docLink: "https://developers.cloudflare.com/stream/",
    otherLinks: [],
  },

  // -------------------------------------------------------------------------
  // Platform
  // -------------------------------------------------------------------------
  {
    typeId: "service-bindings",
    name: "Service Bindings",
    shortName: "Service Bindings",
    categoryId: "platform",
    iconId: "link",
    description:
      "Connect Workers together with direct in-process calls, bypassing the public internet.",
    docLink: "https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/",
    otherLinks: [],
    scaffoldBindingType: "services",
  },
  {
    typeId: "images",
    name: "Cloudflare Images",
    shortName: "Images",
    categoryId: "platform",
    iconId: "images",
    description: "Store, resize, optimise, and deliver images at scale with a single API.",
    docLink: "https://developers.cloudflare.com/images/",
    otherLinks: [],
  },
  {
    typeId: "zaraz",
    name: "Zaraz",
    shortName: "Zaraz",
    categoryId: "platform",
    iconId: "zaraz",
    description:
      "Move third-party JavaScript from the browser to the Cloudflare edge to improve performance.",
    docLink: "https://developers.cloudflare.com/zaraz/",
    otherLinks: [],
  },

  // -------------------------------------------------------------------------
  // Generic — non-Cloudflare architecture primitives (D13 in DECISION_LOG.md)
  // These have no docLink because they are not Cloudflare products.
  // -------------------------------------------------------------------------
  {
    typeId: "gen-user",
    name: "User",
    shortName: "User",
    categoryId: "generic",
    iconId: "gen-user",
    description: "An end user or person interacting with the system via browser, mobile, or CLI.",
    otherLinks: [],
  },
  {
    typeId: "gen-agent",
    name: "AI Agent",
    shortName: "Agent",
    categoryId: "generic",
    iconId: "gen-agent",
    description: "An autonomous AI agent or bot that interacts with the system programmatically.",
    otherLinks: [],
  },
  {
    typeId: "gen-external-api",
    name: "External API",
    shortName: "External API",
    categoryId: "generic",
    iconId: "gen-external-api",
    description: "A third-party or external API endpoint outside the Cloudflare network.",
    otherLinks: [],
  },
  {
    typeId: "gen-internet",
    name: "Internet / Cloud",
    shortName: "Internet",
    categoryId: "generic",
    iconId: "gen-internet",
    description: "The public internet, or a third-party cloud provider (AWS, GCP, Azure, etc.).",
    otherLinks: [],
  },
  {
    typeId: "gen-mobile",
    name: "Mobile App",
    shortName: "Mobile",
    categoryId: "generic",
    iconId: "gen-mobile",
    description: "A native mobile application client (iOS, Android).",
    otherLinks: [],
  },
  {
    typeId: "gen-browser",
    name: "Web Browser",
    shortName: "Browser",
    categoryId: "generic",
    iconId: "gen-browser",
    description: "A web browser client consuming a web application.",
    otherLinks: [],
  },
  {
    typeId: "gen-server",
    name: "Origin Server",
    shortName: "Server",
    categoryId: "generic",
    iconId: "gen-server",
    description: "A backend origin server, self-hosted application, or on-premises service.",
    otherLinks: [],
  },
  {
    typeId: "gen-database",
    name: "External Database",
    shortName: "Database",
    categoryId: "generic",
    iconId: "gen-database",
    description: "An external or self-managed relational or NoSQL database.",
    otherLinks: [],
  },
];
