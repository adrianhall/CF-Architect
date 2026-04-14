# Phase 005: Canvas Editor (Side 1)

## Goal

Build the interactive tldraw-based canvas editor with custom Cloudflare service shapes, the service selector toolbar, canvas pages, auto-save, and self-hosted tldraw assets. This is the core of "Side 1" — the diagram creation experience.

## Prerequisites

- Phase 004 complete (diagram CRUD API endpoints working).

## Deliverables

### 1. Cloudflare Service SVG Icons

#### `public/icons/cf/*.svg`

Create SVG icons for all 19 Cloudflare services listed in the service registry (spec §4.4). Each icon should be a clean, recognizable SVG representation of the Cloudflare service using Cloudflare brand colors. Icons should be:
- 48x48 viewBox.
- Single-color or dual-color (orange `#F6821F` primary, dark `#1A1A2E` accent).
- Clean paths, no embedded scripts.
- Meaningful for the service (e.g., database cylinder for D1, globe for DNS, etc.).

Files needed:
```
public/icons/cf/workers.svg
public/icons/cf/pages.svg
public/icons/cf/durable-objects.svg
public/icons/cf/browser-rendering.svg
public/icons/cf/d1.svg
public/icons/cf/kv.svg
public/icons/cf/r2.svg
public/icons/cf/hyperdrive.svg
public/icons/cf/vectorize.svg
public/icons/cf/workers-ai.svg
public/icons/cf/ai-gateway.svg
public/icons/cf/stream.svg
public/icons/cf/images.svg
public/icons/cf/queues.svg
public/icons/cf/pub-sub.svg
public/icons/cf/email-routing.svg
public/icons/cf/dns.svg
public/icons/cf/spectrum.svg
```

**Note:** If official Cloudflare Developer Platform SVG icons are available, use those. Otherwise, create simple iconic representations. The icons can be improved in future phases.

### 2. Cloudflare Service Registry

#### `src/components/canvas/shapes/cf-services.ts`

Implement the static service registry exactly as specified in spec §4.4:

```typescript
export interface CfServiceDefinition {
  type: string
  displayName: string
  category: CfServiceCategory
  iconPath: string
  description: string
}

export type CfServiceCategory =
  | 'compute'
  | 'storage'
  | 'ai'
  | 'media'
  | 'messaging'
  | 'networking'

export const CF_SERVICES: CfServiceDefinition[] = [
  // All 19 services from spec §4.4
]
```

Also export helper functions:
```typescript
/** Get a service definition by type key. */
export function getServiceByType(type: string): CfServiceDefinition | undefined

/** Get all services in a category. */
export function getServicesByCategory(category: CfServiceCategory): CfServiceDefinition[]

/** Get all unique categories in display order. */
export function getCategories(): CfServiceCategory[]
```

### 3. Custom Shape Definition

#### `src/components/canvas/shapes/CfServiceShapeUtil.tsx`

Implement the custom tldraw shape per spec §4.3:

**Shape props interface:**
```typescript
interface CfServiceShapeProps {
  w: number       // default: 140
  h: number       // default: 140
  serviceType: string
  label: string
}
```

**ShapeUtil class (`CfServiceShapeUtil`):**
- Extends `BaseBoxShapeUtil<CfServiceShape>`.
- `static type = 'cf-service'` as the shape type identifier.
- `getDefaultProps()`: returns default w/h/serviceType/label.
- `component()`: renders the shape as a React component:
  - Container div with Cloudflare dark background (`#1A1A2E`), rounded corners, border.
  - `<img>` tag loading the SVG icon from `iconPath` for the service.
  - Service display name text.
  - User-editable label text below.
  - Orange accent border/header strip using `#F6821F`.
- `indicator()`: renders the selection indicator (standard box outline).
- `toSvg()`: renders a clean native SVG for export (no `<foreignObject>`, use `<rect>`, `<text>`, `<image>` with the service icon inlined or referenced).
- `onDoubleClick()`: enters label editing mode.
- `canResize()`: returns true.

**Register shape tools:**
Create the shape tool and custom tool setup needed for tldraw to recognize `cf-service` shapes. Export `cfServiceShapeUtils` array and `cfServiceTools` for use in the Tldraw component.

### 4. Canvas Editor Component

#### `src/components/canvas/CanvasEditor.tsx`

Implement the main editor per spec §4.2:

**Props:**
```typescript
interface CanvasEditorProps {
  diagramId?: string
  initialData?: string
  blueprintData?: string
  title?: string
  description?: string
}
```

**Implementation:**
1. Initialize tldraw with:
   - Custom shape utils: `[CfServiceShapeUtil]`.
   - Self-hosted asset URLs via `getAssetUrls({ baseUrl: '/tldraw-assets/' })`.
   - Asset restrictions: `acceptedImageMimeTypes: []`, `acceptedVideoMimeTypes: []`.
2. On mount (`onMount` callback from tldraw):
   - If `initialData`, call `store.loadStoreSnapshot(JSON.parse(initialData))`.
   - If `blueprintData`, call `store.loadStoreSnapshot(JSON.parse(blueprintData))`.
3. **Auto-save** (debounced, 30-second interval):
   - Listen to store changes.
   - On change, start/reset a 30-second debounce timer.
   - On timer fire: call `PUT /api/diagrams/{diagramId}` with current snapshot.
   - If no `diagramId` yet (new diagram), first `POST /api/diagrams` to create, then store the returned ID for subsequent saves.
   - Show save status indicator (saving/saved/error).
4. **Manual save**: Button that immediately triggers save.
5. **Custom top bar overlay** with:
   - Title input field (editable).
   - Description input field (editable, collapsible).
   - Save button with status.
   - Share button (triggers share dialog — placeholder for phase 007).
   - Export button (triggers export — placeholder for phase 007).
   - Back button (navigate to dashboard `/`).
6. **Error handling**: Use a persistent warning banner for save failures with retry button per spec §14.

**Client-side API utility:**

#### `src/lib/api-client.ts`

Create a typed fetch wrapper for use in React islands:

```typescript
/** Fetch wrapper that handles API error responses and throws typed errors. */
export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T>

/** API error class with code and message. */
export class ApiError extends Error {
  code: string
  status: number
}
```

### 5. Service Selector Toolbar

#### `src/components/canvas/ServiceToolbar.tsx`

Implement per spec §4.5:

- Collapsible left sidebar panel overlaying the canvas.
- Services grouped by category with headings.
- Each service shows icon, name, description tooltip.
- **Drag to canvas**: Use HTML5 drag-and-drop. On drag start, set drag data with service type. On drop onto canvas, use `editor.createShape()` to create a `cf-service` shape at the drop position.
- **Search/filter**: Text input filters services by name (case-insensitive substring match).
- Styled with Cloudflare brand colors.
- Toggle button to collapse/expand the sidebar.

### 6. Canvas Pages

#### `src/pages/canvas/new.astro`

- Full-viewport layout (no header/footer per spec §11.2).
- SSR frontmatter:
  - Check `Astro.locals.user` (should exist due to middleware + CF Access protecting `/canvas`).
  - If `?blueprint=:id` query param, fetch the blueprint from DB (WHERE `is_blueprint = 1 AND id = :id`). If not found, ignore and start blank.
- Render `<CanvasEditor client:only="react">` with:
  - No `diagramId` (new diagram).
  - `blueprintData` if blueprint was fetched.

#### `src/pages/canvas/[id].astro`

- Full-viewport layout.
- SSR frontmatter:
  - Fetch diagram from DB WHERE `id = params.id AND owner_id = user.id`.
  - If not found, return 404 page.
- Render `<CanvasEditor client:only="react">` with:
  - `diagramId={diagram.id}`
  - `initialData={diagram.canvas_data}`
  - `title={diagram.title}`
  - `description={diagram.description}`

### 7. tldraw Asset Self-Hosting

Ensure the `copy:tldraw-assets` script works (set up in phase 001). Verify that:
- `npm run dev` copies assets before starting.
- `npm run build` copies assets before building.
- `public/tldraw-assets/` is in `.gitignore`.
- The tldraw editor loads fonts and icons from `/tldraw-assets/` without external network requests.

---

## Testing Requirements

### `tests/unit/components/canvas/shapes/cf-services.test.ts`
- Test `CF_SERVICES` contains all 19 services.
- Test each service has all required fields (type, displayName, category, iconPath, description).
- Test `getServiceByType` returns correct service.
- Test `getServiceByType` returns undefined for unknown type.
- Test `getServicesByCategory` returns only services in that category.
- Test `getCategories` returns all unique categories.
- Test no duplicate service types.

### `tests/unit/components/canvas/shapes/CfServiceShapeUtil.test.ts`
- Test `CfServiceShapeUtil` has correct static type.
- Test `getDefaultProps` returns valid defaults.
- Test shape creation with all Cloudflare service types produces valid shapes.

### `tests/unit/lib/api-client.test.ts`
- Test `fetchApi` parses successful JSON response.
- Test `fetchApi` throws `ApiError` on error response.
- Test `ApiError` has correct code and status.

**Note:** React component rendering tests for `CanvasEditor` and `ServiceToolbar` are difficult without a full DOM environment (tldraw requires a real browser). Focus unit tests on the data layer (registry, shape utils, API client). E2E tests in phase 009 will cover the full canvas interaction.

---

## Testable Features

1. **New canvas loads**: Navigate to `http://localhost:4321/canvas/new`. The tldraw editor should render full-viewport with the custom top bar.

2. **Service toolbar**: Click the toggle to open the service sidebar. All 19 Cloudflare services should be listed grouped by category.

3. **Add shape**: Drag a service from the toolbar onto the canvas. A `cf-service` shape should appear with the correct icon and name.

4. **Edit label**: Double-click a shape on the canvas to edit its label.

5. **Arrow connections**: Use tldraw's built-in arrow tool to draw connections between service shapes.

6. **Save flow**: Add shapes, wait 30 seconds (or click Save). The diagram should be saved to the API. Navigate away and back — the diagram should persist.

7. **New from blueprint**: Manually set a diagram as `is_blueprint = 1` in local D1, then navigate to `/canvas/new?blueprint={id}`. The canvas should load with the blueprint's shapes.

8. **Edit existing**: Navigate to `/canvas/{id}` for an existing diagram. Canvas loads with saved data.

9. **Self-hosted assets**: Open browser DevTools Network tab. Verify tldraw fonts/icons load from `/tldraw-assets/` and not from an external CDN.

10. **Search toolbar**: Type in the search box in the service toolbar. Services should filter by name.

---

## Acceptance Criteria

- [ ] All 19 Cloudflare service SVG icons exist in `public/icons/cf/`
- [ ] `src/components/canvas/shapes/cf-services.ts` exports the full service registry
- [ ] `src/components/canvas/shapes/CfServiceShapeUtil.tsx` implements the custom shape
- [ ] `src/components/canvas/CanvasEditor.tsx` renders tldraw with custom shapes
- [ ] `src/components/canvas/ServiceToolbar.tsx` provides drag-to-canvas functionality
- [ ] `src/pages/canvas/new.astro` creates new diagrams (blank or from blueprint)
- [ ] `src/pages/canvas/[id].astro` edits existing diagrams
- [ ] Auto-save works (debounced 30s)
- [ ] Manual save works
- [ ] Self-hosted tldraw assets load from `/tldraw-assets/`
- [ ] Image/video embedding is disabled
- [ ] `src/lib/api-client.ts` provides typed fetch wrapper
- [ ] All exports have JSDoc documentation
- [ ] Unit tests cover service registry and shape utils
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and canvas pages work
- [ ] `npm run build` succeeds
