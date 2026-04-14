# Cloudflare Architect - Engineering Specification

## 1. Overview

Cloudflare Architect is a web application for creating, editing, sharing, and exporting service architecture diagrams for the Cloudflare Developer Platform. It has three functional areas:

1. **Canvas Editor** (Side 1) - Authenticated users create and edit architecture diagrams using an interactive tldraw canvas with custom Cloudflare service shapes.
2. **Share Viewer** (Side 2) - Anonymous users view and export shared diagrams via a unique token URL.
3. **Admin Panel** (Side 3) - Authenticated administrators manage users and promote/demote roles.

---

## 2. Data Model

### 2.1 Database Schema (D1 via Kysely)

Migration files stored in `src/lib/db/migrations/` using Wrangler D1 migration format.

#### Table: `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `github_id` | TEXT | UNIQUE, NOT NULL | GitHub user ID from CF Access JWT |
| `github_username` | TEXT | NOT NULL | GitHub login handle |
| `email` | TEXT | NOT NULL | Email from GitHub profile |
| `display_name` | TEXT | NOT NULL | Display name |
| `avatar_url` | TEXT | | GitHub avatar URL |
| `role` | TEXT | NOT NULL, DEFAULT 'user' | `'admin'` or `'user'` |
| `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | ISO 8601 |
| `updated_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | ISO 8601 |

#### Table: `diagrams`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `owner_id` | TEXT | NOT NULL, FK -> users.id | Creator user |
| `title` | TEXT | NOT NULL | Diagram name |
| `description` | TEXT | DEFAULT '' | Optional description |
| `canvas_data` | TEXT | NOT NULL | JSON string of tldraw store snapshot |
| `thumbnail_svg` | TEXT | | Cached SVG thumbnail for listings |
| `is_blueprint` | INTEGER | NOT NULL, DEFAULT 0 | 1 if promoted to blueprint |
| `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | ISO 8601 |
| `updated_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | ISO 8601 |

#### Table: `diagram_tags`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `diagram_id` | TEXT | NOT NULL, FK -> diagrams.id ON DELETE CASCADE | Parent diagram |
| `tag` | TEXT | NOT NULL | Tag label (lowercase, trimmed) |

Unique constraint on `(diagram_id, tag)`.

#### Table: `share_tokens`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `diagram_id` | TEXT | NOT NULL, FK -> diagrams.id ON DELETE CASCADE | Shared diagram |
| `token` | TEXT | UNIQUE, NOT NULL | URL-safe random token (24 chars) |
| `created_by` | TEXT | NOT NULL, FK -> users.id | User who created the share |
| `expires_at` | TEXT | | Optional expiry (ISO 8601), NULL = never |
| `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | ISO 8601 |

### 2.2 KV Cache Schema

| Key Pattern | Value | TTL | Purpose |
|-------------|-------|-----|---------|
| `share:{token}` | JSON: `{ diagramId, canvasData, title, description }` | 1 hour | Cache shared diagram for anonymous access |
| `user:{email}` | JSON: serialized user row | 15 min | Cache user lookups to avoid D1 reads per request |

### 2.3 Kysely Type Definitions

File: `src/lib/db/schema.ts`

```typescript
export interface Database {
  users: UsersTable
  diagrams: DiagramsTable
  diagram_tags: DiagramTagsTable
  share_tokens: ShareTokensTable
}

export interface UsersTable {
  id: string
  github_id: string
  github_username: string
  email: string
  display_name: string
  avatar_url: string | null
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
}

export interface DiagramsTable {
  id: string
  owner_id: string
  title: string
  description: string
  canvas_data: string
  thumbnail_svg: string | null
  is_blueprint: number  // D1 uses INTEGER for booleans
  created_at: string
  updated_at: string
}

export interface DiagramTagsTable {
  id: string
  diagram_id: string
  tag: string
}

export interface ShareTokensTable {
  id: string
  diagram_id: string
  token: string
  created_by: string
  expires_at: string | null
  created_at: string
}
```

---

## 3. Authentication & Authorization

### 3.1 Cloudflare Access Integration

CF Access is configured as an edge-level reverse proxy. It intercepts requests **before** they reach the Worker, so the Access application must be scoped to protected path prefixes only. Unmatched paths pass through to the Worker without an auth gate.

The Access application covers these path-scoped domains (see Terraform in §9):
- `<app_domain>/canvas` - Diagram editor
- `<app_domain>/admin` - Admin panel
- `<app_domain>/api` - All API endpoints

Upon successful GitHub OAuth, CF Access sets a `CF_Authorization` JWT cookie.

#### Routes outside CF Access (anonymous access):
- `/` - Landing page
- `/share/*` - Anonymous share viewer (SSR, no API call)

These routes are never intercepted by CF Access and hit the Worker directly.

### 3.2 Astro Middleware (`src/middleware.ts`)

The middleware runs on every request and:

1. **Public routes** (`/`, `/share/*`): Pass through without auth.
2. **CSRF origin check**: For mutation requests (`POST`, `PUT`, `DELETE`) to `/api/*`, check the `Origin` header. If present and does not match the application's own origin, return `403 Forbidden`. This is defense-in-depth against CSRF beyond the `SameSite=Lax` cookie set by CF Access.
3. **Protected routes**: Extract and validate the `CF_Authorization` cookie.
4. **JWT validation**: Verify the JWT signature against CF Access's JWKS endpoint (`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`). Cache the JWKS in KV for 1 hour. The JWT contains only standard OIDC claims (`sub`, `email`, `aud`, `exp`), not GitHub profile data.
5. **User resolution**: Extract `email` from JWT claims. Look up user in DB by email (check KV cache first).
6. **Identity fetch (on first login / cache miss)**: If user not found in DB, fetch the full GitHub profile from the CF Access identity endpoint (`https://<team>.cloudflareaccess.com/cdn-cgi/access/get-identity`), passing the user's `CF_Authorization` cookie. This returns GitHub-specific fields: `user_uuid`, `name`, `preferred_username` (GitHub login), and the GitHub IdP profile including `avatar_url`. Cache this profile data in KV alongside the user record.
7. **Auto-provisioning**: If user not found in DB, create with `role: 'user'` using profile data from step 5. If the user's GitHub username matches the `INITIAL_ADMIN_GITHUB_USERNAME` env var (case-insensitive) and no admin exists yet, create with `role: 'admin'` instead.
8. **Populate `Astro.locals`**: Set `user` object (id, role, github_username, etc.) on locals for downstream pages/APIs.
9. **Admin routes** (`/admin/*`, `/api/admin/*`): Check `user.role === 'admin'`. Return 403 if not.

### 3.3 Middleware Type Extension

File: `src/env.d.ts`

```typescript
/// <reference path="../.astro/types.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<{
  DB: D1Database
  CACHE: KVNamespace
}>

declare namespace App {
  interface Locals extends Runtime {
    user: {
      id: string
      github_id: string
      github_username: string
      email: string
      display_name: string
      avatar_url: string | null
      role: 'admin' | 'user'
    } | null
  }
}
```

---

## 4. Side 1: Canvas Editor

### 4.1 Page Routes

| Route | File | Description |
|-------|------|-------------|
| `/canvas/new` | `src/pages/canvas/new.astro` | Create new diagram (blank or from blueprint) |
| `/canvas/new?blueprint=:id` | Same file | Create from blueprint template |
| `/canvas/[id]` | `src/pages/canvas/[id].astro` | Edit existing diagram |

### 4.2 Canvas Editor Component

File: `src/components/canvas/CanvasEditor.tsx`

This is a React component rendered as a `client:only="react"` island.

**Props:**
```typescript
interface CanvasEditorProps {
  diagramId?: string       // Existing diagram ID (edit mode)
  initialData?: string          // JSON string of tldraw store snapshot
  blueprintData?: string        // JSON string of blueprint to clone
  title?: string                // Existing title
  description?: string          // Existing description
}
```

**Behavior:**
- Renders `<Tldraw>` with custom shape utils and UI overrides.
- On mount, loads `initialData` or `blueprintData` via `store.loadStoreSnapshot()`.
- If neither provided, starts with an empty canvas.
- Auto-saves to the API every 30 seconds when changes are detected (debounced).
- Provides a custom top bar with: title input, description input, save button, share button, export button, back to dashboard.

**Asset restrictions:**
- External image/asset pasting and embedding is disabled. D1 has a 1MB query size limit, and base64-encoded images in the canvas snapshot would easily exceed it. These are service architecture diagrams composed of custom shapes and arrows -- raster images are not needed.
- Configure via tldraw's `acceptedImageMimeTypes: []` and `acceptedVideoMimeTypes: []` options, and override `onEditorReady` to remove the asset tools.
- The only visual elements on the canvas are `cf-service` custom shapes, tldraw's built-in arrows, and text labels.

**Self-hosted tldraw UI assets:**
- By default tldraw fetches its fonts, icons, and translations from a public CDN (unpkg/jsdelivr). These requests may be blocked in corporate environments with strict network policies.
- Self-host all tldraw UI assets via `public/tldraw-assets/` so they are served by Cloudflare Workers Assets alongside the rest of the static files.
- At build time, copy assets from `node_modules/@tldraw/assets` into `public/tldraw-assets/` (add a script to `package.json`: `"copy:tldraw-assets"`). Run this as part of the `build` script.
- Configure tldraw to use local paths:
  ```tsx
  import { getAssetUrls } from '@tldraw/assets/selfHosted'

  const assetUrls = getAssetUrls({ baseUrl: '/tldraw-assets/' })

  <Tldraw assetUrls={assetUrls} ... />
  ```
- This applies to both `CanvasEditor` and `CanvasViewer` components.
- Add `public/tldraw-assets/` to `.gitignore` since these are copied from `node_modules` at build time.

### 4.3 Custom Cloudflare Service Shapes

File: `src/components/canvas/shapes/CfServiceShapeUtil.tsx`

A single custom shape type `cf-service` handles all Cloudflare services via props:

```typescript
interface CfServiceShapeProps {
  w: number                // Width (default: 140)
  h: number                // Height (default: 140)
  serviceType: string      // Key into service registry (e.g., 'workers', 'd1', 'kv')
  label: string            // User-editable label (defaults to service display name)
}
```

**Shape behavior:**
- Renders the official Cloudflare SVG icon for the service, the service name, and the user label.
- Uses `BaseBoxShapeUtil` for built-in resize handles.
- Implements `toSvg()` for clean SVG export (renders native SVG, not foreignObject).
- Double-click to edit the label inline.
- Styled with Cloudflare brand colors (orange accent `#F6821F`, dark background `#1A1A2E`).

### 4.4 Cloudflare Service Registry

File: `src/components/canvas/shapes/cf-services.ts`

A static registry of all Cloudflare Developer Platform services:

```typescript
export interface CfServiceDefinition {
  type: string              // Unique key (e.g., 'workers')
  displayName: string       // Human-readable name (e.g., 'Workers')
  category: CfServiceCategory
  iconPath: string          // Path to SVG in /public/icons/cf/
  description: string       // Short description for toolbar tooltip
}

export type CfServiceCategory =
  | 'compute'
  | 'storage'
  | 'ai'
  | 'media'
  | 'messaging'
  | 'networking'

export const CF_SERVICES: CfServiceDefinition[] = [
  // Compute
  { type: 'workers', displayName: 'Workers', category: 'compute', iconPath: '/icons/cf/workers.svg', description: 'Serverless compute at the edge' },
  { type: 'pages', displayName: 'Pages', category: 'compute', iconPath: '/icons/cf/pages.svg', description: 'Full-stack application hosting' },
  { type: 'durable-objects', displayName: 'Durable Objects', category: 'compute', iconPath: '/icons/cf/durable-objects.svg', description: 'Stateful serverless coordination' },
  { type: 'browser-rendering', displayName: 'Browser Rendering', category: 'compute', iconPath: '/icons/cf/browser-rendering.svg', description: 'Headless browser API' },

  // Storage
  { type: 'd1', displayName: 'D1', category: 'storage', iconPath: '/icons/cf/d1.svg', description: 'Serverless SQL database' },
  { type: 'kv', displayName: 'KV', category: 'storage', iconPath: '/icons/cf/kv.svg', description: 'Global key-value storage' },
  { type: 'r2', displayName: 'R2', category: 'storage', iconPath: '/icons/cf/r2.svg', description: 'S3-compatible object storage' },
  { type: 'hyperdrive', displayName: 'Hyperdrive', category: 'storage', iconPath: '/icons/cf/hyperdrive.svg', description: 'Database connection pooling' },
  { type: 'vectorize', displayName: 'Vectorize', category: 'storage', iconPath: '/icons/cf/vectorize.svg', description: 'Vector database for embeddings' },

  // AI
  { type: 'workers-ai', displayName: 'Workers AI', category: 'ai', iconPath: '/icons/cf/workers-ai.svg', description: 'Serverless AI inference' },
  { type: 'ai-gateway', displayName: 'AI Gateway', category: 'ai', iconPath: '/icons/cf/ai-gateway.svg', description: 'AI API gateway and caching' },

  // Media
  { type: 'stream', displayName: 'Stream', category: 'media', iconPath: '/icons/cf/stream.svg', description: 'Video streaming and storage' },
  { type: 'images', displayName: 'Images', category: 'media', iconPath: '/icons/cf/images.svg', description: 'Image optimization and transformation' },

  // Messaging
  { type: 'queues', displayName: 'Queues', category: 'messaging', iconPath: '/icons/cf/queues.svg', description: 'Message queues' },
  { type: 'pub-sub', displayName: 'Pub/Sub', category: 'messaging', iconPath: '/icons/cf/pub-sub.svg', description: 'MQTT-compatible messaging' },
  { type: 'email-routing', displayName: 'Email Routing', category: 'messaging', iconPath: '/icons/cf/email-routing.svg', description: 'Email handling and forwarding' },

  // Networking
  { type: 'dns', displayName: 'DNS', category: 'networking', iconPath: '/icons/cf/dns.svg', description: 'DNS management' },
  { type: 'spectrum', displayName: 'Spectrum', category: 'networking', iconPath: '/icons/cf/spectrum.svg', description: 'TCP/UDP proxy' },
]
```

### 4.5 Service Selector Toolbar

File: `src/components/canvas/ServiceToolbar.tsx`

A custom sidebar panel (not replacing tldraw's toolbar) that lists available Cloudflare services grouped by category.

**Behavior:**
- Displayed as a collapsible left sidebar panel overlaying the canvas.
- Services grouped under category headings (Compute, Storage, AI, Media, Messaging, Networking).
- Each service shows its icon, name, and description tooltip.
- **Drag to canvas**: User drags a service from the toolbar onto the canvas. This creates a new `cf-service` shape at the drop position.
  - Implementation: Use tldraw's `editor.createShape()` on drop, with the service type from the drag data.
- **Search/filter**: Text input at top filters services by name.
- Styled with Cloudflare brand colors and shadcn/ui components.

### 4.6 Canvas Persistence

**Save flow (auto-save + manual save):**
1. Get current snapshot: `editor.store.getStoreSnapshot()`
2. Serialize to JSON string.
3. `PUT /api/diagrams/:id` with body `{ title, description, canvasData, tags }`.
4. API validates that the total request body is under 1MB (D1 query size limit). Return 413 if exceeded.
5. API updates D1 row and invalidates KV cache if a share token exists.

**Load flow:**
1. Astro SSR page fetches diagram from D1 in the frontmatter.
2. Passes `canvasData` JSON string as prop to `<CanvasEditor>`.
3. On mount, component calls `store.loadStoreSnapshot(JSON.parse(canvasData))`.

**New from blueprint flow:**
1. Astro SSR page fetches blueprint diagram from D1 (`WHERE is_blueprint = 1 AND id = :blueprintId`).
2. Passes `blueprintData` as prop (same canvas_data, but no diagram ID).
3. On first save, `POST /api/diagrams` creates a new diagram (cloned data, new ID).

### 4.7 Dashboard Page

Route: `/` (for authenticated users, redirects to canvas dashboard)

File: `src/pages/index.astro`

**Behavior:**
- If user is authenticated: show dashboard with their diagrams.
- If user is not authenticated: show a public landing page with a "Sign in" button (redirects to CF Access login).

**Dashboard content:**
- Grid of diagram cards showing: title, description snippet, last updated date, and a lazy-loaded thumbnail (`<img src="/api/diagrams/{id}/thumbnail" loading="lazy" alt={`Diagram thumbnail for ${diagram.title}`}>`).
- "New Diagram" button (goes to `/canvas/new`).
- "Browse Blueprints" button (opens blueprint selection modal/page).
- Each card has actions: Edit, Share, Delete.

---

## 5. Side 2: Share Viewer

### 5.1 Page Route

| Route | File | Description |
|-------|------|-------------|
| `/share/[token]` | `src/pages/share/[token].astro` | Anonymous diagram viewer |

### 5.2 Share Token Generation

When an authenticated user clicks "Share" on a diagram:

1. Client calls `POST /api/share` with body `{ diagramId }`.
2. API generates a cryptographically random 24-character URL-safe token (`crypto.getRandomValues`).
3. Inserts row into `share_tokens` table.
4. Caches the diagram data in KV under `share:{token}` with 1-hour TTL.
5. Returns the full share URL: `https://<domain>/share/{token}`.
6. Client displays the URL in a copy-to-clipboard dialog.

### 5.3 Share Viewer Page

File: `src/pages/share/[token].astro`

**SSR frontmatter:**
1. Extract `token` from URL params.
2. Check KV cache for `share:{token}`. If miss, query D1: join `share_tokens` with `diagrams` on `diagram_id`.
3. If token not found or expired: render a 404 page ("This diagram is no longer available").
4. If found: populate KV cache, pass data to page.

**Page content:**
- Diagram title and description displayed as a header.
- `<CanvasViewer>` React island (`client:only="react"`) renders the tldraw canvas in read-only mode.
- Export toolbar below the canvas header with two buttons:
  - **Export PNG**: Calls `editor.toImage([], { format: 'png', pixelRatio: 2, background: true })`, triggers browser download.
  - **Export SVG**: Calls `editor.getSvgString([], { background: true })`, creates a Blob and triggers download.
- No login required. No editing capability.

### 5.4 Canvas Viewer Component

File: `src/components/canvas/CanvasViewer.tsx`

**Props:**
```typescript
interface CanvasViewerProps {
  canvasData: string    // JSON string of tldraw store snapshot
  title: string
}
```

**Behavior:**
- Renders `<Tldraw>` with the same custom shape utils as the editor.
- On mount: `store.loadStoreSnapshot(JSON.parse(canvasData))` then `editor.updateInstanceState({ isReadonly: true })`.
- Hides tldraw's default toolbar/menus. Only shows zoom controls.
- Exposes `editor` ref for the parent page's export buttons to call export methods.

---

## 6. Side 3: Admin Panel

### 6.1 Page Routes

| Route | File | Description |
|-------|------|-------------|
| `/admin` | `src/pages/admin/index.astro` | Admin dashboard |
| `/admin/users` | `src/pages/admin/users.astro` | User management |
| `/admin/blueprints` | `src/pages/admin/blueprints.astro` | Blueprint management |

All admin routes require `role: 'admin'` (enforced by middleware).

### 6.2 Admin Dashboard

File: `src/pages/admin/index.astro`

- Summary statistics: total users, total diagrams, total active shares, total blueprints.
- Quick links to user management and blueprint management.
- Rendered fully SSR (no React islands needed).

### 6.3 User Management

File: `src/pages/admin/users.astro`

**SSR page with React island for interactivity.**

**Features:**
- Table of all users showing: avatar, display name, GitHub username, email, role, created date.
- **Promote to admin**: Button on each `user` row to change role to `admin`.
- **Demote to user**: Button on each `admin` row to change role to `user`. Cannot demote yourself.
- **Remove user**: Delete button with confirmation dialog. Removes user and all their diagrams. Cannot remove yourself.
- Paginated (25 users per page) with search by username/email.

**API calls:** All mutations go through `/api/admin/users` endpoints.

### 6.4 Blueprint Management

File: `src/pages/admin/blueprints.astro`

**Features:**
- List all blueprints (diagrams where `is_blueprint = 1`).
- **Promote diagram to blueprint**: Search existing diagrams and mark as blueprint.
- **Remove blueprint status**: Demote a blueprint back to a regular diagram.
- **Preview blueprint**: Opens the diagram in read-only viewer.
- Blueprint title and description are editable inline.

---

## 7. API Endpoints

All API endpoints are Astro server endpoints (`.ts` files in `src/pages/api/`). They follow standard REST conventions.

### 7.0 REST Conventions

**Content types:**
- Request bodies: `Content-Type: application/json` for all mutation endpoints.
- Response bodies: `Content-Type: application/json` for all endpoints, except `GET .../thumbnail` which returns `Content-Type: image/svg+xml`.
- Reject requests with wrong or missing `Content-Type` on mutation endpoints with `415 Unsupported Media Type`.

**HTTP methods:**
- `GET` - Read. Never mutates state. Safe and idempotent.
- `POST` - Create. Returns the created resource. Not idempotent.
- `PUT` - Full update. Idempotent. Omitted fields are left unchanged (partial update semantics for convenience, since clients always send the full editor state).
- `DELETE` - Remove. Idempotent. Succeeds even if already deleted.

**Status codes (success):**

| Code | Usage |
|------|-------|
| `200 OK` | Successful `GET` or `PUT`. Body contains the resource or list. |
| `201 Created` | Successful `POST`. Body contains the created resource. |
| `204 No Content` | Successful `DELETE`. No body. |

**Status codes (error):**

| Code | Usage |
|------|-------|
| `400 Bad Request` | Invalid JSON, missing required fields, validation failure. |
| `401 Unauthorized` | Missing or invalid `CF_Authorization` JWT. |
| `403 Forbidden` | Authenticated but not authorized (not owner, not admin). |
| `404 Not Found` | Resource does not exist, or caller lacks access. |
| `409 Conflict` | Duplicate resource (e.g., share token collision). |
| `413 Content Too Large` | Request body exceeds 1MB (D1 query limit). |
| `415 Unsupported Media Type` | Missing or wrong `Content-Type` header on mutation. |
| `500 Internal Server Error` | Unexpected failure. |

**Error response body** (all error status codes):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Diagram not found"
  }
}
```

The `code` field is a stable machine-readable string (uppercase snake_case matching the table above: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `CONTENT_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `INTERNAL_ERROR`). The `message` field is a human-readable string suitable for logging or developer display.

**Pagination response envelope** (all list endpoints):
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

**General rules:**
- All timestamps in responses are ISO 8601 UTC strings (e.g., `2026-01-01T00:00:00Z`).
- Resource field names in JSON responses use camelCase (e.g., `createdAt`, `githubUsername`), regardless of the snake_case column names in D1.
- `GET` for a single resource returns the resource object directly (not wrapped in an envelope).
- `GET` for a list returns the `{ data, pagination }` envelope.
- Unknown query parameters are silently ignored.
- `limit` is clamped to a max of 100; values above are reduced to 100 without error.

### 7.1 Diagram CRUD

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/diagrams` | User | List current user's diagrams (no thumbnails) |
| `POST` | `/api/diagrams` | User | Create new diagram |
| `GET` | `/api/diagrams/[id]` | User | Get diagram by ID (owner only) |
| `GET` | `/api/diagrams/[id]/thumbnail` | User | Get diagram thumbnail SVG (lazy load) |
| `PUT` | `/api/diagrams/[id]` | User | Update diagram (owner only) |
| `DELETE` | `/api/diagrams/[id]` | User | Delete diagram (owner only) |

**`GET /api/diagrams`**

Query params:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `20` | Items per page (max 100) |
| `search` | string | | Case-insensitive substring match against `title` and `description` |
| `tag` | string | | Filter to diagrams with this tag (exact match, can repeat: `?tag=ai&tag=production` for AND) |
| `sort` | string | `updated_at` | Sort field: `updated_at`, `created_at`, `title` |
| `order` | string | `desc` | Sort direction: `asc` or `desc` |

Note: `thumbnailSvg` and `canvasData` are excluded from the list response. Thumbnails are loaded lazily per-card via `GET /api/diagrams/[id]/thumbnail`.

SQL implementation: `search` uses `WHERE title LIKE '%term%' OR description LIKE '%term%'` (D1 SQLite `LIKE` is case-insensitive for ASCII). Multiple `tag` params join to `diagram_tags` with `HAVING COUNT(...) = :tagCount` for AND semantics.

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "My Diagram",
      "description": "...",
      "tags": ["production", "ai"],
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

**`GET /api/diagrams/[id]/thumbnail`**

Returns the thumbnail SVG for a single diagram. Used by dashboard cards to lazy-load thumbnails after the initial list renders.

Response: `200` with the raw SVG body and the following headers:
```
Content-Type: image/svg+xml
Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'
```

The CSP header prevents script execution if a user navigates directly to the thumbnail URL. Even though `<img>` tags already block scripts, the CSP is defense-in-depth against direct navigation. This is simpler and more robust than attempting server-side SVG sanitization (Workers lack a DOM for tools like DOMPurify).

Returns 404 if the diagram has no thumbnail yet.

The dashboard renders card placeholders immediately from the list response, then each card fetches its thumbnail via this endpoint. Use `loading="lazy"` on the `<img>` tag with the thumbnail URL as `src` so the browser handles viewport-based loading natively.

**`POST /api/diagrams`**

Request body:
```json
{
  "title": "My Diagram",
  "description": "Optional description",
  "canvasData": "{...tldraw snapshot JSON...}",
  "tags": ["production", "ai"]
}
```

Response: `201` with created diagram object (includes `id`).

**`PUT /api/diagrams/[id]`**

Request body (all fields optional):
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "canvasData": "{...tldraw snapshot JSON...}",
  "tags": ["updated", "tags"],
  "thumbnailSvg": "<svg>...</svg>"
}
```

Response: `200` with updated diagram object.

**Tag update strategy:** When `tags` is present in the request body, the update uses a Kysely transaction to delete-and-reinsert atomically. This avoids diffing logic and is safe because D1 transactions (`db.transaction()`) use the D1 batch API under the hood for atomicity.

```typescript
await db.transaction().execute(async (trx) => {
  // 1. Update diagram fields
  await trx.updateTable('diagrams')
    .set({ title, description, canvas_data: canvasData, updated_at: now })
    .where('id', '=', id)
    .execute()

  // 2. Replace tags: delete all, reinsert new
  await trx.deleteFrom('diagram_tags')
    .where('diagram_id', '=', id)
    .execute()

  if (tags.length > 0) {
    await trx.insertInto('diagram_tags')
      .values(tags.map((tag) => ({
        id: crypto.randomUUID(),
        diagram_id: id,
        tag: tag.toLowerCase().trim(),
      })))
      .execute()
  }
})
```

If `tags` is omitted from the request body, existing tags are left unchanged. The `POST /api/diagrams` endpoint uses the same insert pattern (without the delete step) for initial tag creation.

**`DELETE /api/diagrams/[id]`**

Response: `204` No Content. Cascades to delete share_tokens and diagram_tags.

### 7.2 Blueprint Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/blueprints` | User | List all blueprints |
| `GET` | `/api/blueprints/[id]` | User | Get blueprint data (for cloning) |

**`GET /api/blueprints`**

Query params:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `20` | Items per page (max 100) |
| `search` | string | | Case-insensitive substring match against `title` and `description` |
| `tag` | string | | Filter by tag (exact match, repeatable for AND) |
| `sort` | string | `title` | Sort field: `title`, `created_at`, `updated_at` |
| `order` | string | `asc` | Sort direction: `asc` or `desc` |

Note: `thumbnailSvg` and `canvasData` excluded. Use `GET /api/diagrams/[id]/thumbnail` for thumbnails.

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Full-Stack App with D1",
      "description": "Workers + D1 + KV starter",
      "tags": ["starter", "full-stack"],
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### 7.3 Share Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/share` | User | Create share token for a diagram |
| `DELETE` | `/api/share/[token]` | User | Revoke a share token |

Note: No `GET` endpoint is needed. The share viewer page (`/share/[token].astro`) fetches diagram data server-side in its frontmatter and passes it as props to the read-only tldraw island. Exports (PNG/SVG) are handled entirely client-side by tldraw.

**`POST /api/share`**

Request body:
```json
{
  "diagramId": "uuid"
}
```

Response:
```json
{
  "token": "abc123def456ghi789jkl012",
  "shareUrl": "https://cf-architect.example.com/share/abc123def456ghi789jkl012",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### 7.4 Admin Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/admin/users` | Admin | List all users (paginated) |
| `PUT` | `/api/admin/users/[id]/role` | Admin | Update user role |
| `DELETE` | `/api/admin/users/[id]` | Admin | Remove user |
| `POST` | `/api/admin/blueprints/[id]` | Admin | Promote diagram to blueprint |
| `DELETE` | `/api/admin/blueprints/[id]` | Admin | Demote blueprint to diagram |
| `GET` | `/api/admin/stats` | Admin | Dashboard statistics |

**`GET /api/admin/users`**

Query params:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `25` | Items per page (max 100) |
| `search` | string | | Case-insensitive substring match against `github_username`, `display_name`, and `email` |
| `role` | string | | Filter by role: `admin` or `user` |
| `sort` | string | `created_at` | Sort field: `created_at`, `display_name`, `github_username` |
| `order` | string | `desc` | Sort direction: `asc` or `desc` |

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "githubUsername": "octocat",
      "displayName": "Octo Cat",
      "email": "octocat@github.com",
      "avatarUrl": "https://avatars.githubusercontent.com/u/1",
      "role": "admin",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 15,
    "totalPages": 1
  }
}
```

**`PUT /api/admin/users/[id]/role`**

Request body:
```json
{
  "role": "admin"
}
```

Validation: Cannot demote yourself. Must be `"admin"` or `"user"`.

After updating the role in D1, **delete the user's KV cache entry** (`user:{email}`) so the new role takes effect immediately. Without this, the user retains their previous privileges for up to 15 minutes (the KV cache TTL).

**`DELETE /api/admin/users/[id]`**

Validation: Cannot delete yourself. Cascades to delete all user's diagrams, share tokens, and tags. **Delete the user's KV cache entry** (`user:{email}`) after removing from D1.

**`GET /api/admin/stats`**

Response:
```json
{
  "totalUsers": 15,
  "totalDiagrams": 42,
  "totalActiveShares": 8,
  "totalBlueprints": 5
}
```

---

## 8. Middleware Implementation

File: `src/middleware.ts`

```typescript
import { defineMiddleware } from 'astro:middleware'

// Public route patterns that do not require authentication
const PUBLIC_ROUTES = ['/', '/share/']
// Admin route patterns that require admin role
const ADMIN_ROUTES = ['/admin', '/api/admin/']

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, locals } = context
  const pathname = url.pathname

  // 1. Check if route is public
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route)
  )

  if (isPublic) {
    locals.user = null
    return next()
  }

  // 2. CSRF origin check on mutations (see §3.2 step 2)

  // 3. Local dev auth stub (see §8.3)
  if (import.meta.env.DEV) {
    locals.user = await getOrCreateDevUser(db)
    // Skip JWT validation, CF Access identity fetch -- straight to admin check
  } else {
    // 4. Extract CF Access JWT from cookie
    const cfAuth = context.cookies.get('CF_Authorization')?.value
    if (!cfAuth) {
      return new Response('Unauthorized', { status: 401 })
    }

    // 5. Validate JWT, extract email from claims (see §8.1)
    // 6. resolveUser(): look up by email, fetch identity on first login (see §8.2)
    // 7. Populate locals.user
  }

  // 8. Check admin routes
  const isAdmin = ADMIN_ROUTES.some((route) => pathname.startsWith(route))
  if (isAdmin && locals.user?.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  return next()
})
```

### 8.1 JWT Validation & Identity Fetch

File: `src/lib/auth/middleware.ts`

**Step 1: JWT validation**
- Fetch JWKS from `https://<CF_ACCESS_TEAM_NAME>.cloudflareaccess.com/cdn-cgi/access/certs`.
- Cache JWKS keys in KV (`jwks:keys`, TTL 1 hour) to avoid fetching on every request.
- Validate JWT signature, `iss`, `aud`, and `exp` claims.
- Extract `email` from standard JWT claims. The JWT does **not** contain GitHub profile fields (username, avatar, display name).

**Step 2: GitHub profile fetch (new users only)**
- Called only when a user is not yet in the DB (first login).
- Fetch `https://<CF_ACCESS_TEAM_NAME>.cloudflareaccess.com/cdn-cgi/access/get-identity` with the user's `CF_Authorization` cookie via the `cookie` header.
- Response contains GitHub profile data:
  ```json
  {
    "user_uuid": "...",
    "email": "user@example.com",
    "name": "Display Name",
    "preferred_username": "github-login",
    "idp": {
      "type": "github",
      "id": "..."
    },
    "github": {
      "id": 12345678,
      "login": "github-login",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345678"
    }
  }
  ```
- Extract `github.id`, `github.login`, `github.avatar_url`, `name`, and `email` to populate the `users` table.
- This call is only made once per user (on first login); subsequent requests resolve the user from DB/KV cache.

### 8.2 User Auto-Provisioning

File: `src/lib/auth/roles.ts`

```typescript
export async function resolveUser(
  db: Kysely<Database>,
  cache: KVNamespace,
  cfAccessTeamName: string,
  initialAdminUsername: string,
  jwtEmail: string,
  cfAuthCookie: string,
): Promise<User> {
  // 1. Check KV cache by email
  const cached = await cache.get(`user:${jwtEmail}`, 'json')
  if (cached) return cached as User

  // 2. Check DB by email
  let user = await db.selectFrom('users').where('email', '=', jwtEmail).selectAll().executeTakeFirst()

  if (!user) {
    // 3. Fetch GitHub profile from CF Access identity endpoint (first login only)
    const identityRes = await fetch(
      `https://${cfAccessTeamName}.cloudflareaccess.com/cdn-cgi/access/get-identity`,
      { headers: { cookie: `CF_Authorization=${cfAuthCookie}` } }
    )
    if (!identityRes.ok) throw new Error('Failed to fetch CF Access identity')
    const identity = await identityRes.json()

    const githubId = String(identity.github.id)
    const githubUsername = identity.github.login
    const displayName = identity.name || githubUsername
    const avatarUrl = identity.github.avatar_url
    const email = identity.email || jwtEmail

    // 4. Auto-provision: assign admin role only if github_username matches
    //    INITIAL_ADMIN_GITHUB_USERNAME (case-insensitive) and no admin exists yet
    let role: 'admin' | 'user' = 'user'
    if (initialAdminUsername && githubUsername.toLowerCase() === initialAdminUsername.toLowerCase()) {
      const adminCount = await db
        .selectFrom('users')
        .where('role', '=', 'admin')
        .select(db.fn.count('id').as('count'))
        .executeTakeFirstOrThrow()
      if (Number(adminCount.count) === 0) {
        role = 'admin'
      }
    }

    user = await db.insertInto('users').values({
      id: crypto.randomUUID(),
      github_id: githubId,
      github_username: githubUsername,
      email,
      display_name: displayName,
      avatar_url: avatarUrl,
      role,
    }).returningAll().executeTakeFirstOrThrow()
  }

  // 5. Cache in KV
  await cache.put(`user:${jwtEmail}`, JSON.stringify(user), { expirationTtl: 900 })
  return user
}
```

### 8.3 Local Dev Auth Stub

File: `src/lib/auth/dev-user.ts`

In local development (`import.meta.env.DEV === true`), the middleware bypasses all CF Access JWT validation and identity fetching. Instead, it injects a mock admin user, seeding it into D1 on first request if it doesn't exist.

This is necessary because:
- CF Access is an edge proxy that doesn't exist in the local Wrangler/miniflare environment.
- There is no GitHub OAuth flow to complete locally.
- The developer needs admin access to test all three sides of the application.

```typescript
const DEV_USER = {
  github_id: '0',
  github_username: 'dev-user',
  email: 'dev@localhost',
  display_name: 'Local Developer',
  avatar_url: null,
  role: 'admin' as const,
}

export async function getOrCreateDevUser(db: Kysely<Database>): Promise<User> {
  let user = await db
    .selectFrom('users')
    .where('github_id', '=', DEV_USER.github_id)
    .selectAll()
    .executeTakeFirst()

  if (!user) {
    user = await db.insertInto('users').values({
      id: crypto.randomUUID(),
      ...DEV_USER,
    }).returningAll().executeTakeFirstOrThrow()
  }

  return user
}
```

**Behavior:**
- The mock user has `role: 'admin'` so all features are accessible during development (canvas, share, admin panel).
- The user is seeded into D1 (not just injected into `locals`) so foreign key relationships work correctly when creating diagrams, share tokens, etc.
- The seed is idempotent -- looked up by `github_id: '0'` on every request, created only once.
- KV cache is not used in dev for the mock user (avoids stale state during rapid iteration).
- This code path is **dead in production** because `import.meta.env.DEV` is statically `false` in production builds and the import is tree-shaken.

**Security:** The `import.meta.env.DEV` check is evaluated at build time by Vite, not at runtime. A production build (`astro build`) replaces it with `false` and the dev code path is eliminated entirely. There is no risk of the stub being accessible in production.

---

## 9. Terraform Configuration

Directory: `terraform/`

### 9.1 `terraform/main.tf`

```hcl
terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {
  # Uses CLOUDFLARE_API_TOKEN env var
}

# D1 Database
resource "cloudflare_d1_database" "db" {
  account_id = var.cloudflare_account_id
  name       = "cf-architect-db"
}

# KV Namespace
resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = var.cloudflare_account_id
  title      = "cf-architect-cache"
}

# Cloudflare Access Application
# Scoped to protected path prefixes only. Requests to / and /share/*
# are NOT covered by Access and pass directly to the Worker.
resource "cloudflare_zero_trust_access_application" "app" {
  account_id       = var.cloudflare_account_id
  name             = "CF Architect"
  type             = "self_hosted"
  session_duration = "24h"
  allowed_idps     = [cloudflare_zero_trust_access_identity_provider.github.id]

  self_hosted_domains = [
    "${var.app_domain}/canvas",
    "${var.app_domain}/admin",
    "${var.app_domain}/api",
  ]
}

# GitHub Identity Provider
resource "cloudflare_zero_trust_access_identity_provider" "github" {
  account_id = var.cloudflare_account_id
  name       = "GitHub"
  type       = "github"

  config {
    client_id     = var.github_client_id
    client_secret = var.github_client_secret
  }
}

# Access Policy - Allow all GitHub users (user management is in-app)
resource "cloudflare_zero_trust_access_policy" "allow_github" {
  account_id     = var.cloudflare_account_id
  application_id = cloudflare_zero_trust_access_application.app.id
  name           = "Allow GitHub Users"
  decision       = "allow"
  precedence     = 1

  include {
    login_method = [cloudflare_zero_trust_access_identity_provider.github.id]
  }
}
```

### 9.2 `terraform/variables.tf`

```hcl
variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID"
}

variable "app_domain" {
  type        = string
  description = "Domain for the CF Architect application"
}

variable "github_client_id" {
  type        = string
  description = "GitHub OAuth App client ID"
}

variable "github_client_secret" {
  type        = string
  sensitive   = true
  description = "GitHub OAuth App client secret"
}
```

### 9.3 `terraform/outputs.tf`

```hcl
output "d1_database_id" {
  value = cloudflare_d1_database.db.id
}

output "kv_namespace_id" {
  value = cloudflare_workers_kv_namespace.cache.id
}

output "access_app_aud" {
  value       = cloudflare_zero_trust_access_application.app.aud
  description = "AUD tag for JWT validation"
}
```

---

## 10. Wrangler Configuration

File: `wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "compatibility_date": "2026-04-14",
  "compatibility_flags": ["global_fetch_strictly_public"],
  "name": "cf-architect",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS"
  },
  "observability": {
    "enabled": true
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "cf-architect-db",
      "database_id": "<from terraform output>"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "<from terraform output>"
    }
  ],
  "vars": {
    "CF_ACCESS_TEAM_NAME": "<from .env>",
    "INITIAL_ADMIN_GITHUB_USERNAME": "<from .env>"
  },
  "d1_migrations": {
    "path": "src/lib/db/migrations"
  }
}
```

---

## 11. UI Design Specifications

### 11.1 Color Scheme (Cloudflare Brand)

Tailwind theme extension in `tailwind.config` (or CSS `@theme` in Tailwind v4):

```
--color-cf-orange:     #F6821F   (primary brand)
--color-cf-orange-dark: #E87516  (hover state)
--color-cf-dark:       #1A1A2E   (dark backgrounds)
--color-cf-dark-alt:   #2D2D44   (dark card backgrounds)
--color-cf-white:      #FFFFFF   (light backgrounds)
--color-cf-gray-50:    #F9FAFB   (subtle background)
--color-cf-gray-100:   #F3F4F6   (border, dividers)
--color-cf-gray-500:   #6B7280   (secondary text)
--color-cf-gray-900:   #111827   (primary text)
```

### 11.2 Layout Structure

- **Canvas pages** (`/canvas/*`): Full-viewport layout. No header/footer. tldraw fills the screen. Custom toolbar overlay at top.
- **Share pages** (`/share/*`): Minimal header with title + export buttons. Canvas fills remaining space.
- **Admin pages** (`/admin/*`): Standard layout with sidebar navigation, header with user info, main content area.
- **Dashboard** (`/`): Header with logo + user menu, main content area with diagram grid.

### 11.3 Component Strategy

shadcn/ui components are React-based. In Astro, they require `client:*` directives to hydrate, which ships JavaScript to the browser. The rule: **prefer plain Tailwind HTML in SSR pages; only use shadcn/ui React components where client-side interactivity is genuinely required.**

#### Tailwind HTML components (no React, no JS, SSR-only)

Build these as Astro components (`.astro` files) in `src/components/ui/` using only Tailwind classes. Reference shadcn/ui's styling for visual consistency, but do not use the React source:

- **Button** - `<button>` / `<a>` with Tailwind classes
- **Card** - Styled `<div>` containers for diagram grid
- **Badge** - Styled `<span>` for tags, role indicators
- **Avatar** - `<img>` with rounded Tailwind classes
- **Input** / **Textarea** / **Label** - Native form elements with Tailwind
- **Table** - Native `<table>` with Tailwind for admin user list
- **Separator** - `<hr>` or `<div>` with border utility
- **Skeleton** - `<div>` with `animate-pulse` Tailwind utility
- **Pagination** - `<a>` links with page params (no client-side state)

#### React components (interactive, require `client:load` or `client:idle`)

Install these via `npx shadcn@latest add` and use them inside React islands:

- `dialog` - Share URL dialog, delete confirmation, blueprint selection (`client:load`)
- `dropdown-menu` - User menu, diagram card actions (`client:load`)
- `alert-dialog` - Destructive action confirmations (`client:load`)
- `toast` - Success/error notifications (`client:load`)
- `tooltip` - Service toolbar tooltips (canvas editor island only)
- `select` - Role selector in admin user table (`client:idle`)
- `tabs` - Blueprint category browser (`client:idle`)

#### Where each type is used

| Page | Rendering | Component approach |
|------|-----------|-------------------|
| Dashboard (`/`) | SSR | Tailwind HTML cards/badges/buttons. User menu dropdown is a small React island (`client:load`). |
| Canvas editor (`/canvas/*`) | React island | Full shadcn/ui React inside the tldraw island (toolbar, dialogs, toasts, tooltips). |
| Share viewer (`/share/*`) | SSR + React island | Tailwind HTML header. tldraw read-only island for canvas. Export buttons are plain HTML `<button>` elements that call into the island's editor ref. |
| Admin pages (`/admin/*`) | SSR | Tailwind HTML tables/cards/badges. Role selector and delete confirmation are small React islands (`client:idle`). |

---

## 12. Testing Strategy

### 12.1 Unit Tests (Vitest)

File: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',  // or use @cloudflare/vitest-pool-workers
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
```

**Test areas:**
- `tests/unit/lib/auth/` - JWT validation, user auto-provisioning, role checks.
- `tests/unit/lib/db/` - Kysely query builders (using miniflare D1).
- `tests/unit/lib/share.ts` - Token generation, validation, expiry.
- `tests/unit/lib/cache.ts` - KV cache get/set/invalidation.
- `tests/unit/api/` - API endpoint request/response (using miniflare).
- `tests/unit/components/` - React component rendering with Testing Library.

### 12.2 E2E Tests (Playwright)

File: `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev',
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4321',
  },
})
```

**Test scenarios:**
- **Side 1**: Navigate to canvas, create a new diagram, add service shapes, connect with arrows, save, verify persistence.
- **Side 2**: Generate share link, open in incognito, verify read-only view, test PNG and SVG export downloads.
- **Side 3**: Admin login, view user list, promote/demote user, remove user, manage blueprints.
- **Auth**: Verify protected routes redirect to CF Access, verify admin routes return 403 for non-admins.

---

## 13. D1 Migration Files

### 13.1 Initial Migration

File: `src/lib/db/migrations/0001_initial_schema.sql`

```sql
-- Create users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id TEXT UNIQUE NOT NULL,
  github_username TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_github_id ON users(github_id);

-- Create diagrams table
CREATE TABLE diagrams (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  canvas_data TEXT NOT NULL,
  thumbnail_svg TEXT,
  is_blueprint INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_diagrams_owner ON diagrams(owner_id);
CREATE INDEX idx_diagrams_blueprint ON diagrams(is_blueprint) WHERE is_blueprint = 1;

-- Create diagram tags table
CREATE TABLE diagram_tags (
  id TEXT PRIMARY KEY,
  diagram_id TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  UNIQUE(diagram_id, tag)
);

CREATE INDEX idx_tags_diagram ON diagram_tags(diagram_id);
CREATE INDEX idx_tags_tag ON diagram_tags(tag);

-- Create share tokens table
CREATE TABLE share_tokens (
  id TEXT PRIMARY KEY,
  diagram_id TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_share_token ON share_tokens(token);
CREATE INDEX idx_share_diagram ON share_tokens(diagram_id);
```

---

## 14. Client-Side Error Handling

API error response format, status codes, and error codes are defined in §7.0 (REST Conventions).

- API calls in React islands use a shared `fetchApi()` utility in `src/lib/api.ts` that parses the `{ error: { code, message } }` response body and throws a typed error.
- Toast notifications (via shadcn/ui toast) display the `message` field from error responses.
- Canvas auto-save failures show a persistent warning banner with retry button. The banner remains visible until a successful save or manual dismiss.

---

## 15. Security Considerations

1. **Share tokens**: Generated with `crypto.getRandomValues()` (24 URL-safe chars = ~143 bits of entropy). Tokens are not guessable.
2. **Authorization**: Every API endpoint validates ownership. Users can only read/write their own diagrams. Admin endpoints verify `role: 'admin'`.
3. **Input validation**: All API request bodies are validated (title length, description length, valid JSON for canvas data, tag format).
4. **XSS prevention**: Canvas data is stored as JSON and parsed, never injected as raw HTML. SVG thumbnails are served with a strict CSP header (`default-src 'none'; style-src 'unsafe-inline'`) that blocks script execution on direct navigation. Dashboard loads thumbnails via `<img>` tags which inherently block scripts. No server-side SVG sanitization is attempted (Workers lack a DOM).
5. **CSRF**: CF Access sets `SameSite=Lax` on the `CF_Authorization` cookie, which blocks cross-site `POST`/`PUT`/`DELETE` in modern browsers. As defense-in-depth (in case CF changes cookie policy), the Astro middleware also validates the `Origin` header on all mutation requests (`POST`, `PUT`, `DELETE`). If `Origin` is present and does not match the application's domain, the request is rejected with `403 Forbidden`. The client-side `fetchApi()` utility does not need to set any custom header -- `Origin` is sent automatically by browsers on all `fetch()` calls that are not simple `GET`/`HEAD`.
6. **Rate limiting**: Cloudflare's built-in rate limiting on Workers protects against abuse.

---

## 16. Build Order (Implementation Phases)

### Phase 1: Foundation
1. Install all dependencies (tldraw, kysely, tailwindcss, shadcn/ui, dev tooling).
2. Configure wrangler.jsonc bindings, tailwind, eslint, prettier, vitest, playwright.
3. Write D1 migration and run locally.
4. Implement Kysely database client and type definitions.
5. Set up Astro middleware with auth stub (skip JWT validation for local dev).
6. Create base layout component.

### Phase 2: Canvas Editor (Side 1)
1. Implement custom `CfServiceShapeUtil` with all Cloudflare service shapes.
2. Build `CanvasEditor` component with tldraw integration.
3. Build `ServiceToolbar` component.
4. Implement diagram CRUD API endpoints.
5. Wire up save/load/auto-save flow.
6. Build dashboard page with diagram grid.
7. Implement blueprint selection and cloning.

### Phase 3: Share Viewer (Side 2)
1. Implement share token generation API.
2. Build `CanvasViewer` component (read-only tldraw).
3. Build share page with export buttons (PNG/SVG).
4. Implement KV caching for shared diagrams.

### Phase 4: Admin Panel (Side 3)
1. Build admin layout with sidebar.
2. Implement user management page and API.
3. Implement blueprint management page and API.
4. Build admin dashboard with statistics.

### Phase 5: Auth & Infrastructure
1. Implement full CF Access JWT validation.
2. Write Terraform configuration.
3. Test `npm run firstrun` flow.
4. Configure wrangler.jsonc with real resource IDs.
5. Test `npm run deploy` flow.

### Phase 6: Polish & Testing
1. Add Cloudflare SVG icons to `public/icons/cf/`.
2. Apply Cloudflare brand styling throughout.
3. Write unit tests (80% coverage target).
4. Write E2E tests for all three sides.
5. Run `npm run check` and fix all issues.
