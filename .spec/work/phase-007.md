# Phase 007: Share Viewer (Side 2)

## Goal

Implement the complete sharing flow: share token API endpoints, KV caching of shared diagrams, the anonymous share viewer page with a read-only tldraw canvas, and PNG/SVG export buttons. This is "Side 2" of the application.

## Prerequisites

- Phase 006 complete (dashboard with diagram cards, canvas editor working).

## Deliverables

### 1. Share API Endpoints

#### `src/pages/api/share/index.ts`

**`POST /api/share`** — Create share token for a diagram.

Spec reference: §7.3.

1. Validate Content-Type.
2. Parse body: `{ diagramId }`.
3. Validate `diagramId` is a non-empty string.
4. Get user from locals (401 if null).
5. Verify user owns the diagram (query diagrams WHERE id AND owner_id).
6. If not found/not owned, return 404.
7. Generate a share token using `generateShareToken()` from `src/lib/share.ts`.
8. Insert into `share_tokens` table: `{ id: UUID, diagram_id, token, created_by: user.id, expires_at: null }`.
9. Cache diagram data in KV: `setCachedShare(cache, token, { diagramId, canvasData, title, description })`.
10. Construct share URL: `${url.origin}/share/${token}`.
11. Return 201 with:
```json
{
  "token": "abc123...",
  "shareUrl": "https://domain/share/abc123...",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

**Handle token collision:** If the random token already exists in DB (extremely unlikely with 24 chars), retry generation up to 3 times. If all collide, return 409 Conflict.

#### `src/pages/api/share/[token].ts`

**`DELETE /api/share/[token]`** — Revoke a share token.

1. Get user from locals (401 if null).
2. Query `share_tokens` WHERE `token = params.token`.
3. If not found, return 204 (idempotent — already deleted).
4. Verify user created the share OR owns the diagram (query diagram WHERE `id = share_token.diagram_id AND owner_id = user.id`).
5. If not authorized, return 403.
6. Delete from `share_tokens` table.
7. Delete from KV cache: `deleteCachedShare(cache, token)`.
8. Return 204 No Content.

### 2. Share Dialog in Canvas Editor

Update `src/components/canvas/CanvasEditor.tsx` (from phase 005) to implement the Share button:

Create a new component:

#### `src/components/canvas/ShareDialog.tsx`

Install shadcn component: `dialog`.

**Props:**
```typescript
interface ShareDialogProps {
  diagramId: string
}
```

**Behavior:**
1. On open, call `POST /api/share` with `{ diagramId }`.
2. Display the returned share URL in a read-only input field.
3. "Copy to Clipboard" button that copies the URL and shows a success toast.
4. Display the share link prominently.
5. Show error state if the API call fails.

Wire this dialog to the "Share" button in `CanvasEditor`'s top bar. The Share button should be disabled until the diagram has been saved at least once (i.e., has a `diagramId`).

### 3. Canvas Viewer Component

#### `src/components/canvas/CanvasViewer.tsx`

Implement the read-only viewer per spec §5.4:

**Props:**
```typescript
interface CanvasViewerProps {
  canvasData: string
  title: string
}
```

**Implementation:**
1. Initialize `<Tldraw>` with:
   - Same custom shape utils as CanvasEditor (`[CfServiceShapeUtil]`).
   - tldraw v4 bundles its own UI assets internally. If corporate network restrictions block default CDN loads, configure asset URLs via tldraw's `assetUrls` prop.
   - No toolbar (hide default tldraw toolbar/menus).
2. On mount:
   - `store.loadStoreSnapshot(JSON.parse(canvasData))`.
   - `editor.updateInstanceState({ isReadonly: true })`.
3. Show only zoom controls.
4. **Expose editor ref** so parent page can call export methods. Use `React.forwardRef` or a callback pattern to pass the `editor` instance up.

### 4. Share Viewer Page

#### `src/pages/share/[token].astro`

Implement per spec §5.3:

**SSR frontmatter:**
1. Extract `token` from `Astro.params`.
2. Get runtime env: `const { DB, CACHE } = Astro.locals.runtime.env`.
3. Check KV cache: `getCachedShare(CACHE, token)`.
4. If cache miss:
   - Query D1: JOIN `share_tokens` with `diagrams` WHERE `share_tokens.token = :token`.
   - Check expiry with `isShareTokenExpired(share_token.expires_at)`.
   - If not found or expired: render 404 page.
   - If found: populate KV cache with `setCachedShare()`, use the data.
5. If cache hit, use cached data directly.
6. **No auth required** — this page is outside CF Access scope (spec §3.1).

**Page content:**
- Minimal layout (no dashboard header, no login).
- Header area with:
  - Diagram title (large heading).
  - Diagram description (if present).
  - Export buttons: "Export PNG" and "Export SVG".
  - "Powered by Cloudflare Architect" branding with a link to `/`.
- `<CanvasViewer client:only="react">` island filling the remaining viewport.
- 404 state: Clean "This diagram is no longer available" message.

**Export implementation:**

The export buttons are plain HTML `<button>` elements in the Astro page. They need to call methods on the tldraw editor inside the React island. Use a pattern where:

Option A (recommended): Include export buttons inside the `CanvasViewer` React island itself, so they have direct access to the editor instance.

Option B: Use a global event bus or `window` reference to expose the editor.

**Option A implementation** — extend `CanvasViewerProps`:
```typescript
interface CanvasViewerProps {
  canvasData: string
  title: string
  showExportButtons?: boolean  // true for share page
}
```

Add export buttons inside the viewer component:
- **Export PNG**: `await editor.toImage(editor.getCurrentPageShapeIds(), { format: 'png', pixelRatio: 2, background: true })` → create download link.
- **Export SVG**: `await editor.getSvgString(editor.getCurrentPageShapeIds(), { background: true })` → create Blob → trigger download.

Use the `title` prop to name the downloaded files (e.g., `{title}.png`, `{title}.svg`).

### 5. Update Dashboard Card Share Action

Update the dashboard diagram cards (from phase 006) so that:
- The "Share" action on each card opens a simplified share dialog.
- If the diagram already has a share token, show the existing URL.
- If not, create a new one.

This requires fetching share token status. Add to the diagram list query: a subquery or join that checks if `share_tokens` exist for each diagram. Add an `hasShares` boolean to the list item response.

Alternatively, the share action can simply call `POST /api/share` each time (creating additional tokens is fine — a diagram can have multiple share tokens).

### 6. Cache Invalidation on Diagram Update

Verify that the `PUT /api/diagrams/[id]` endpoint (from phase 004) properly invalidates KV cache when `canvasData` changes:

- Query `share_tokens` for the diagram.
- For each token, call `deleteCachedShare(cache, token)`.

If this wasn't implemented in phase 004, add it now.

---

## Testing Requirements

### `tests/unit/api/share.test.ts`

Test share API endpoints with miniflare D1/KV:

- **POST /api/share**: Creates token, returns URL and token. Returns 404 for non-existent diagram. Returns 404 for non-owned diagram. Returns 401 for unauthenticated.
- **POST /api/share**: Verify KV cache is populated.
- **DELETE /api/share/[token]**: Deletes token and clears KV cache. Returns 204 for non-existent token (idempotent). Returns 403 for non-owner.

### `tests/unit/components/canvas/CanvasViewer.test.ts`

- Test component renders without errors (basic mount test).
- Test props are accepted correctly.

### `tests/unit/pages/share.test.ts`

- Test share page returns diagram data for valid token.
- Test share page returns 404 for invalid token.
- Test share page returns 404 for expired token.
- Test share page uses KV cache on hit.
- Test share page populates KV cache on miss.

---

## Testable Features

1. **Create share link**: Open a diagram in the canvas editor. Click "Share" button. A dialog should appear with a share URL.

2. **Copy share URL**: Click "Copy to Clipboard" in the share dialog. Paste to verify the URL.

3. **View shared diagram**: Open the share URL in a new browser tab (or incognito window). The diagram should load in read-only mode without requiring authentication.

4. **Read-only mode**: On the share page, try to move or edit shapes. Nothing should happen (read-only).

5. **Export PNG**: On the share page, click "Export PNG". A PNG file should download with the diagram content.

6. **Export SVG**: On the share page, click "Export SVG". An SVG file should download.

7. **Invalid share link**: Navigate to `/share/invalidtoken123`. Should see "This diagram is no longer available" message.

8. **Revoke share**: In the canvas editor, revoke the share token (if UI exists) or call `DELETE /api/share/{token}` via curl. The share URL should now show 404.

9. **No login required**: Access the share page in an incognito window with no cookies. Should work without authentication.

10. **KV cache**: After first load of a share page, subsequent loads should hit KV cache (verify via response time or logs).

---

## Acceptance Criteria

- [ ] `POST /api/share` creates tokens and caches data in KV
- [ ] `DELETE /api/share/[token]` revokes tokens and clears cache
- [ ] Share dialog in canvas editor generates and displays share URL
- [ ] `CanvasViewer` renders tldraw in read-only mode
- [ ] `/share/[token]` page loads diagram without authentication
- [ ] Export PNG button downloads a PNG file
- [ ] Export SVG button downloads an SVG file
- [ ] Invalid/expired tokens show 404 page
- [ ] KV cache is used for share lookups
- [ ] KV cache is invalidated on diagram update/delete
- [ ] All exports have JSDoc documentation
- [ ] Unit tests cover share API, viewer, and cache logic
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and share flow works
- [ ] `npm run build` succeeds
