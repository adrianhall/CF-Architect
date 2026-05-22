---
phase: "08"
title: "Export & Print"
feature: "F8"
status: "Planned"
depends_on: ["04"]
---

# Phase 08 — Export & Print

## Goal

Let users export diagrams as PNG, SVG, or JSON, and print diagrams with auto-detected orientation
and forced light theme. The read-only viewer (Phase 07) also benefits from all export/print
capabilities.

## Scope

### In Scope

All F8 user stories. Export available in both the editor and the read-only viewer. The `</>` JSON
modal (already stubbed in Phase 04 status bar) is completed here.

### Out of Scope

- Server-side PDF generation
- Transparent PNG background (future toggle)

## Pre-requisites

- Phase 04 complete (canvas; diagram store)
- Phase 07 complete (read-only viewer) — needed to wire print into the viewer

## Tasks

### PNG export

- [ ] `apps/web/src/features/f08-export/exportPng.ts`:
  - Use React Flow's `toSvg()` utility (or `getNodesBounds()` + manual canvas render) to capture the current diagram
  - Convert SVG to `<canvas>`, then to PNG blob via `canvas.toBlob("image/png")`
  - Apply padding (16 px on all sides)
  - Enforce minimum 400×400 px output (pad smaller diagrams to meet minimum)
  - Trigger browser download with filename `{diagram-title}.png`
- [ ] Export button in canvas toolbar: "Export" dropdown containing "PNG", "SVG", "JSON"

### SVG export

- [ ] `apps/web/src/features/f08-export/exportSvg.ts`:
  - Use React Flow's `toSvg()` utility
  - Apply padding
  - Trigger browser download with filename `{diagram-title}.svg`
  - SVG must be self-contained (inline icon symbols or embed icon data URLs; no external `href` references that would break when opened locally)

### JSON export

- [ ] `apps/web/src/features/f08-export/exportJson.ts`:
  - Serialize current diagram store `{ nodes, edges }` as blueprint-compatible JSON (`BlueprintSchema` shape — matches the format used by Phase 06 blueprints and Phase 09 scaffold exporter)
  - Trigger browser download with filename `{diagram-title}.json`
- [ ] Complete the `</>` JSON modal from Phase 04: body shows the JSON; copy-to-clipboard button; download button (reuses `exportJson`)

### Print view

- [ ] `apps/web/src/styles/print.css`:
  - `@media print { [data-theme] { /* force light tokens */ } }`
  - Hide: toolbar, palette panel, properties panel, status bar, share banner controls
  - Show: full canvas only
  - Detect landscape vs portrait: compare diagram bounding box width vs height from React Flow `getNodesBounds()`; inject `@page { size: landscape }` or `@page { size: portrait }` dynamically before `window.print()`
  - Fit canvas to one page using `transform: scale(…)` + `page-break-inside: avoid`
- [ ] `apps/web/src/features/f08-export/usePrintDiagram.ts` hook:
  - Reads `getNodesBounds()` from React Flow context
  - Computes orientation
  - Injects `<style>` with `@page` size declaration
  - Calls `window.print()`
  - Cleans up injected style after print dialog closes
- [ ] Print button in canvas toolbar (and in read-only viewer toolbar)
- [ ] Wire print button in read-only viewer (`/share/:token` route) from Phase 07's stub

### Export in read-only viewer

- [ ] Add "Export" dropdown (PNG, SVG, JSON) to the read-only viewer toolbar
- [ ] All export functions operate on the viewer's React Flow instance (same code, different context)

### Keyboard shortcut

- [ ] `Ctrl/Cmd+P` triggers `usePrintDiagram()` on the canvas editor page; does not interfere with the browser's default print dialog trigger (it actually invokes the same action)

## Schema Changes

None. All export operations are client-side.

## API Additions

None. All export operations are purely client-side.

## Test Plan

### Unit (Vitest)

- [ ] `exportJson` — output passes `BlueprintSchema` shape validation (structural check; typeIds not required to be in catalog)
- [ ] Orientation detection — bounding box wider than tall → "landscape"; taller than wide → "portrait"; square → "landscape"
- [ ] Padding logic — a 100×100 px diagram becomes 400×400 (minimum enforced) with correct padding

### E2E (Playwright)

- [ ] Click "Export → PNG" on a diagram with nodes; confirm a PNG file is downloaded
- [ ] Click "Export → SVG" on a diagram; confirm an SVG file is downloaded; open SVG in browser; confirm nodes are visible
- [ ] Click "Export → JSON" on a diagram; confirm a JSON file is downloaded; parse it; confirm it matches `BlueprintSchema` shape
- [ ] Open the `</>` modal; confirm the JSON matches the canvas graph; click copy; paste elsewhere and confirm full JSON is present
- [ ] Print: `page.emulateMedia({ media: "print" })`; confirm palette/toolbar/properties panel are hidden; confirm canvas is visible

### Accessibility `@a11y`

- [ ] Export dropdown button has accessible name
- [ ] JSON modal is dismissible with `Escape`; focus trapped while open

## Manual Tests

- [ ] **PNG export** — Open a diagram with at least 5 nodes. Click "Export → PNG". Confirm a `.png`
      file downloads. Open the PNG. Confirm all nodes are visible with correct icons and labels. Confirm
      there is visible padding around the edges. Confirm the image is at least 400×400 px (check with
      image properties).
- [ ] **PNG minimum size** — Create a diagram with only one small node. Export as PNG. Confirm the
      output is exactly 400×400 px (or larger with padding, but never smaller).
- [ ] **SVG export** — Click "Export → SVG". Open the downloaded `.svg` file in a browser. Confirm
      the diagram renders with correct icons, colours, and labels. Confirm no broken image placeholders
      (all icons should be inlined or embedded).
- [ ] **JSON export** — Click "Export → JSON". Open the `.json` file. Confirm it contains `nodes`
      and `edges` arrays in the blueprint-compatible format. Paste the JSON into the admin blueprint
      create form (Phase 06). Confirm "Validate" passes.
- [ ] **JSON modal** — Click the `</>` button in the status bar. Confirm the modal opens with
      formatted JSON. Click "Copy". Paste into a text editor and confirm the full JSON is present.
      Click "Download" and confirm the JSON file downloads. Close with ESC. Confirm the modal closes.
- [ ] **Print — light theme forced** — Switch to dark mode. Click the print button (or `Ctrl+P`).
      In the print preview, confirm the diagram renders in the light theme regardless of the current
      app theme.
- [ ] **Print — landscape orientation** — Create a wide diagram (many nodes connected left to right).
      Open the print preview. Confirm the `@page` orientation is set to landscape.
- [ ] **Print — portrait orientation** — Create a tall diagram (many nodes stacked top to bottom).
      Open the print preview. Confirm the `@page` orientation is set to portrait.
- [ ] **Print — panels hidden** — In the print preview, confirm the palette panel, properties panel,
      toolbar, and status bar are all hidden. Only the canvas should be visible.
- [ ] **Print from read-only viewer** — Open a share URL (Phase 07). Click the print button in the
      viewer toolbar. Confirm the same print behavior applies (light theme forced, panels hidden, correct
      orientation).
- [ ] **Export from read-only viewer** — Open a share URL. Use the Export dropdown to download PNG,
      SVG, and JSON. Confirm all three downloads work correctly.

## Acceptance Criteria

| Story                                                                 | How we verify                                       |
| --------------------------------------------------------------------- | --------------------------------------------------- |
| **F8-US1** — PNG with padding; minimum 400×400                        | PNG export + minimum size manual tests              |
| **F8-US2** — SVG export with correct rendering                        | SVG export manual test                              |
| **F8-US3** — JSON export in blueprint-compatible format               | JSON export manual test + JSON validation           |
| **F8-US4** — Print with auto-detected orientation; forced light theme | Print landscape/portrait + light-theme manual tests |
| **F8-US5** — `</>` JSON modal in status bar                           | JSON modal manual test                              |

## Rollout / Rollback

**Rollout:** `npm run deploy`. No migrations. All export is client-side.

**Rollback:** Redeploy previous version. No data at risk.

## Open Questions

- [ ] SVG icon embedding: React Flow's `toSvg()` may not automatically inline `<use href>` sprite
      references. If the exported SVG shows broken icons when opened standalone, we will need to inline
      each icon's `<path>` data into the SVG output. Plan for this fallback during implementation.
- [ ] `html2canvas` vs React Flow's `toSvg()` + canvas conversion: Phase 05 chose one for thumbnails
      — confirm the same library is used here for PNG export to avoid two competing approaches.
