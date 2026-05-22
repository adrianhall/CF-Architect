---
phase: "04"
title: "Architecture Canvas"
feature: "F4"
status: "Planned"
depends_on: ["02", "03"]
---

# Phase 04 — Architecture Canvas

## Goal

Build the visual diagram editor: a React Flow canvas with Cloudflare service nodes, a searchable
and collapsible palette, a properties panel, ELK auto-layout running in a Web Worker, 50-step
undo/redo, live save status, and full keyboard/accessibility support.

## Scope

### In Scope

All F4 user stories. See REQUIREMENTS.md §F4.

### Out of Scope

- Persisting diagrams to D1 (Phase 05 — canvas state is in-memory only in this phase)
- Sharing / read-only viewer (Phase 07)
- PNG/SVG export (Phase 08)
- Project scaffold export (Phase 09)

## Pre-requisites

- Phase 02 complete (auth middleware; user session; preferences API)
- Phase 03 complete (catalog API; `useCatalog()` hook; `<ServiceIcon>` component)

## Tasks

### Dependencies

- [ ] Install in `apps/web`: `@xyflow/react`, `elkjs`, `zustand`, `zundo`, `@tanstack/react-query` (already via Phase 02), `react-i18next`, `@formatjs/intl-messageformat`
- [ ] Install in `apps/web` (dev): `@xyflow/react` types if not bundled

### Canvas infrastructure

- [ ] `apps/web/src/stores/diagram-store.ts` — Zustand store with `zundo` temporal middleware:
  - State: `nodes: Node[]`, `edges: Edge[]`, `saveStatus: "idle" | "saving" | "saved" | "error"`, `lastSavedAt: Date | null`, `isDirty: boolean`
  - Actions: `addNode`, `removeNodes`, `updateNodeData`, `addEdge`, `removeEdges`, `updateEdgeData`, `setNodes`, `setEdges`
  - Undo/redo: `useTemporalStore` from zundo; configure `limit: 50`; redo stack clears on new action
  - Both structural and data-only changes enter the undo history

### Custom node and edge components

- [ ] `apps/web/src/features/f04-canvas/nodes/ServiceNode.tsx`:
  - Renders `<ServiceIcon>`, label, description (truncated), accent colour band
  - Connection handles: top, bottom, left, right; only visible on hover or when selected
  - `aria-label` set to `"{name} node, category {category}"`
  - Selected state: highlighted border using CSS custom property
  - `data-testid="service-node-{typeId}"` for Playwright targeting
- [ ] `apps/web/src/features/f04-canvas/edges/` — four edge components:
  - `DataFlowEdge.tsx` — solid blue arrow
  - `BindingEdge.tsx` — dashed orange
  - `DependencyEdge.tsx` — solid grey
  - `LogicalEdge.tsx` — dotted purple
  - All: label support; `prefers-reduced-motion` disables animated dashes/strokes via CSS media query
- [ ] Register node and edge types in React Flow `nodeTypes` and `edgeTypes` maps

### Palette panel

- [ ] `apps/web/src/features/f04-canvas/PalettePanel.tsx`:
  - Groups services by category using `useCatalog()`
  - Search input (case-insensitive substring match on name and typeId); hides categories with zero matches; does not hide categories when search is empty
  - Each category collapsible; collapsed state stored in diagram store (synced to `user_preferences` via Phase 05; localStorage fallback in this phase)
  - Drag source: HTML5 drag event carrying `{ typeId }` payload; React Flow `onDrop` handler picks this up
  - Keyboard: each service item focusable with `Tab`; `Enter` key adds node to centre of current viewport
- [ ] `apps/web/src/features/f04-canvas/usePaletteDrop.ts` — hook for React Flow `onDrop` + `onDragOver`; converts drop coordinates to canvas position; creates node at that position with catalog default label

### Properties panel

- [ ] `apps/web/src/features/f04-canvas/PropertiesPanel.tsx`:
  - **Node mode**: label input (1–80 chars, validated, shows character count); description textarea (≤500 chars); accent colour picker (HexColorPicker or native `<input type="color">`); "Reset to category colour" button; "Open docs" button (`docLink` from catalog, opens `target="_blank" rel="noopener noreferrer"`)
  - **Edge mode**: type selector showing all 4 edge types with their visual indicator (small swatch); label input (≤80 chars); protocol input (free text); description textarea
  - **Empty state**: helpful prompt ("Select a node or edge to edit its properties")
  - All inputs update diagram store on change (no save button; store is authoritative)

### Keyboard shortcuts

- [ ] `apps/web/src/features/f04-canvas/useCanvasKeyboard.ts` — global keydown handler:
  - `Delete` / `Backspace` — delete selected nodes/edges; no-op when focus is inside `input`, `textarea`, or `[contenteditable]`
  - `Ctrl/Cmd+Z` — undo
  - `Ctrl/Cmd+Shift+Z` — redo
  - `+` / `=` — zoom in
  - `-` — zoom out
  - `Ctrl+Shift+F` — fit view

### ELK auto-layout

- [ ] `apps/web/src/features/f04-canvas/elk-worker.ts` — Web Worker: imports `elkjs/lib/elk-api`; listens for `{ nodes, edges, direction }` messages; runs ELK layout; posts back `{ nodes: layoutedNodes, edges: layoutedEdges }`
- [ ] `apps/web/src/features/f04-canvas/useAutoLayout.ts` — hook: spawns the Web Worker once; exposes `layoutTopBottom()` and `layoutLeftRight()`; while layout is computing the canvas remains interactive (no blocking spinner); on layout complete, calls `setNodes` + `setEdges` in the store; if `prefers-reduced-motion`, skips the position-animation step and jumps directly to final positions

### Canvas toolbar and status bar

- [ ] `apps/web/src/features/f04-canvas/CanvasToolbar.tsx`:
  - Zoom in / zoom out / fit view buttons (with `aria-label`)
  - Auto-layout dropdown: "Top-to-Bottom" / "Left-to-Right"
  - Snap-to-grid toggle button
  - Dark / light / high-contrast theme toggle
- [ ] `apps/web/src/features/f04-canvas/StatusBar.tsx`:
  - Save status pill: "Saving…" / "Saved 3s ago" (updates every second via `setInterval`) / "Unsaved changes" / "Save error"
  - Node count + edge count
  - `</>` JSON-modal button: opens modal showing current `graph_json` formatted with `JSON.stringify(…, null, 2)`; copy-to-clipboard button

### Autosave (local-only in Phase 04)

- [ ] `apps/web/src/features/f04-canvas/useAutosave.ts`:
  - Debounce: 500 ms after last change
  - In Phase 04: saves to `localStorage` under key `canvas-draft-{diagramId}` (diagramId = "local" placeholder)
  - Sets `saveStatus` in store: "saving" during debounce; "saved" on success; "error" on failure
  - Registers `beforeunload` listener when `isDirty` is true; removes it when saved

### Theme system

- [ ] `apps/web/src/stores/theme-store.ts` — Zustand store: `theme: "system" | "light" | "dark" | "high-contrast"`; reads from `localStorage` as fallback (user_preferences API wired in Phase 05)
- [ ] `apps/web/index.html` — inline `<script>` immediately reads `localStorage.getItem("cf-arch-theme")` and sets `data-theme` on `<html>`; prevents FOUC
- [ ] `apps/web/src/styles/tokens.css` — full design token sets for `[data-theme="light"]`, `[data-theme="dark"]`, `[data-theme="high-contrast"]`; React Flow `colorMode` prop set from theme store
- [ ] Theme toggle button in app shell (also in CanvasToolbar); persisted to localStorage in Phase 04, synced to `user_preferences` in Phase 05

### Canvas route

- [ ] `apps/web/src/routes/canvas/$diagramId.tsx`:
  - Loads `diagram-store` with empty graph (Phase 05 loads from API)
  - Renders: `<PalettePanel>` (left aside), `<ReactFlow>` (main), `<PropertiesPanel>` (right aside), `<CanvasToolbar>` (top bar), `<StatusBar>` (bottom bar)
  - React Flow: `snapToGrid={true}`, `snapGrid={[16, 16]}`, `fitView`, `<MiniMap>`, `<Background>`
  - `nodeTypes` and `edgeTypes` maps wired
  - `useCanvasKeyboard()` mounted
  - `useAutosave()` mounted

### Accessibility

- [ ] All nodes have `aria-label`
- [ ] All toolbar buttons have `aria-label` and are `<button>` elements (no `<div onClick>`)
- [ ] Focus rings visible in `[data-focus-visible]` or `:focus-visible` CSS
- [ ] Landmark regions: `<aside aria-label="Service palette">`, `<main aria-label="Diagram canvas">`, `<aside aria-label="Properties">`, `<nav aria-label="Canvas toolbar">`
- [ ] `prefers-reduced-motion` CSS: `@media (prefers-reduced-motion: reduce) { .edge-animated { animation: none; } }`

## Schema Changes

None. Canvas state is in-memory (localStorage fallback) until Phase 05 wires D1 persistence.

## API Additions

None. Phase 04 reads from `GET /api/catalog` (Phase 03). All other data is local.

## Test Plan

### Unit (Vitest)

- [ ] Diagram store — `addNode` increments node count; `removeNodes` removes correct node; undo after `addNode` restores previous state; redo after undo re-adds node; redo stack clears after `addNode` post-undo; 50th undo step succeeds; 51st returns to initial state (oldest step dropped)
- [ ] Palette search — "kv" matches "Workers KV"; "xyz" matches nothing; empty string shows all; case-insensitive match
- [ ] `useCanvasKeyboard` — `Delete` key fires `removeNodes` when canvas focused; `Delete` key is a no-op when focus is inside an `<input>`
- [ ] `resolveTypeId` integration — node dropped with an aliased typeId resolves to the canonical typeId

### E2E (Playwright)

- [ ] Drag "Workers KV" from the palette to the canvas; confirm node appears with correct icon and label
- [ ] Connect two nodes by dragging from one handle to another; confirm edge created with type `data-flow`
- [ ] Select a node; edit label in properties panel; confirm canvas label updates
- [ ] Select an edge; change type to "binding"; confirm edge visual style changes
- [ ] Select a node; press `Delete`; confirm node removed
- [ ] `Ctrl+Z` after delete restores the node
- [ ] Click "Layout Top-to-Bottom"; confirm nodes are repositioned without UI freeze
- [ ] Zoom in with `+` key; zoom out with `-` key; fit view with `Ctrl+Shift+F`
- [ ] Dark mode toggle; confirm canvas colour scheme changes; reload; confirm dark mode persists

### Accessibility `@a11y`

- [ ] Canvas editor page: zero serious/critical axe violations
- [ ] All palette service items have accessible names
- [ ] All toolbar buttons have accessible names
- [ ] Properties panel form fields have visible labels

## Manual Tests

- [ ] **Drag and drop** — Open the canvas at `/canvas/local`. Drag "D1" from the palette and drop it
  on the canvas. Confirm the node appears at the drop position with the correct icon, label, and
  category colour. Drag "Workers KV" and drop it nearby. Confirm both nodes are on canvas.
- [ ] **Palette search** — Type "ai" in the palette search box. Confirm only AI-related services
  appear. Clear the search. Confirm all categories reappear.
- [ ] **Category collapse** — Collapse the "Storage" category. Confirm it collapses and the chevron
  rotates. Reload the page. Confirm the "Storage" category remains collapsed (state persisted in localStorage).
- [ ] **Category search override** — Collapse the "Storage" category. Then search for "r2". Confirm
  the Storage category expands to show R2 even though it was collapsed.
- [ ] **Connection** — Add two nodes. Hover a node to reveal handles. Drag from a handle on node A to
  node B. Confirm an edge is created. Attempt to drag a handle to the same node (self-loop); confirm
  the connection is rejected.
- [ ] **Properties panel — node** — Select a node. Confirm the properties panel shows the label,
  description, and accent colour fields. Edit the label (type more than 80 characters; confirm the
  input stops accepting input or shows an error at 80). Click "Open docs" and confirm it opens the
  correct Cloudflare documentation URL in a new tab.
- [ ] **Properties panel — edge** — Select an edge. Confirm the type selector shows all 4 edge types
  with visual indicators. Change the type to "binding". Confirm the edge on canvas changes to the
  dashed orange style.
- [ ] **Undo/redo** — Add 3 nodes. Press `Ctrl+Z` three times. Confirm the canvas is empty. Press
  `Ctrl+Shift+Z` three times. Confirm all 3 nodes are restored.
- [ ] **Undo/redo limit** — Perform 55 distinct add-node actions. Press `Ctrl+Z` 55 times. Confirm
  only 50 undos are possible and the canvas still shows the first 5 nodes added.
- [ ] **Keyboard delete — focus safety** — Select a node. Click into the label input in the properties
  panel (keyboard focus is now inside the input). Press `Delete`. Confirm the node is NOT deleted
  and the character in the input is deleted instead.
- [ ] **Auto-layout** — Add 8 nodes with edges connecting them in a random arrangement. Click
  "Layout Top-to-Bottom". Confirm nodes rearrange cleanly. Confirm the canvas remains interactive
  during layout (you can scroll or zoom while it runs). Click "Layout Left-to-Right" and confirm
  a different arrangement.
- [ ] **Minimap** — Add 10 nodes spread widely across the canvas. Confirm the minimap (bottom-right)
  shows their relative positions coloured by category. Pan the main canvas and confirm the minimap
  viewport indicator moves.
- [ ] **Snap to grid** — Enable snap-to-grid from the toolbar. Drag a node. Confirm it snaps to grid
  increments. Disable snap-to-grid. Drag a node. Confirm free positioning.
- [ ] **Status bar** — Make a change. Confirm "Unsaved changes" appears in the status bar. Wait 500 ms.
  Confirm "Saving…" appears briefly, then "Saved Xs ago". Confirm node and edge counts update.
- [ ] **Unsaved changes warning** — Make a change. Attempt to close the browser tab. Confirm the
  browser shows a "Leave site?" / "Changes you made may not be saved" warning.
- [ ] **JSON modal** — Click the `</>` button in the status bar. Confirm a modal opens showing the
  current graph as formatted JSON. Confirm the copy button copies the JSON to clipboard.
- [ ] **Dark mode FOUC** — Set dark mode. Close the browser. Re-open the URL. Confirm there is NO
  flash of the light theme before dark mode applies (the inline script sets the theme before React
  renders).
- [ ] **High-contrast mode** — Toggle to the high-contrast theme. Confirm all text and interactive
  elements have sufficient contrast. Zoom into the canvas and confirm node borders and labels are
  clearly legible.
- [ ] **Reduced motion** — Enable `prefers-reduced-motion: reduce` in OS accessibility settings.
  Reload. Add an edge. Confirm the edge has no animated dashes or strokes. Click auto-layout.
  Confirm nodes jump to their new positions without animation.
- [ ] **Keyboard-only walkthrough** — Using only the keyboard (no mouse): open the canvas, use `Tab`
  to navigate to the palette, press `Enter` to add a service node, `Tab` to another service, `Enter`
  to add it, then use keyboard shortcuts to zoom and fit view. Confirm all actions are achievable
  without touching the mouse.

## Acceptance Criteria

| Story | How we verify |
|---|---|
| **F4-US1** — Drag service from palette; node at cursor; default label; immediately selectable | Drag-and-drop E2E + manual test |
| **F4-US2** — Palette search: case-insensitive substring; empty categories hidden | Unit + manual search test |
| **F4-US3** — Collapse/expand categories; persists; search overrides collapsed state | Manual collapse/search override test |
| **F4-US4** — Connect via handles; default `data-flow`; no self-loops | E2E connection test |
| **F4-US5** — Edit label (1–80), description (≤500), accent colour with reset | Properties panel manual test |
| **F4-US6** — Edge type/label/protocol/description editable | Edge properties manual test |
| **F4-US7** — Delete with `Delete`/`Backspace`; no-op when focus in text input | Keyboard delete safety manual test |
| **F4-US8** — Undo/redo ≥50 steps; redo stack clears on new action | Unit store test + undo/redo manual test |
| **F4-US9** — Auto-layout off main thread; UI responsive during layout; two directions | Auto-layout manual test; confirm via DevTools > Threads |
| **F4-US10** — Live save status; 500 ms debounce; unload warning when dirty | Status bar + unsaved warning manual test |
| **F4-US11** — Node + edge count in status bar | Visible in status bar throughout manual tests |
| **F4-US12** — Zoom/pan/fit with keyboard shortcuts + toolbar buttons | Keyboard-only walkthrough |
| **F4-US13** — Dark/light theme; persists; no FOUC; respects `prefers-color-scheme` | FOUC + dark mode manual test |
| **F4-US14** — Keyboard-only operable; focus rings; zero axe serious/critical violations | Keyboard-only walkthrough + `@a11y` test |

## Rollout / Rollback

**Rollout:** `npm run deploy`. No new D1 migrations. Canvas state is in localStorage until Phase 05
adds persistence.

**Rollback:** Redeploy previous version. No user data at risk (no DB writes in this phase).

## Open Questions

- [ ] ELK layout options: `"elk.algorithm": "layered"` is the right choice for a top-down/left-right
  Cloudflare architecture diagram. Confirm `"elk.layered.spacing.nodeNodeBetweenLayers"` and
  `"elk.spacing.nodeNode"` default values are acceptable, or tune them during implementation.
- [ ] Drag-to-add: React Flow `onDrop` with `reactFlowInstance.screenToFlowPosition()` is the
  canonical approach. Confirm this works with `snapToGrid` enabled before finalising.
- [ ] Should the properties panel slide in/out with an animation, or be always visible (collapsible)?
  Recommendation: always-visible two-panel layout; collapsible toggle for small viewports.
