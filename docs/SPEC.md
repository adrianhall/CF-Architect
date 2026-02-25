# CF Architect — Project Specification

> **Status:** Ready for Implementation (v1.0)  
> **Last updated:** 2026-02-25  
> **Stack:** Astro 6 + React islands on the Cloudflare Developer Platform

---

## 1. Overview

CF Architect is a web application for designing, building, and sharing architecture diagrams for the Cloudflare Developer Platform. Users drag and drop Cloudflare service nodes onto an interactive canvas, connect them to represent data flow and service bindings, and share finished diagrams via a read-only link with customers or stakeholders. Future versions will add blueprint templates, AI-assisted generation, and project scaffolding (see §2 Post-MVP Goals).

The application runs entirely on the Cloudflare Developer Platform — deployed as an Astro 6 site with server-side rendering on Cloudflare Workers, using D1 for persistence, R2 for asset storage, and KV for session/sharing metadata.

---

## 2. Goals & Non-Goals

### Goals (MVP)

| # | Goal |
|---|------|
| G1 | Users can create, edit, duplicate, and delete architecture diagrams. (Auth is bypassed in MVP — see §10.) |
| G2 | Users can start a new diagram from a blank canvas. |
| G3 | Drag-and-drop canvas with snapping, zoom, pan, and auto-layout. |
| G4 | A palette of every Cloudflare Developer Platform product as typed, styled nodes. |
| G5 | Directed edges between nodes representing data flow, service bindings, or triggers. |
| G6 | Share a diagram via a unique, read-only URL (no auth required for viewers). |
| G7 | Diagrams persist across sessions with autosave. |
| G8 | Responsive layout — usable on desktop; graceful fallback on tablet. |

### Post-MVP Goals

| # | Goal | Notes |
|---|------|-------|
| PG1 | Start a new diagram from a curated set of Cloudflare reference architecture blueprints. | Blueprint templates defined in §7. |
| PG2 | Export diagram as PNG or SVG. | Export flow defined in §16. |
| PG3 | AI-powered diagram generation from natural language. | See §11.1. |
| PG4 | Project starter / scaffold generator. | See §11.2. |
| PG5 | Real-time collaborative editing (multi-cursor). | May revisit with Durable Objects — see §11.3. |
| PG6 | Version history / undo stack beyond the current session. | Persisted undo is a follow-on. |
| PG7 | OIDC-based authentication via Auth0 (with upstream IdP federation). | Oslo / Arctic middleware — see §10.2. |
| PG8 | CI/CD pipeline via GitHub Actions. | Lint, typecheck, test, build, and deploy on merge — see §20.2. |

### Non-Goals

| # | Non-Goal | Notes |
|---|----------|-------|
| NG1 | Mobile-first editing experience. | View-only sharing will be mobile-friendly. |
| NG2 | Non-Cloudflare service nodes (AWS, GCP, etc.). | Scope is Cloudflare platform only. |

---

## 3. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Astro 6 (latest stable) | Server-first, islands architecture, first-class Cloudflare Workers adapter with `workerd` dev server. |
| **UI Islands** | React 19 via `client:load` / `client:only="react"` | Rich interactive canvas requires a client-side component model; React has the strongest diagramming library ecosystem. |
| **Diagram Engine** | `@xyflow/react` (React Flow) v12 | Production-grade node-graph library with built-in drag-and-drop, zoom/pan, minimap, and custom nodes/edges. MIT licensed. |
| **Styling** | Tailwind CSS 4 + CSS Modules (for canvas components) | Utility-first for layout; CSS Modules for encapsulated node/edge styles. |
| **State Management** | Zustand | Lightweight, React Flow's recommended state solution. Works well inside islands. |
| **Auth (MVP)** | Bypassed — single implicit user, no login required | Allows focus on the core diagram editor. Auth boundary is designed in but not enforced. |
| **Auth (Post-MVP)** | OIDC via Auth0, implemented with Oslo (`@oslojs/oauth2`, `@oslojs/jwt`) + Arctic | Auth0 as the single OIDC provider; upstream IdPs (GitHub, Google, SAML) configured in Auth0. Oslo/Arctic chosen over official Auth0 SDK because it is runtime-agnostic and works natively in Workers. |
| **Database** | Cloudflare D1 (SQLite) | Relational storage for diagrams, users, and share links. Edge-local reads. |
| **Blob Storage** | Cloudflare R2 | PNG/SVG exports, blueprint thumbnail images, and future uploaded assets. |
| **Session / Cache** | Cloudflare Workers KV | Share-link metadata and short-lived caches. Post-MVP: session tokens for OIDC. |
| **ORM / Query Builder** | Drizzle ORM | Type-safe, lightweight, excellent D1 support. |
| **Schema Validation** | Zod | Runtime validation for API payloads and diagram JSON. |
| **Testing** | Vitest + Testing Library + Playwright | Unit/integration in Vitest; E2E with Playwright against `wrangler dev`. |
| **Deployment** | `wrangler deploy` (Cloudflare Workers) | Single command deploy. CI added post-MVP. |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│                                                             │
│  ┌──────────────┐  ┌─────────────────────────────────────┐  │
│  │ Astro static │  │ React Island: DiagramCanvas         │  │
│  │ shell (HTML) │  │  ├─ Toolbar (palette, actions)      │  │
│  │              │  │  ├─ React Flow <ReactFlow />        │  │
│  │  - Nav       │  │  │   ├─ Custom CF Nodes             │  │
│  │  - Sidebar   │  │  │   ├─ Custom Edges                │  │
│  │  - Footer    │  │  │   └─ MiniMap, Controls           │  │
│  │              │  │  └─ PropertiesPanel                 │  │
│  └──────────────┘  └─────────────────────────────────────┘  │
│                              │                              │
│                              │ fetch / REST                 │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Cloudflare Workers (Astro SSR)               │
│                                                             │
│  ┌────────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  │
│  │ API Routes │  │   Auth    │  │ Share    │  │ Blueprint│  │
│  │ /api/v1/*  │  │ Middleware│  │ Resolver │  │ Loader   │  │
│  └─────┬──────┘  └───────────┘  └────┬─────┘  └────┬─────┘  │
│        │                             │             │        │
│        ▼                             ▼             ▼        │
│  ┌──────────┐                 ┌──────────┐  ┌──────────┐    │
│  │    D1    │                 │    KV    │  │    R2    │    │
│  │ (SQLite) │                 │ (cache)  │  │ (blobs)  │    │
│  └──────────┘                 └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. **Authenticated page load** — Astro renders the shell (nav, sidebar) on the edge. The `<DiagramCanvas client:load />` island hydrates and fetches diagram data from `/api/v1/diagrams/:id`.
2. **Autosave** — The canvas debounces changes (500 ms) and PUTs the full `graph_data` to `/api/v1/diagrams/:id/graph`.
3. **Share** — User clicks "Share". The API creates a KV entry mapping a short token → diagram ID + permissions. The share URL is `https://<domain>/s/:token`.
4. **Read-only view** — Share link hits an Astro page that resolves the token via KV, fetches the diagram from D1, and renders a non-editable React Flow canvas.

---

## 5. Data Model

### 5.1 `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PRIMARY KEY` | UUID v7 |
| `email` | `TEXT UNIQUE` | Nullable in MVP (no auth). Required once OIDC is implemented. |
| `display_name` | `TEXT` | |
| `avatar_url` | `TEXT` | |
| `created_at` | `TEXT NOT NULL` | ISO 8601 |
| `updated_at` | `TEXT NOT NULL` | ISO 8601 |

> **MVP note:** A single seed user row (`id = "00000000-0000-0000-0000-000000000000"`) is created by the initial migration. All diagrams are owned by this user. The `users` table schema is designed to support multi-user OIDC later without migration changes beyond making `email` `NOT NULL`.

### 5.2 `diagrams`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PRIMARY KEY` | UUID v7 |
| `owner_id` | `TEXT NOT NULL` | FK → `users.id` |
| `title` | `TEXT NOT NULL` | Default: "Untitled Diagram" |
| `description` | `TEXT` | Optional summary |
| `graph_data` | `TEXT NOT NULL` | JSON blob — React Flow serialized state (nodes, edges, viewport) |
| `thumbnail_key` | `TEXT` | R2 object key for preview image |
| `blueprint_id` | `TEXT` | Slug of the blueprint used to create this diagram (references `Blueprint.id` in `src/lib/blueprints.ts`). Null if started from blank. |
| `created_at` | `TEXT NOT NULL` | ISO 8601 |
| `updated_at` | `TEXT NOT NULL` | ISO 8601 |

### 5.3 `share_links`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PRIMARY KEY` | UUID v7 |
| `diagram_id` | `TEXT NOT NULL` | FK → `diagrams.id` |
| `token` | `TEXT UNIQUE NOT NULL` | Short, URL-safe token (nanoid, 12 chars) |
| `created_by` | `TEXT NOT NULL` | FK → `users.id` |
| `expires_at` | `TEXT` | Nullable — null means no expiry |
| `created_at` | `TEXT NOT NULL` | ISO 8601 |

> Share-link tokens are also written to KV (`share:<token>` → `{ diagramId, expiresAt }`) for fast edge lookups without hitting D1.

### 5.4 Blueprints (static data — not in D1)

Blueprints are **hard-coded JSON** in `src/lib/blueprints.ts`, not stored in D1. Each blueprint is a typed object:

```typescript
interface Blueprint {
  id: string;           // Stable slug, e.g. "api-gateway"
  title: string;
  description: string;
  category: string;     // e.g. "Serverless", "AI", "Storage"
  graphData: string;    // Pre-built React Flow JSON
}
```

"Start from blueprint" copies the blueprint's `graphData` into a new diagram row in D1. Blueprints themselves are never written to the database.

---

## 6. Cloudflare Service Node Types

Each node on the canvas represents a Cloudflare product. Nodes are rendered as custom React Flow nodes with an icon, label, and typed connection handles.

### 6.1 Node Categories & Products

#### Compute

| Node Type ID | Label | Icon Source |
|-------------|-------|-------------|
| `worker` | Workers | CF brand assets |
| `pages` | Pages | CF brand assets |
| `durable-object` | Durable Objects | CF brand assets |
| `workflow` | Workflows | CF brand assets |
| `workers-for-platforms` | Workers for Platforms | CF brand assets |
| `cron-trigger` | Cron Trigger | CF brand assets |

#### Storage & Data

| Node Type ID | Label | Icon Source |
|-------------|-------|-------------|
| `d1` | D1 Database | CF brand assets |
| `kv` | Workers KV | CF brand assets |
| `r2` | R2 Storage | CF brand assets |
| `queues` | Queues | CF brand assets |
| `hyperdrive` | Hyperdrive | CF brand assets |
| `analytics-engine` | Analytics Engine | CF brand assets |
| `vectorize` | Vectorize | CF brand assets |

#### AI

| Node Type ID | Label | Icon Source |
|-------------|-------|-------------|
| `workers-ai` | Workers AI | CF brand assets |
| `ai-gateway` | AI Gateway | CF brand assets |
| `autorag` | AutoRAG | CF brand assets |
| `browser-rendering` | Browser Rendering | CF brand assets |
| `agents` | AI Agents | CF brand assets |

#### Media

| Node Type ID | Label | Icon Source |
|-------------|-------|-------------|
| `images` | Images | CF brand assets |
| `stream` | Stream | CF brand assets |

#### Networking & Security

| Node Type ID | Label | Icon Source |
|-------------|-------|-------------|
| `dns` | DNS | CF brand assets |
| `cdn` | CDN / Cache | CF brand assets |
| `email-routing` | Email Routing | CF brand assets |
| `access` | Cloudflare Access | CF brand assets |
| `waf` | WAF | CF brand assets |
| `load-balancer` | Load Balancer | CF brand assets |

#### External / Generic

| Node Type ID | Label | Icon Source |
|-------------|-------|-------------|
| `external-api` | External API | Generic icon |
| `client-browser` | Client (Browser) | Generic icon |
| `client-mobile` | Client (Mobile) | Generic icon |
| `external-db` | External Database | Generic icon |

### 6.2 Node Data Schema (per instance on canvas)

```typescript
interface CFNodeData {
  typeId: string;          // e.g. "worker"
  label: string;           // user-editable, default from type
  description?: string;    // optional annotation
  config?: Record<string, unknown>; // type-specific metadata
  style?: {
    accentColor?: string;  // override category color
  };
}
```

### 6.3 Edge Types

| Edge Type | Rendering | Use Case |
|-----------|-----------|----------|
| `data-flow` | Solid arrow, animated dash | Primary data movement between services |
| `service-binding` | Dashed line, no arrow | Worker-to-Worker service bindings |
| `trigger` | Dotted line with lightning icon | Event triggers (Cron, Queue consumer, etc.) |
| `external` | Thin gray arrow | Communication with external systems |

### 6.4 Edge Data Schema

```typescript
interface CFEdgeData {
  edgeType: "data-flow" | "service-binding" | "trigger" | "external";
  label?: string;           // e.g. "REST", "gRPC", "binding:AUTH_SERVICE"
  description?: string;     // tooltip annotation
  protocol?: string;        // "http" | "ws" | "binding" | "queue" | "email"
}
```

---

## 7. Blueprint Templates (Post-MVP)

Blueprints provide pre-built starting points based on common Cloudflare architecture patterns. They map to patterns documented in Cloudflare's official reference architectures and the "Architecting on Cloudflare" guide.

| Blueprint ID | Title | Source Pattern | Key Nodes |
|-------------|-------|---------------|-----------|
| `api-gateway` | API Gateway | CF Ref Arch — API Gateway | Client → Worker (gateway) → Workers (services) via service bindings → D1/KV |
| `fullstack-app` | Full-Stack Web App | CF Ref Arch — Serverless | Client → Pages/Worker (SSR) → D1 + R2 + KV |
| `ai-rag` | AI RAG Pipeline | CF Ref Arch — AI | Client → Worker → Workers AI + Vectorize + D1 → AI Gateway |
| `event-driven` | Event-Driven Processing | CF Ref Arch — Event-Driven | Worker (producer) → Queues → Worker (consumer) → R2/D1 |
| `realtime-collab` | Real-Time Collaboration | CF Ref Arch — Collaboration | Client (WS) → Durable Objects → D1 |
| `multi-tenant-saas` | Multi-Tenant SaaS | CF Ref Arch — Programmable Platforms | Client → Worker (router) → Workers for Platforms → D1/KV per tenant |
| `media-pipeline` | Media Processing Pipeline | CF Ref Arch — Content Delivery | Client → Worker → Stream + Images → R2 → CDN |
| `bff` | Backend for Frontend | CF Ref Arch — BFF | Client (Web) → Worker (BFF-Web), Client (Mobile) → Worker (BFF-Mobile) → shared Workers → D1 |

---

## 8. Pages & Routing

| Route | Auth (MVP) | Auth (Post-MVP) | Description |
|-------|-----------|-----------------|-------------|
| `/` | None | None | Landing / marketing page. Redirects to `/dashboard`. |
| `/login` | N/A (not rendered) | None | OAuth login flow entry point. Added when OIDC is implemented. |
| `/dashboard` | None | Authenticated | List of user's diagrams with create, duplicate, delete actions. |
| `/diagram/:id` | None | Owner | Full diagram editor canvas. |
| `/diagram/:id/settings` | None | Owner | Diagram metadata, sharing options, export. |
| `/blueprints` | None | Authenticated | Browse and preview blueprint templates. "Use this blueprint" creates a new diagram. |
| `/s/:token` | None | None | Read-only shared view. Renders non-editable canvas. |
| `/api/v1/*` | None | Varies | REST API (see §9). |

---

## 9. API Design

All API routes live under `/api/v1/` and are implemented as Astro API routes (server endpoints running on Workers).

### 9.1 Diagrams

| Method | Path | Auth (MVP) | Auth (Post-MVP) | Description |
|--------|------|-----------|-----------------|-------------|
| `GET` | `/api/v1/diagrams` | None | User | List diagrams. MVP returns all diagrams for the seed user. |
| `POST` | `/api/v1/diagrams` | None | User | Create a new diagram. Accepts optional `blueprintId` to clone from. |
| `GET` | `/api/v1/diagrams/:id` | None | Owner | Fetch a single diagram with full `graph_data`. |
| `PUT` | `/api/v1/diagrams/:id/graph` | None | Owner | Replace `graph_data` in full. Used by autosave. Idempotent. |
| `PATCH` | `/api/v1/diagrams/:id` | None | Owner | Partial update of diagram metadata (title, description). |
| `DELETE` | `/api/v1/diagrams/:id` | None | Owner | Soft-delete a diagram. |

### 9.2 Sharing

| Method | Path | Auth (MVP) | Auth (Post-MVP) | Description |
|--------|------|-----------|-----------------|-------------|
| `POST` | `/api/v1/diagrams/:id/share` | None | Owner | Create a share link. Returns `{ token, url }`. Optional `expiresIn` (seconds). |
| `DELETE` | `/api/v1/diagrams/:id/share/:token` | None | Owner | Revoke a share link. |
| `GET` | `/api/v1/share/:token` | None | None | Resolve a share token to diagram data. Used by the `/s/:token` page. |

### 9.3 Blueprints

| Method | Path | Auth (MVP) | Auth (Post-MVP) | Description |
|--------|------|-----------|-----------------|-------------|
| `GET` | `/api/v1/blueprints` | None | User | List all available blueprints. |
| `GET` | `/api/v1/blueprints/:id` | None | User | Fetch a single blueprint with `graph_data`. |

### 9.4 Export

| Method | Path | Auth (MVP) | Auth (Post-MVP) | Description |
|--------|------|-----------|-----------------|-------------|
| `POST` | `/api/v1/diagrams/:id/export` | None | Owner | Request PNG or SVG export. Accepts `{ format: "png" | "svg" }`. Returns a signed R2 URL. |

### 9.5 Response Envelope

```typescript
// Success
{ "ok": true, "data": T }

// Error
{ "ok": false, "error": { "code": string, "message": string } }
```

---

## 10. Authentication & Authorization

### 10.1 MVP: Auth Bypass (Single-User Mode)

For MVP, authentication is **bypassed entirely**. There is no login page, no OAuth flow, and no session management. The system operates in single-user mode:

1. The initial D1 migration seeds a default user row (`id = "00000000-0000-0000-0000-000000000000"`).
2. Astro middleware (`src/middleware.ts`) unconditionally sets `locals.user` to the seed user on every request.
3. All API routes skip auth checks. All diagrams belong to the seed user.
4. The middleware is designed with a **strategy interface** (`AuthStrategy`) to cleanly separate auth logic from route handlers and the Zustand store. When OIDC replaces bypass mode post-MVP, only the `AuthStrategy` implementation changes — route handlers and components remain untouched.

```typescript
// src/lib/auth/types.ts — stable contract across MVP and post-MVP
interface AuthStrategy {
  resolveUser(request: Request, env: Env): Promise<AppUser | null>;
}

interface AppUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}
```

### 10.2 Post-MVP: OIDC Authentication

When auth is implemented, the app will delegate all authentication to a single OIDC provider. Auth0 handles identity federation internally — GitHub, Google, enterprise SAML/SSO, MFA, and any other upstream identity providers are configured within the Auth0 tenant, not in application code. This keeps the app's auth surface to a single OIDC integration.

**Why Auth0 as the sole provider:**

- One OIDC integration in the codebase covers all upstream IdPs (GitHub, Google, SAML, etc.) via Auth0 connections.
- Enterprise features (MFA, custom domains, role management, branding) are handled by Auth0 without app-level code.
- The official Auth0 SDKs do not run on Cloudflare Workers (`workerd`), so we use Oslo/Arctic instead — they are runtime-agnostic and use only `fetch` + Web Crypto API.

**Libraries:**

| Package | Role |
|---------|------|
| `@oslojs/oauth2` | OAuth 2.0 / OIDC token exchange, PKCE, and state management. Runtime-agnostic (works in Workers). |
| `@oslojs/jwt` | JWT verification for session tokens and Auth0 `id_token` validation. |
| `arctic` | Pre-built Auth0 OIDC client class. Handles discovery, token endpoints, and user info. Built on Oslo. |

**Configuration (environment variables):**

| Variable | Description |
|----------|-------------|
| `OIDC_DOMAIN` | Auth0 tenant domain, e.g. `cf-architect.us.auth0.com` |
| `OIDC_CLIENT_ID` | OAuth client ID from Auth0 application settings |
| `OIDC_CLIENT_SECRET` | OAuth client secret (stored via `wrangler secret`) |
| `OIDC_CALLBACK_URL` | Redirect URI, e.g. `https://<domain>/login/callback` |

**Flow:**

1. User clicks "Sign in".
2. Middleware redirects to Auth0's `/authorize` endpoint with PKCE challenge (via `@oslojs/oauth2`).
3. Auth0 authenticates the user (directly, or via a configured upstream connection like GitHub).
4. Auth0 redirects back to `/login/callback` with an authorization code.
5. Callback route exchanges the code for tokens (via Arctic's `Auth0` client), validates the `id_token` (via `@oslojs/jwt`), and upserts the user in D1.
6. A session token (signed JWT or opaque token) is set as an HTTP-only, Secure, SameSite=Lax cookie. Session metadata is stored in KV for fast validation and revocation.
7. Middleware resolves `locals.user` from the session cookie on subsequent requests.

**Switching from bypass to OIDC:** We do not support switching via configuration.  When authentication is required, code will be updated to support it and bypass will no longer be available.

### 10.3 Middleware

Astro middleware (`src/middleware.ts`) runs on every request:

1. Delegates to the active `AuthStrategy.resolveUser()` to populate `locals.user`.
  * In the MVP, always returns the seed user. 
  * Once OIDC is implemented, validates the session cookie and returns 401 for protected routes if no valid session.
2. For API mutation routes (post-MVP), validates `Content-Type` and CSRF token.

### 10.4 Authorization Rules

- **MVP:** All routes are open. All diagrams belong to the seed user.
- **Post-MVP:** A user can only read/write their own diagrams. Share links grant read-only access to anyone with the token. Blueprints are readable by all authenticated users. No admin role — blueprint management is via migration scripts.

---

## 11. Future Work (Phase 2+)

These features are explicitly out of scope for MVP but inform architectural decisions now to avoid costly rework later.

### 11.1 AI-Powered Diagram Generation

**Goal:** A user types a natural language prompt (e.g., "I need a real-time chat app with persistent message history and image uploads") and the system generates or modifies a diagram.

**Approach:**
- Workers AI or AI Gateway routes to an LLM (Claude, GPT, etc.).
- The LLM receives a structured prompt including the Cloudflare product catalog and edge type definitions (from §6) and returns a `graph_data` JSON patch.
- A "suggestion" mode overlays proposed changes on the canvas for user approval before committing.
- Chat-style iteration: user can refine via follow-up prompts.

**Architectural prep (MVP):**
- The `graph_data` schema (§6) is the contract between the canvas and any generator. Keep it stable and well-validated with Zod.
- The product catalog (node types, connection rules) should live in a standalone `src/lib/catalog.ts` module that can be serialized into an LLM prompt.

### 11.2 Project Starter Generator

**Goal:** From a completed diagram, generate a downloadable ZIP containing a wrangler project with the correct `wrangler.toml` bindings, placeholder Worker scripts, D1 migrations, and a README.

**Approach:**
- Walk the diagram graph, resolve each node to a wrangler primitive (worker, D1 binding name, KV namespace, R2 bucket, etc.).
- Use code templates (Handlebars or simple string interpolation) to emit files.
- Package via a Worker-side ZIP library (e.g., `fflate`) and stream the response or upload to R2 for download.

**Architectural prep (MVP):**
- Each node type in the catalog should include a `wranglerBinding` field describing how it maps to `wrangler.toml` config.
- Edge types should include a `bindingType` field ("service", "queue", "d1", etc.).

### 11.3 Real-Time Collaboration

**Approach:** Durable Objects per diagram with WebSocket connections for each participant. CRDT or OT for conflict resolution on `graph_data`.

**Architectural prep (MVP):**
- The `graph_data` Zod schema and React Flow serialization format should remain stable and well-documented, as any future sync protocol will operate on this structure.
- The `AuthStrategy` interface supports identifying distinct users, which is a prerequisite for multi-cursor presence.

---

## 12. UI / UX Design Principles

### 12.1 Layout (Editor View)

```
┌──────────────────────────────────────────────────────────────┐
│  Navbar   [ Logo ]  [ Diagram Title (editable) ]   [ Share ] │
├────────────┬─────────────────────────────────────┬───────────┤
│            │                                     │           │
│  Service   │                                     │ Properties│
│  Palette   │        Canvas (React Flow)          │   Panel   │
│            │                                     │           │
│  - Compute │                                     │ (selected │
│  - Storage │                                     │  node/    │
│  - AI      │                                     │  edge     │
│  - Media   │                                     │  details) │
│  - Network │                                     │           │
│            │                                     │           │
├────────────┴─────────────────────────────────────┴───────────┤
│  Status bar   [ Zoom: 100% ]  [ MiniMap toggle ]  [ Export ] │
└──────────────────────────────────────────────────────────────┘
```

### 12.2 Interactions

| Action | Mechanism |
|--------|-----------|
| Add node | Drag from palette onto canvas, or double-click palette item |
| Move node | Drag on canvas |
| Connect nodes | Drag from source handle to target handle |
| Select | Click node/edge; Shift+click for multi-select; drag-select box |
| Delete | `Delete` / `Backspace` key, or right-click context menu |
| Edit properties | Select node/edge → Properties Panel on right |
| Zoom | Scroll wheel, pinch, or zoom controls |
| Pan | Middle-click drag, or hold Space + drag |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` (session-only) |
| Auto-layout | Toolbar button — applies ELK layout algorithm |
| Search palette | Type-ahead filter in palette header |

### 12.3 Visual Design

- **Color palette:** Cloudflare brand orange (`#F6821F`) as the primary accent. Category-coded node borders (blue for compute, green for storage, purple for AI, etc.).
- **Dark mode:** Supported from day one. Canvas background uses a subtle dot grid.
- **Node appearance:** Rounded rectangle with product icon (left), label (center), and typed connection handles (top/bottom/sides). Hover reveals a tooltip with description.
- **Edge appearance:** Animated dashes for data-flow, static dashes for bindings, dotted for triggers. Labels rendered at midpoint.
- **Typography:** Inter (or system font stack) for UI; monospace for code-like annotations.

### 12.4 Shared (Read-Only) View

- Identical canvas rendering but with all editing controls hidden.
- A banner at the top: "You're viewing a shared diagram. [Sign up to create your own →]".
- Zoom and pan remain enabled.
- Post-MVP: export to PNG/SVG available from a floating toolbar (see PG2).

---

## 13. Project Structure

```
cf-architect/
├── astro.config.mjs           # Astro + Cloudflare adapter config
├── wrangler.toml              # D1, KV, R2 bindings
├── drizzle.config.ts          # Drizzle ORM config for D1
├── package.json
├── tsconfig.json
├── tailwind.config.mjs
│
├── docs/
│   └── SPEC.md                # This file
│
├── public/
│   └── icons/                 # CF product SVG icons
│
├── migrations/                # D1 migrations (Drizzle)
│   └── 0001_initial.sql
│
├── src/
│   ├── middleware.ts           # Auth, CSRF, locals injection
│   │
│   ├── lib/
│   │   ├── catalog.ts         # Node type & edge type definitions (the product catalog)
│   │   ├── blueprints.ts      # Blueprint graph_data definitions
│   │   ├── db/
│   │   │   ├── schema.ts      # Drizzle table definitions
│   │   │   └── client.ts      # D1 client helper
│   │   ├── auth/
│   │   │   ├── types.ts       # AuthStrategy interface, AppUser type
│   │   │   ├── bypass.ts      # MVP: returns seed user unconditionally
│   │   │   └── oidc.ts        # Post-MVP: Oslo/Arctic OIDC implementation (stub in MVP)
│   │   ├── share.ts           # Share-link creation & resolution (KV + D1)
│   │   └── export.ts          # PNG/SVG export helpers
│   │
│   ├── components/            # Astro components (server-rendered)
│   │   ├── Layout.astro
│   │   ├── Navbar.astro
│   │   └── Footer.astro
│   │
│   ├── islands/               # React island components (client-hydrated)
│   │   ├── DiagramCanvas.tsx   # Main React Flow canvas wrapper
│   │   ├── nodes/
│   │   │   ├── CFNode.tsx      # Generic CF product node renderer
│   │   │   └── nodeTypes.ts    # React Flow nodeTypes registry
│   │   ├── edges/
│   │   │   ├── CFEdge.tsx      # Custom edge renderer
│   │   │   └── edgeTypes.ts    # React Flow edgeTypes registry
│   │   ├── panels/
│   │   │   ├── ServicePalette.tsx  # Draggable service palette sidebar
│   │   │   └── PropertiesPanel.tsx # Selected-item property editor
│   │   ├── toolbar/
│   │   │   ├── Toolbar.tsx
│   │   │   └── ExportButton.tsx
│   │   ├── dashboard/
│   │   │   └── DiagramList.tsx # Dashboard diagram grid
│   │   └── store/
│   │       └── diagramStore.ts # Zustand store for canvas state
│   │
│   ├── pages/
│   │   ├── index.astro         # Landing page
│   │   ├── dashboard.astro     # User dashboard
│   │   ├── diagram/
│   │   │   └── [id].astro      # Editor page
│   │   ├── blueprints.astro    # Blueprint gallery
│   │   ├── s/
│   │   │   └── [token].astro   # Shared read-only view
│   │   └── api/
│   │       └── v1/
│   │           ├── diagrams/
│   │           │   ├── index.ts        # GET (list), POST (create)
│   │           │   ├── [id].ts         # GET, PATCH, DELETE
│   │           │   ├── [id]/graph.ts   # PUT (autosave graph_data)
│   │           │   ├── [id]/share.ts   # POST (create share)
│   │           │   └── [id]/export.ts  # POST (export) — post-MVP
│   │           ├── share/
│   │           │   └── [token].ts      # GET (resolve share)
│   │           └── blueprints/
│   │               ├── index.ts        # GET (list)
│   │               └── [id].ts         # GET (single)
│   │
│   └── styles/
│       └── global.css          # Tailwind directives, theme variables
│
└── tests/
    ├── unit/                   # Vitest unit tests
    ├── integration/            # Vitest + D1 in-memory
    └── e2e/                    # Playwright
```

---

## 14. Cloudflare Resource Bindings

`wrangler.toml` will declare the following bindings:

```toml
name = "cf-architect"
compatibility_date = "2026-02-25"
compatibility_flags = ["nodejs_compat"]

[observability]
enabled = true

[[d1_databases]]
binding = "DB"
database_name = "cf-architect-db"
database_id = "<generated>"

[[kv_namespaces]]
binding = "KV"
id = "<generated>"

[[r2_buckets]]
binding = "R2"
bucket_name = "cf-architect-assets"

# Environment variables (set via `wrangler secret put`)
# Post-MVP (OIDC / Auth0) — not needed for MVP bypass mode:
# OIDC_DOMAIN        — Auth0 tenant domain, e.g. cf-architect.us.auth0.com
# OIDC_CLIENT_ID     — OAuth client ID from Auth0 application settings
# OIDC_CLIENT_SECRET — OAuth client secret
# OIDC_CALLBACK_URL  — Redirect URI, e.g. https://<domain>/login/callback
# SESSION_SECRET     — Key for signing session cookies
```

---

## 15. Autosave Strategy

1. The Zustand store tracks a `dirty` flag and a `lastSavedAt` timestamp.
2. On any node/edge mutation, `dirty` is set to `true`.
3. A `useEffect` debounce (500 ms) triggers a PUT to `/api/v1/diagrams/:id/graph` with the full `graph_data`. PUT semantics are used because the entire graph state is replaced on each save, making retries safely idempotent.
4. On success, `dirty` resets and `lastSavedAt` updates. The status bar shows "Saved" with a relative timestamp.
5. On failure (network error, 409 conflict), a toast notification appears and the next save retries with exponential backoff (max 3 retries).
6. Before the user navigates away, a `beforeunload` handler warns if `dirty` is true.

---

## 16. Export Flow (Post-MVP — see PG2)

> Export is deferred to post-MVP. The flow below documents the planned implementation.

1. User clicks "Export as PNG" or "Export as SVG".
2. Client-side: React Flow's `toObject()` serializes the viewport. For PNG, the canvas is rendered to a `<canvas>` element via `html-to-image` (or React Flow's built-in export utilities) and converted to a Blob. For SVG, the React Flow SVG DOM is serialized.
3. The Blob is uploaded to `/api/v1/diagrams/:id/export` which stores it in R2 and returns a time-limited signed URL.
4. The browser triggers a download from the signed URL.
5. The R2 key is saved to `diagrams.thumbnail_key` so the dashboard can show previews.

---

## 17. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Large diagrams (100+ nodes) | React Flow virtualizes off-screen nodes. Zustand avoids re-renders of unchanged nodes. |
| Autosave payload size | `graph_data` is typically <100 KB. If it grows, compress with `gzip` (Workers support streaming compression). |
| Cold starts | Astro 6 + Workers: sub-5ms isolate startup. No container spin-up. |
| D1 read latency | D1 replicates reads to the nearest edge. Write path goes to primary but is acceptable for autosave cadence. |
| KV eventual consistency | Share-link resolution via KV is read-heavy and tolerant of ~60s propagation delay. |
| Bundle size | React Flow + Zustand are the main client dependencies (~80 KB gzipped). Astro's island architecture avoids shipping unused JS. |

---

## 18. Security

| Vector | Control (MVP) | Control (Post-MVP) |
|--------|--------------|-------------------|
| XSS | Astro auto-escapes server-rendered HTML. React handles client-side escaping. CSP headers enabled via Astro 6's built-in support. | Same. |
| CSRF | Not enforced (single-user, no session cookies). | API mutations require a CSRF token (double-submit cookie pattern). |
| Auth bypass | Intentional — single-user mode. No user-specific data isolation. Consider deploying behind Cloudflare Access if exposed publicly. | Middleware enforces auth on all `/dashboard`, `/diagram`, `/api/v1` routes. |
| Data leakage | All diagrams belong to the seed user. No multi-tenant concern. | Diagrams scoped to `owner_id`. All D1 queries include `WHERE owner_id = ?`. |
| Share link enumeration | Tokens are 12-character nanoid (URL-safe alphabet, ~71 bits of entropy). | Same, plus rate limiting on `/s/:token` via Workers. |
| Secrets | No OAuth secrets in MVP. | OAuth credentials and session secrets stored via `wrangler secret`, never in code or `wrangler.toml`. |
| R2 access | R2 objects are not publicly accessible. Signed URLs expire after 5 minutes for exports. | Same. |

---

## 19. Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | Catalog logic, Zod schemas, share-token generation, graph_data transforms. |
| Component | Vitest + Testing Library | React island components (CFNode rendering, palette interactions, properties panel). |
| Integration | Vitest + Miniflare D1 | API routes against an in-memory D1 instance. Auth middleware with mocked identity. |
| E2E | Playwright | Full flows: create diagram → add nodes → connect → share → view shared link. Post-MVP: add login/logout flows. |

---

## 20. Deployment & CI

### 20.1 NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `wrangler dev` | Starts the local Cloudflare Workers emulator (`workerd`) with full access to D1, KV, and R2 bindings via Miniflare. Astro 6 runs inside the same `workerd` runtime, so dev matches production. |
| `npm run build` | `astro build` | Builds the Astro site for production deployment. |
| `npm run deploy` | `wrangler d1 migrations apply DB --remote && wrangler deploy` | Applies pending D1 migrations to the production database, then deploys the built site to Cloudflare Workers. |
| `npm run lint` | `eslint . && prettier --check .` | Lints and format-checks the codebase. |
| `npm run typecheck` | `tsc --noEmit` | Type-checks without emitting output. |
| `npm run test` | `vitest run` | Runs unit and integration tests via Vitest. |
| `npm run test:e2e` | `playwright test` | Runs end-to-end tests against a local `wrangler dev` instance. |

### 20.2 CI Pipeline (Post-MVP — GitHub Actions)

> CI is deferred to post-MVP. During MVP, developers run `npm start` locally and `npm run deploy` manually.

When implemented, the pipeline will:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`
6. `npm run deploy` (production only — on merge to `main`)

### 20.3 Environments

- **Local (MVP)** — `npm start` runs the full stack locally via `wrangler dev` with local D1/KV/R2 emulation. `npm run deploy` deploys manually to production.
- **Preview (Post-MVP)** — auto-deployed on PR via CI. Uses a separate D1 database and KV namespace.
- **Production** — MVP: deployed manually via `npm run deploy`. Post-MVP: deployed on merge to `main` via CI.

---

## 21. Resolved Questions

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Should blueprints be hard-coded JSON or stored in D1? | **Hard-coded JSON within the project.** Blueprints live as static data in `src/lib/blueprints.ts`, not in D1. No seed migration needed. |
| Q2 | License for Cloudflare product icons? Are the developer docs SVGs usable? | **Resolved.** Developer docs SVGs are licensed and usable. |
| Q3 | Should diagram `graph_data` support JSON Patch updates (prep for collab)? | **No.** Full replacement via PUT is sufficient. Real-time collab is not on the near-term roadmap; read-only sharing covers the current need. |
| Q4 | Auto-layout algorithm preference: dagre vs. ELK? | **ELK (`elkjs`).** Port-aware layout, orthogonal edge routing, and active maintenance. See comparison below. |
| Q5 | Should shared diagrams be forkable by other authenticated users? | **No.** Shared diagrams are strictly read-only and not forkable. |
| Q6 | Rate limiting strategy for API endpoints? | **Use Cloudflare's platform-level rate limiting.** No in-code rate limiting for MVP. |
| Q7 | When OIDC is implemented, should sessions be stored in KV or as signed JWTs (stateless)? | **Deferred** until OIDC implementation. |

### Q4: dagre vs. ELK — Auto-Layout Comparison

| Dimension | dagre (`@dagrejs/dagre`) | ELK (`elkjs`) |
|-----------|------------------------|---------------|
| **What it does** | Single-purpose directed graph layout (top-down or left-right layered trees). | Full layout engine with multiple algorithms: layered, force, stress, radial, tree, rectangle packing. |
| **Bundle size** | ~30 KB minified (~10 KB gzipped) | ~140 KB minified (~45 KB gzipped). Can be loaded as a web worker to avoid blocking the main thread. |
| **Configuration** | Minimal — rank direction, node/edge spacing, rank separation. | Highly configurable — 150+ options including edge routing strategy, port constraints, layer assignment, crossing minimization. |
| **Edge routing** | No built-in edge routing. Edges are straight lines between node centers. | Orthogonal, polyline, and spline edge routing. Produces cleaner diagrams with fewer crossings. |
| **Port/handle support** | No concept of ports. Edges connect to node bounding boxes. | First-class port support with `FIXED_ORDER` and `FIXED_SIDE` constraints. Maps directly to React Flow handles. |
| **Multiple handles per node** | Handles all connect to the same point. Layout doesn't account for which handle an edge uses. | Each edge can target a specific port (handle). Layout positions edges to minimize crossings per-port. |
| **Maintenance** | Last published 6+ years ago. Effectively unmaintained (though stable). | Actively maintained by the Eclipse KIELER team. Regular releases. |
| **React Flow integration** | Drop-in example in React Flow docs. Very common in tutorials. | Official React Flow examples for both single-handle and multi-handle layouts. |

**Recommendation for CF Architect:** ELK is the stronger fit. Our nodes have multiple typed handles (top/bottom/sides for different connection types), and architecture diagrams benefit heavily from orthogonal edge routing and port-aware layout. The ~35 KB gzipped cost over dagre is modest relative to React Flow itself (~80 KB), and ELK's web worker mode avoids main-thread jank on larger diagrams. dagre would work for simple cases but would struggle with our multi-handle nodes and produce visually inferior edge routing.

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **Blueprint** | A pre-built diagram template representing a common Cloudflare architecture pattern. |
| **Canvas** | The interactive area where users build diagrams by placing and connecting nodes. |
| **Edge** | A connection between two nodes on the canvas, representing data flow or a binding. |
| **Island** | An Astro concept: an interactive UI component that hydrates on the client while the rest of the page remains static HTML. |
| **Node** | A visual element on the canvas representing a Cloudflare product or external service. |
| **Share Token** | A short, unique, URL-safe string that grants read-only access to a diagram. |
| **`graph_data`** | The serialized JSON representation of a diagram's nodes, edges, and viewport state. |

---

## Appendix B: Reference Links

- [Astro 6 Documentation](https://v6.docs.astro.build/)
- [Astro Cloudflare Adapter](https://v6.docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Developer Platform Products](https://www.cloudflare.com/developer-platform/products/)
- [Cloudflare Reference Architecture Diagrams](https://developers.cloudflare.com/reference-architecture/diagrams/)
- [Architecting on Cloudflare](https://architectingoncloudflare.com/)
- [React Flow (xyflow)](https://reactflow.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Oslo (auth utilities)](https://oslojs.dev/)
- [Arctic (OAuth/OIDC provider clients)](https://arctic.js.org/)
