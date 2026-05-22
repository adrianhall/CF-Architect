---
phase: "07"
title: "Sharing & Read-Only View"
feature: "F7"
status: "Planned"
depends_on: ["05"]
---

# Phase 07 — Sharing & Read-Only View

## Goal

Enable public link-based read-only sharing of any diagram: generate high-entropy tokens, support
optional expiry and revocation, cache tokens at the edge for performance, and render a read-only
viewer with a share banner and "Save a copy" CTA.

## Scope

### In Scope

All F7 user stories. Wire the delete-diagram share cascade from Phase 05. Rate limits on share
creation and token resolution.

### Out of Scope

- Per-recipient ACLs
- Comment threads on shared diagrams
- Embed iframe

## Pre-requisites

- Phase 05 complete (diagram persistence; `DELETE /api/diagrams/:id` cascade stub)

## Tasks

### Database

- [ ] **Migration 0005** — Create `shares` table (see Schema Changes)
- [ ] Drizzle schema + query helpers: `createShare(diagramId, createdBy, expiresAt?)`, `getShareByToken(token)`, `revokeShare(token, userId)`, `listSharesForDiagram(diagramId, userId)`, `deleteSharesByDiagram(diagramId)` (used by delete-diagram cascade)

### Token generation

- [ ] `apps/worker/src/lib/token.ts`: `generateShareToken(): string` — uses `crypto.getRandomValues(new Uint8Array(24))` → base32-encode → 40-char string; 192 bits of entropy (exceeds F7-US7 ≥128-bit requirement); no ambiguous characters (base32 avoids 0/O, 1/I/l)

### API routes

- [ ] `POST /api/diagrams/:id/shares` — authenticated (owner); body: `{ expiresIn: "1h" | "1d" | "1w" | null | number }` (number = custom seconds); if an unexpired, unrevoked share already exists for this diagram → return the existing token (F7-US6); otherwise generate new token, insert row, write to KV with appropriate TTL; return `{ token, url, expiresAt }`
- [ ] `GET /api/diagrams/:id/shares` — authenticated (owner); list all shares for this diagram with token (masked to first/last 4 chars for security), `created_at`, `expires_at`, `revoked_at`
- [ ] `DELETE /api/diagrams/:id/shares/:token` — authenticated (owner); sets `revoked_at = now`; deletes KV entry; returns 204
- [ ] `GET /share/:token` — **public**, no auth; check KV first (fast path); fallback to D1 (populate KV on hit); if not found / expired / revoked → 404 with clear message; if found → return diagram `{ title, owner_email, graph_json, expires_at, created_at }`
- [ ] Wire delete-diagram cascade: `DELETE /api/diagrams/:id` now calls `deleteSharesByDiagram(id)` and bulk-deletes all KV entries for that diagram's tokens
- [ ] Rate limits: `POST /api/diagrams/:id/shares` 10/min per user; `GET /share/:token` 60/min per IP

### KV share cache

- [ ] `apps/worker/src/lib/share-cache.ts`:
  - `setShareCache(token, data, ttlSeconds)` — writes serialised share + diagram data to `CF_ARCH_SHARES` KV
  - `getShareCache(token)` — reads from KV; returns null on miss
  - `deleteShareCache(token)` — removes entry (on revoke or diagram delete)
  - TTL = `min(expiresAt - now, 3600)` seconds; for no-expiry shares: TTL = 3600 s (1 h), refreshed on each hit

### Web app — share UI (in-editor)

- [ ] `apps/web/src/features/f07-sharing/ShareButton.tsx`:
  - Button in the canvas toolbar: "Share"
  - On click: opens `ShareDialog`
  - If an existing share exists (fetched from `GET /api/diagrams/:id/shares`): shows the link with copy-to-clipboard button, expiry info, and "Revoke" button
  - If no share: shows expiry selector (1 hour / 1 day / 1 week / Custom / No expiry) + "Create link" button
  - On create: calls `POST /api/diagrams/:id/shares`; shows the resulting URL with copy button
  - On revoke: calls `DELETE /api/diagrams/:id/shares/:token`; dialog updates to show "Link revoked"

### Web app — read-only viewer

- [ ] `apps/web/src/routes/share/$token.tsx`:
  - TanStack Router route; public (no auth required)
  - Fetches `GET /share/:token`
  - On 404: renders "This share link is invalid or has expired" page with link to home
  - On success: renders read-only canvas with the diagram's `graph_json`
  - `<ShareBanner>` at top: diagram title, owner email, share status ("Shared publicly"), optional expiry display
  - Canvas config: `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable={false}`; pan and zoom enabled; keyboard shortcuts for zoom/fit still active
  - Print button (Phase 08 wires full print view; stub as `window.print()` here)
  - "Save a copy" button visible only when authenticated (reads from `useCurrentUser()`)
- [ ] `apps/web/src/features/f07-sharing/SaveCopyButton.tsx`:
  - Calls `POST /api/diagrams/from-share/:token` (see below)
  - On success: navigates to `/canvas/:newId`
- [ ] `POST /api/diagrams/from-share/:token` — authenticated; creates new owned diagram from the share's graph data; title = share's diagram title + " (Copy)"; returns new diagram id
- [ ] Update `share_count` column in admin user list: `COUNT(shares)` per user (wire into `GET /api/admin/users`)

## Schema Changes

**Migration 0005:**

```sql
CREATE TABLE shares (
  token        TEXT    PRIMARY KEY,           -- 40-char base32; 192-bit entropy
  diagram_id   TEXT    NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  expires_at   INTEGER,                       -- Unix ms; null = no expiry
  revoked_at   INTEGER,                       -- Unix ms; null = active
  created_at   INTEGER NOT NULL,
  created_by   TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_shares_diagram ON shares (diagram_id, created_at DESC);
```

The `ON DELETE CASCADE` on `diagram_id` handles the cascade automatically at the D1 level.
The `deleteSharesByDiagram` query helper is still needed to bulk-purge the corresponding KV entries
(D1 cascade only removes DB rows; KV must be purged separately).

## API Additions

| Method   | Path                              | Auth             | Purpose                 |
| -------- | --------------------------------- | ---------------- | ----------------------- |
| `POST`   | `/api/diagrams/:id/shares`        | Required (owner) | Create share link       |
| `GET`    | `/api/diagrams/:id/shares`        | Required (owner) | List shares for diagram |
| `DELETE` | `/api/diagrams/:id/shares/:token` | Required (owner) | Revoke share            |
| `GET`    | `/share/:token`                   | Public           | Resolve share token     |
| `POST`   | `/api/diagrams/from-share/:token` | Required         | Save a copy from share  |

## Test Plan

### Unit (Vitest)

- [ ] `generateShareToken()` — output is 40 chars; unique across 1000 calls; only contains base32 alphabet characters
- [ ] `generateShareToken()` — calling it from a Worker context (uses `crypto.getRandomValues`) produces correct output
- [ ] `setShareCache` / `getShareCache` / `deleteShareCache` — correct KV key naming; TTL calculated correctly for expiring and non-expiring shares
- [ ] Existing-share return logic — second call to `POST /api/diagrams/:id/shares` returns the same token; expired share causes new token to be generated

### Worker integration

- [ ] `POST /api/diagrams/:id/shares` → token in response has 40 chars; KV entry created
- [ ] `GET /share/:token` → 200 with diagram data; KV miss → D1 lookup → KV populated
- [ ] `GET /share/:token` with expired share → 404
- [ ] `GET /share/:token` with revoked share → 404
- [ ] `DELETE /api/diagrams/:id/shares/:token` → revoked in DB; KV entry deleted
- [ ] `DELETE /api/diagrams/:id` → all share rows deleted (D1 cascade); all KV entries purged

### E2E (Playwright)

- [ ] Open a diagram; click "Share"; choose "1 day" expiry; click "Create link"; confirm URL shown with copy button
- [ ] Open the share URL in an incognito window (unauthenticated); confirm diagram is rendered read-only; confirm editing controls are absent
- [ ] Revoke the share; open the share URL again; confirm 404/invalid page is shown
- [ ] Log in and open a share URL as an authenticated user; confirm "Save a copy" button is visible; click it; confirm new diagram created and canvas opened

### Accessibility `@a11y`

- [ ] Share dialog: focus trapped; accessible name on copy button
- [ ] Read-only viewer: zero serious/critical axe violations; Share banner has appropriate landmark/role

## Manual Tests

- [ ] **Create share link** — Open a diagram. Click "Share" in the toolbar. Select "1 day" expiry.
      Click "Create link". Confirm the full share URL appears with a copy button. Click copy. Confirm
      the URL is copied to clipboard.
- [ ] **Open as anonymous user** — Paste the share URL into a private/incognito browser window
      (no login). Confirm the diagram renders with the share banner at the top showing the owner's
      email and "Expires in 1 day". Confirm you cannot drag nodes, draw connections, or access any
      editing controls. Confirm pan and zoom still work.
- [ ] **"Save a copy" as authenticated user** — While logged in, open a share URL. Confirm the
      "Save a copy to my account" button appears. Click it. Confirm the browser navigates to a new
      canvas with the same graph but a new title "(Copy)". Confirm the new diagram appears in your
      dashboard.
- [ ] **Share returns existing token** — Click "Share" on the same diagram a second time without
      revoking the first. Confirm the same URL is returned (not a new token).
- [ ] **Revoke share** — In the share dialog, click "Revoke". Confirm the dialog shows "Link revoked".
      Open the old share URL. Confirm an "invalid or expired" error page is shown.
- [ ] **Expiry options** — Create a share with each preset: 1 hour, 1 day, 1 week, no expiry.
      Confirm each shows the correct expiry time in the share dialog.
- [ ] **Custom expiry** — Create a share with "Custom" expiry and set it to 30 minutes. Confirm the
      share dialog shows "Expires in 30 minutes".
- [ ] **No expiry** — Create a share with "No expiry". Confirm no expiry date is shown in the share
      banner on the viewer.
- [ ] **Token entropy** — Inspect several generated share tokens. Confirm each is 40 characters of
      base32 (uppercase A-Z and 2-7 only). Confirm no two tokens are the same.
- [ ] **Delete diagram cascades shares** — Create a share link for a diagram. Note the share URL.
      Delete the diagram from the dashboard. Confirm the share URL now returns a 404/invalid page.
- [ ] **Rate limit on share creation** — Send 15 rapid POST requests to `POST /api/diagrams/:id/shares`.
      Confirm requests 11+ return HTTP 429.
- [ ] **Admin share count** — Navigate to `/admin`. Confirm the user list shows a share count
      greater than zero for your account (after creating shares above).
- [ ] **KV cache check** — After accessing a share URL, inspect the local KV namespace in Miniflare.
      Confirm an entry exists for the token. After revoking the share, confirm the entry is gone.

## Acceptance Criteria

| Story                                                                 | How we verify                              |
| --------------------------------------------------------------------- | ------------------------------------------ |
| **F7-US1** — Create share link; copy to clipboard with one click      | Create share manual test                   |
| **F7-US2** — Optional expiry presets when creating a share            | Expiry options manual test                 |
| **F7-US3** — Revoke share at any time                                 | Revoke share manual test                   |
| **F7-US4** — Open shared link without login; read-only pan/zoom/print | Anonymous viewer manual test               |
| **F7-US5** — "Save a copy" for authenticated visitors                 | Save a copy manual test                    |
| **F7-US6** — Share button returns existing unexpired link             | Returns-existing-token manual test         |
| **F7-US7** — Tokens ≥128-bit entropy                                  | Token entropy manual test (192-bit base32) |

## Rollout / Rollback

**Rollout:** `npm run migrate` (applies 0005) then `npm run deploy`. No existing data affected.

**Rollback:** `DROP TABLE shares;` (D1 cascade removes from DB); bulk-delete KV namespace entries;
redeploy previous Worker. No diagram data at risk.

## Open Questions

- [ ] Should the read-only viewer show the palette and properties panel (hidden/disabled), or omit
      those components entirely? Recommendation: omit entirely — the viewer uses a separate lighter
      route component that only renders the React Flow canvas + share banner.
- [ ] Should expired-but-not-revoked shares be garbage-collected automatically? Recommendation: add
      a nightly Cron Trigger (Cloudflare Workers Cron) that deletes rows where `expires_at < now AND
revoked_at IS NULL`. Implement in a future maintenance phase.
