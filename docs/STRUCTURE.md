# Project Structure

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Framework      | Astro 5 (SSR on Cloudflare Workers) |
| UI Islands     | React 19                            |
| Diagram Engine | React Flow (`@xyflow/react` v12)    |
| Styling        | Tailwind CSS 4                      |
| State          | Zustand                             |
| Database       | Cloudflare D1 (SQLite)              |
| Blob Storage   | Cloudflare R2                       |
| Cache          | Cloudflare Workers KV               |
| ORM            | Drizzle ORM                         |
| Validation     | Zod                                 |
| Auto-Layout    | ELK (`elkjs`)                       |
| Testing        | Vitest                              |

## File Structure

```text
cf-architect/
├── astro.config.mjs          # Astro + Cloudflare adapter config
├── eslint.config.mjs         # ESLint 9 flat config
├── .prettierrc.mjs           # Prettier config (Astro plugin)
├── vitest.config.ts          # Vitest test runner config
├── wrangler.toml             # D1, KV, R2 bindings
├── drizzle.config.ts         # Drizzle ORM config
├── package.json
├── tsconfig.json
├── .env.example              # Environment variable template
├── .github/
│   └── workflows/            # CI and deploy workflows
├── docs/                     # Developer documentation
├── migrations/               # D1 SQL migrations (Drizzle)
├── scripts/
│   └── deploy.mjs            # Deployment helper script
├── public/
│   └── icons/                # Cloudflare product SVG icons
├── src/
│   ├── middleware.ts         # Auth bypass, locals injection
│   ├── env.d.ts              # TypeScript env/binding types
│   ├── components/           # Astro components (Layout, Navbar)
│   ├── islands/              # React islands (client-hydrated)
│   │   ├── DiagramCanvasWrapper.tsx  # ReactFlowProvider wrapper
│   │   ├── DiagramCanvas.tsx         # Main React Flow canvas + editor
│   │   ├── types.ts                  # Shared CFNodeData/CFEdgeData interfaces
│   │   ├── nodes/
│   │   │   ├── CFNode.tsx            # Custom node renderer
│   │   │   └── nodeTypes.ts          # React Flow nodeTypes registry
│   │   ├── edges/
│   │   │   ├── CFEdge.tsx            # Custom edge renderer
│   │   │   └── edgeTypes.ts          # React Flow edgeTypes registry
│   │   ├── panels/
│   │   │   ├── ServicePalette.tsx    # Left sidebar: draggable node catalog
│   │   │   └── PropertiesPanel.tsx   # Right sidebar: selected item editor
│   │   ├── toolbar/
│   │   │   ├── Toolbar.tsx           # Top bar: title, undo/redo, zoom, layout, share
│   │   │   ├── ExportButton.tsx      # Export dropdown (PNG/SVG/Project ZIP)
│   │   │   ├── PrintButton.tsx       # Print-mode trigger
│   │   │   ├── ShowJsonButton.tsx    # JSON modal for blueprint export
│   │   │   └── StatusBar.tsx         # Bottom bar: counts, zoom, save status
│   │   ├── dashboard/
│   │   │   ├── DiagramList.tsx       # Dashboard diagram card grid
│   │   │   └── ConfirmDeleteModal.tsx # Delete confirmation dialog
│   │   ├── blueprints/
│   │   │   ├── BlueprintGallery.tsx  # Template gallery with category filters
│   │   │   ├── BlueprintPreview.tsx  # Read-only React Flow mini-preview
│   │   │   └── CreateDiagramModal.tsx # Create diagram form (blank or blueprint)
│   │   └── store/
│   │       └── diagramStore.ts       # Zustand diagram store
│   ├── lib/
│   │   ├── catalog.ts        # 33 CF node types + 4 edge types
│   │   ├── blueprints.ts     # Blueprint templates
│   │   ├── export.ts         # Filename generation + download trigger
│   │   ├── scaffold.ts       # Project scaffold ZIP generator
│   │   ├── scaffold-templates/ # Per-framework scaffold file templates
│   │   ├── share.ts          # Share link creation/resolution
│   │   ├── validation.ts     # Zod schemas + API response helpers
│   │   ├── helpers.ts        # ID generation, JSON responses
│   │   ├── auth/             # AuthStrategy interface + bypass
│   │   └── db/               # Drizzle schema + client
│   ├── pages/
│   │   ├── index.astro       # Redirects to /dashboard
│   │   ├── dashboard.astro   # Diagram list
│   │   ├── blueprints.astro  # Blueprint gallery
│   │   ├── diagram/[id].astro # Editor
│   │   ├── s/[token].astro   # Shared read-only view
│   │   └── api/v1/           # REST API routes
│   └── styles/
│       ├── global.css        # Tailwind directives, theme vars
│       └── components.css    # Component styles
└── tests/                    # Unit and integration tests (Vitest)
```

---

## Zustand State Store

All client-side editor state lives in a single Zustand store defined in `src/islands/store/diagramStore.ts`. The store is created with `create<DiagramStore>()` and exported as the `useDiagramStore` hook.

### State Properties

| Property | Type | Description |
| --- | --- | --- |
| `diagramId` | `string \| null` | UUID of the loaded diagram, or `null` before initial fetch |
| `title` | `string` | User-editable diagram title |
| `description` | `string` | User-editable diagram description |
| `nodes` | `Node<CFNodeData>[]` | React Flow node array |
| `edges` | `Edge<CFEdgeData>[]` | React Flow edge array |
| `viewport` | `Viewport` | Canvas pan (`x`, `y`) and `zoom` level |
| `selectedNodeId` | `string \| null` | Currently selected node ID |
| `selectedEdgeId` | `string \| null` | Currently selected edge ID |
| `dirty` | `boolean` | Whether there are unsaved changes |
| `saving` | `boolean` | Whether an autosave request is in flight |
| `lastSavedAt` | `number \| null` | Unix timestamp (ms) of last successful save |
| `saveError` | `string \| null` | Error message from the most recent failed save |
| `undoStack` | `HistoryEntry[]` | Undo snapshots (max 50) |
| `redoStack` | `HistoryEntry[]` | Redo snapshots |
| `printMode` | `boolean` | Whether print-optimised view is active |

The `HistoryEntry` type is a snapshot of the node and edge arrays:

```typescript
interface HistoryEntry {
  nodes: Node<CFNodeData>[];
  edges: Edge<CFEdgeData>[];
}
```

### Actions

| Action | Signature | Description |
| --- | --- | --- |
| `setDiagram` | `(id, title, description, nodes, edges, viewport) => void` | Initialise store with a loaded diagram |
| `onNodesChange` | `OnNodesChange` | React Flow node change handler; pushes history on add/remove |
| `onEdgesChange` | `OnEdgesChange` | React Flow edge change handler; pushes history on add/remove |
| `onConnect` | `OnConnect` | Creates a new `data-flow` edge on connection; pushes history |
| `onViewportChange` | `(viewport: Viewport) => void` | Update viewport (does not mark dirty) |
| `addNode` | `(node: Node<CFNodeData>) => void` | Add a node; pushes history |
| `updateNodeData` | `(nodeId: string, data: Partial<CFNodeData>) => void` | Merge partial data into a node |
| `updateEdgeData` | `(edgeId: string, data: Partial<CFEdgeData>) => void` | Merge partial data into an edge |
| `removeSelected` | `() => void` | Remove all selected nodes and edges; pushes history |
| `setSelectedNode` | `(id: string \| null) => void` | Select a node (clears edge selection) |
| `setSelectedEdge` | `(id: string \| null) => void` | Select an edge (clears node selection) |
| `setTitle` | `(title: string) => void` | Update title; marks dirty |
| `setDescription` | `(description: string) => void` | Update description; marks dirty |
| `setNodes` | `(nodes: Node<CFNodeData>[]) => void` | Replace the entire nodes array (used by auto-layout) |
| `setEdges` | `(edges: Edge<CFEdgeData>[]) => void` | Replace the entire edges array |
| `markSaving` | `() => void` | Set `saving` to true, clear previous error |
| `markSaved` | `() => void` | Clear `dirty`, record `lastSavedAt`, clear error |
| `markSaveError` | `(error: string) => void` | Record a save failure |
| `markDirty` | `() => void` | Manually set the dirty flag |
| `undo` | `() => void` | Revert to the most recent undo snapshot |
| `redo` | `() => void` | Re-apply the most recently undone snapshot |
| `pushHistory` | `() => void` | Push current nodes/edges onto the undo stack; clears redo |
| `setPrintMode` | `(mode: boolean) => void` | Enter or exit print-optimised view |

### Usage

Inside React components, use the hook directly:

```tsx
const { nodes, edges, addNode } = useDiagramStore();
```

Outside React (e.g. in autosave callbacks), access the store imperatively:

```tsx
const state = useDiagramStore.getState();
```

For performance, use selectors to subscribe to only the slices you need:

```tsx
const title = useDiagramStore((s) => s.title);
```

### Store Consumers

| Component | Selectors / Actions Used |
| --- | --- |
| DiagramCanvas | `nodes`, `edges`, all `on*Change` handlers, `setDiagram`, `addNode`, `removeSelected`, `setSelectedNode`, `setSelectedEdge`, `undo`, `redo`, `dirty`, `markSaving`, `markSaved`, `markSaveError`, `title`, `description`, `printMode`, `setPrintMode`; `getState()` for autosave and beforeunload |
| Toolbar | `undo`, `redo`, `undoStack`, `redoStack`, `title`, `setTitle`; `getState()` for auto-layout (`pushHistory`, `setNodes`) |
| Toolbar > ShareButton | `diagramId` |
| ExportButton | `title`, `nodes`, `edges` |
| PrintButton | `setPrintMode` |
| ShowJsonButton | `nodes`, `edges`, `viewport` |
| StatusBar | `saving`, `dirty`, `lastSavedAt`, `saveError`, `nodes`, `edges` |
| PropertiesPanel | `nodes`, `edges`, `selectedNodeId`, `selectedEdgeId`, `updateNodeData`, `updateEdgeData` |

---

## Components

### Component Hierarchy

```text
DiagramCanvasWrapper              (diagram/[id].astro, s/[token].astro)
└── DiagramCanvas
    ├── Toolbar
    │   ├── ExportButton
    │   ├── PrintButton
    │   └── ShareButton (internal to Toolbar.tsx)
    ├── ServicePalette
    │   └── PaletteItem (internal)
    ├── ReactFlow
    │   ├── CFNode (via nodeTypes registry)
    │   └── CFEdge (via edgeTypes registry)
    ├── PropertiesPanel
    └── StatusBar
        └── ShowJsonButton

DiagramList                       (dashboard.astro)
├── BlueprintPreview (per card)
└── ConfirmDeleteModal

BlueprintGallery                  (blueprints.astro)
├── BlueprintPreview (per card)
└── CreateDiagramModal
    └── BlueprintPreview (in modal)
```

### Island Mounting

Islands are hydrated from Astro pages using Astro's `client:` directives:

| Page | Island | Directive |
| --- | --- | --- |
| `diagram/[id].astro` | `DiagramCanvasWrapper` | `client:only="react"` |
| `s/[token].astro` | `DiagramCanvasWrapper` (read-only) | `client:only="react"` |
| `dashboard.astro` | `DiagramList` | `client:load` |
| `blueprints.astro` | `BlueprintGallery` | `client:load` |

### Component Reference

#### Canvas / Editor

**DiagramCanvasWrapper** (`src/islands/DiagramCanvasWrapper.tsx`)

Wraps `DiagramCanvas` with `ReactFlowProvider` so that React Flow hooks (`useReactFlow`, etc.) are available to all child components.

| Prop | Type | Description |
| --- | --- | --- |
| `diagramId` | `string` | Diagram UUID |
| `readOnly` | `boolean?` | Hides editing UI when `true` |
| `initialData` | `{ title, description, graphData }?` | Pre-loaded data to skip API fetch |

**DiagramCanvas** (`src/islands/DiagramCanvas.tsx`)

The main editor surface. Responsibilities:

- Loads diagram data on mount (from `initialData` or via `GET /api/v1/diagrams/:id`)
- Autosave: `PUT /api/v1/diagrams/:id/graph` on a 500 ms debounce after any dirty change
- Beforeunload guard: warns when navigating away with unsaved changes
- Title save: `PATCH /api/v1/diagrams/:id` on a 1 s debounce after title edits
- Drag-and-drop from `ServicePalette` (reads `application/cf-node-type` from `DataTransfer`)
- Keyboard shortcuts: Delete/Backspace (remove selected), Ctrl+Z (undo), Ctrl+Shift+Z (redo)
- Print mode: forces light theme, auto-detects landscape/portrait, calls `window.print()`

**CFNode** (`src/islands/nodes/CFNode.tsx`)

Custom React Flow node renderer. Looks up the product definition from `NODE_TYPE_MAP` via `data.typeId`, renders a category-coloured border, product icon, label, optional description, and typed connection handles.

**CFEdge** (`src/islands/edges/CFEdge.tsx`)

Custom React Flow edge renderer. Supports four visual styles based on `data.edgeType`: solid animated (data-flow), dashed (service-binding), dotted (trigger), thin gray (external). Renders smooth step paths with SVG arrow markers and an optional midpoint label.

#### Panels

**ServicePalette** (`src/islands/panels/ServicePalette.tsx`)

Left sidebar listing all Cloudflare node types from the catalog, grouped by category. Features a type-ahead search filter and collapsible category sections. Each item is draggable -- on drag start it sets `application/cf-node-type` transfer data with the node's `typeId`, which `DiagramCanvas.onDrop` reads to create a new node at the drop position.

**PropertiesPanel** (`src/islands/panels/PropertiesPanel.tsx`)

Right sidebar that displays editable properties for the currently selected node or edge. For nodes: type (read-only), category (read-only), label, description, accent colour. For edges: edge type selector, label, protocol, description. Shows an empty-state message when nothing is selected.

#### Toolbar

**Toolbar** (`src/islands/toolbar/Toolbar.tsx`)

| Prop | Type | Description |
| --- | --- | --- |
| `readOnly` | `boolean?` | Hides editing controls when `true` |

Top bar containing: logo link back to dashboard, diagram title input, undo/redo, zoom in/out/fit, ELK auto-layout, `ExportButton`, `PrintButton`, and an internal `ShareButton`. In read-only mode only the logo, title, and export are shown.

**ExportButton** (`src/islands/toolbar/ExportButton.tsx`)

Dropdown with three export options: PNG and SVG (captured from the React Flow viewport via `html-to-image`) and Project (a scaffold ZIP generated by `generateScaffold` and compressed with `fflate`). The Project option is disabled when no Cloudflare service nodes are present.

**PrintButton** (`src/islands/toolbar/PrintButton.tsx`)

Activates print-optimised view mode by calling `setPrintMode(true)`. The actual print side effects (light mode, orientation, `window.print()`) are handled in `DiagramCanvas`.

**ShowJsonButton** (`src/islands/toolbar/ShowJsonButton.tsx`)

Icon button (rendered in `StatusBar`) that opens a modal displaying the current diagram's full JSON (nodes, edges, viewport), ready for copy-paste into `src/lib/blueprints.ts`. See the [blueprint authoring guide](BLUEPRINTS.md).

**StatusBar** (`src/islands/toolbar/StatusBar.tsx`)

| Prop | Type | Description |
| --- | --- | --- |
| `readOnly` | `boolean` | Displays "Read-only" instead of save status |

Bottom bar showing: `ShowJsonButton`, node/edge count, zoom percentage, and save status (Saving / Unsaved changes / Saved _n_ ago / Error).

#### Dashboard

**DiagramList** (`src/islands/dashboard/DiagramList.tsx`)

Fetches all diagrams on mount and renders a responsive card grid. Each card shows a `BlueprintPreview` thumbnail, title, and last-updated time. Actions per card: open (navigate), duplicate, delete (opens `ConfirmDeleteModal`).

**ConfirmDeleteModal** (`src/islands/dashboard/ConfirmDeleteModal.tsx`)

| Prop | Type | Description |
| --- | --- | --- |
| `open` | `boolean` | Controls visibility |
| `diagramTitle` | `string` | Shown in the confirmation message |
| `onConfirm` | `() => void` | Called when delete is confirmed |
| `onCancel` | `() => void` | Called when cancelled or overlay clicked |

#### Blueprints

**BlueprintGallery** (`src/islands/blueprints/BlueprintGallery.tsx`)

Reads the `BLUEPRINTS` array from `src/lib/blueprints.ts` and renders a filterable card grid. Always shows a "Blank Canvas" card. Clicking any card opens `CreateDiagramModal` with the selected blueprint (or `null` for blank).

**BlueprintPreview** (`src/islands/blueprints/BlueprintPreview.tsx`)

| Prop | Type | Description |
| --- | --- | --- |
| `graphData` | `string` | Serialised JSON (`{ nodes, edges, viewport }`) |
| `height` | `number?` | Container height in pixels (default `200`) |

Read-only React Flow mini-canvas that parses `graphData` and renders a non-interactive preview. Used in dashboard cards, blueprint cards, and the create-diagram modal.

**CreateDiagramModal** (`src/islands/blueprints/CreateDiagramModal.tsx`)

| Prop | Type | Description |
| --- | --- | --- |
| `open` | `boolean` | Controls visibility |
| `onClose` | `() => void` | Called on cancel or overlay click |
| `blueprint` | `Blueprint \| null` | Selected blueprint, or `null` for blank canvas |

Title/description form with a live `BlueprintPreview`. On submit, `POST /api/v1/diagrams` is called and the browser redirects to `/diagram/:id`.

---

## TypeScript Types

Key type definitions and where they live:

| File | Types | Description |
| --- | --- | --- |
| `src/islands/types.ts` | `CFNodeData`, `CFEdgeData` | Data payloads attached to React Flow nodes and edges |
| `src/islands/store/diagramStore.ts` | `DiagramState`, `DiagramActions`, `DiagramStore`, `HistoryEntry` | Store state, actions, and snapshot types |
| `src/lib/catalog.ts` | `NodeCategory`, `NodeTypeDef`, `EdgeTypeDef`, `HandleDef` | Product catalog definitions and category taxonomy |
| `src/lib/validation.ts` | `Diagram`, `CreateDiagramInput`, `UpdateDiagramInput`, `SaveGraphInput`, `CreateShareInput`, `ApiResult` | Zod-inferred request/response types |
| `src/lib/blueprints.ts` | `Blueprint` | Blueprint template shape |
| `src/lib/scaffold.ts` | `ScaffoldInput`, `ScaffoldNode`, `ScaffoldEdge` | Project scaffold generator input types |
| `src/lib/auth/types.ts` | `AuthStrategy`, `AppUser` | Authentication strategy interface |
| `src/env.d.ts` | `Env`, `App.Locals` | Cloudflare bindings (D1, KV, R2) and Astro locals |
