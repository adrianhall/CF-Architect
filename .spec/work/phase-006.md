# Phase 006: Dashboard & Navigation

## Goal

Build the landing page, user dashboard, and blueprint browser. The landing page (`/`) is public and shows a branded hero with sign-in CTA. Authenticated users are redirected from `/` to `/dashboard`. The dashboard (`/dashboard`) displays the authenticated user's diagrams in a card grid. The blueprint browser (`/blueprints`) is a dedicated SSR page. Also create all reusable Astro UI components used across the app.

## Prerequisites

- Phase 005 complete (canvas editor and API endpoints working).

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Dashboard route | `/dashboard` (new page) | Clean separation from public landing page |
| Auth redirect | Middleware redirects `/` → `/dashboard` when authenticated | Server-side, no content flash |
| Blueprint browser | `/blueprints` (new SSR page) | Bookmarkable, full-page real estate, SSR-consistent |

## Deliverables

### 1. Astro UI Components

Create reusable SSR components in `src/components/ui/` using only Tailwind classes (no React, no JS). Reference shadcn/ui styling for visual consistency. See spec §11.3 for the full list.

#### `src/components/ui/Button.astro`

```typescript
interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  href?: string    // If provided, render as <a>
  type?: 'button' | 'submit'
  disabled?: boolean
  class?: string   // Additional classes
}
```

- Primary variant uses CF orange (`bg-cf-orange text-white hover:bg-cf-orange-dark`).
- Renders `<a>` if `href` provided, `<button>` otherwise.
- All variants styled with Tailwind.

#### `src/components/ui/Card.astro`

```typescript
interface Props {
  class?: string
}
```

- Rounded border, subtle shadow, white background.
- Named slots: `header`, `default` (body), `footer`.

#### `src/components/ui/Badge.astro`

```typescript
interface Props {
  variant?: 'default' | 'secondary' | 'outline'
  class?: string
}
```

- Small inline element for tags and role indicators.
- Default variant: CF orange background with white text.

#### `src/components/ui/Avatar.astro`

```typescript
interface Props {
  src?: string | null
  alt: string
  size?: 'sm' | 'md' | 'lg'
  fallback?: string  // Initials to show if no image
}
```

- Rounded `<img>` with fallback to initials in a colored circle.

#### `src/components/ui/Input.astro`

```typescript
interface Props {
  type?: string
  name: string
  placeholder?: string
  value?: string
  required?: boolean
  class?: string
}
```

- Styled native `<input>` with focus ring, border, padding.

#### `src/components/ui/Pagination.astro`

```typescript
interface Props {
  page: number
  totalPages: number
  baseUrl: string     // Base URL (params will be appended)
  extraParams?: Record<string, string>  // Preserve search/filter params
}
```

- Renders prev/next links and page numbers as `<a>` tags with query params.
- No JavaScript — pure server-rendered navigation.
- Shows "Previous", page numbers (with ellipsis for large ranges), "Next".
- Delegates page number computation to `src/lib/pagination.ts`.

#### `src/components/ui/Skeleton.astro`

```typescript
interface Props {
  class?: string
}
```

- `<div>` with `animate-pulse bg-cf-gray-100 rounded` for loading placeholders.

#### `src/components/ui/EmptyState.astro`

```typescript
interface Props {
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
}
```

- Centered content area for when lists are empty.
- Optional CTA button.

### 2. User Menu Island

#### `src/components/ui/UserMenu.tsx`

A small React island for the dropdown user menu in the header. Uses shadcn/ui `dropdown-menu`.

Install shadcn components if not already done:
- `dropdown-menu`

**Props:**
```typescript
interface UserMenuProps {
  userName: string
  avatarUrl: string | null
  isAdmin: boolean
}
```

**Menu items:**
- "Dashboard" → `/dashboard`
- "New Diagram" → `/canvas/new`
- If admin: "Admin Panel" → `/admin`
- Separator
- "Sign Out" → redirect to CF Access logout URL

### 3. Landing Page

#### `src/pages/index.astro`

Rewrite the placeholder page to implement a clean public landing page.

**Behavior:**
- Always public — middleware redirects authenticated users to `/dashboard` before this page renders.
- No SSR data fetching needed — static content only.

**Content:**
- Hero section with "Cloudflare Architect" heading.
- Brief description of the tool.
- "Sign In with GitHub" button that links to `/dashboard` (which triggers the CF Access OAuth flow for unauthenticated visitors).
- Clean, branded design with CF orange accents.

### 4. Dashboard Page

#### `src/pages/dashboard.astro`

New authenticated page at `/dashboard`.

**SSR frontmatter:**
1. Read `Astro.locals.user` (guaranteed non-null by middleware).
2. Parse query params: `page` (default 1), `search`, `tag`.
3. Query DB directly via Kysely: `WHERE owner_id = user.id`, `ORDER BY updated_at DESC`, `LIMIT 20`.
4. Batch-fetch tags for returned diagrams.
5. Compute total count for pagination.

**Dashboard content:**
- **Header**: Logo/title on left, UserMenu island on right (with avatar, name).
- **Action bar**: "New Diagram" button → `/canvas/new`, "Browse Blueprints" button → `/blueprints`.
- **Diagram grid**: Cards for each diagram showing:
  - Title
  - Description snippet (truncated to ~100 chars)
  - Tags as badges
  - Last updated date (formatted as relative time e.g., "2 hours ago")
  - Lazy-loaded thumbnail: `<img src="/api/diagrams/{id}/thumbnail" loading="lazy" alt="...">`
  - On card click → navigate to `/canvas/{id}`
  - Card actions: Edit (pencil icon link to `/canvas/{id}`), Delete (trash icon — triggers confirmation)
- **Empty state**: If no diagrams, show "No diagrams yet" with "Create your first diagram" CTA.
- **Pagination**: If more than 20 diagrams, show pagination links at the bottom.

### 5. Blueprint Browser Page

#### `src/pages/blueprints.astro`

New authenticated SSR page at `/blueprints`. Replaces the original `BlueprintBrowser.tsx` React island.

**SSR frontmatter:**
1. Read `Astro.locals.user`.
2. Parse query params: `page` (default 1), `search`.
3. Query DB: `WHERE is_blueprint = 1`, optional search filter, `ORDER BY title ASC`, `LIMIT 20`.
4. Batch-fetch tags for returned blueprints.
5. Compute total count for pagination.

**Content:**
- **Header**: Logo/title + UserMenu island (consistent with dashboard).
- **Back link**: "← Back to Dashboard" → `/dashboard`.
- **Search form**: `<form method="GET">` with `<Input.astro name="search">` — pure HTML, no JS.
- **Blueprint grid**: Cards showing title, description, tags. Click → `/canvas/new?blueprint={id}`.
- **Empty state**: "No blueprints available yet."
- **Pagination**: `<Pagination.astro>` at bottom when totalPages > 1.

### 6. Delete Confirmation Dialog

#### `src/components/ui/DeleteDiagramDialog.tsx`

A React island for confirming diagram deletion.

Install shadcn component: `alert-dialog`.

**Props:**
```typescript
interface DeleteDiagramDialogProps {
  diagramId: string
  diagramTitle: string
}
```

**Behavior:**
- Renders a button (trash icon).
- On click, opens an alert dialog: "Delete {title}? This action cannot be undone."
- On confirm, calls `DELETE /api/diagrams/{id}`.
- On success, refreshes the page.
- On error, shows error toast.

### 7. Toast Notifications

The `sonner` npm package is installed as a dependency of shadcn. The shadcn-generated `sonner.tsx` wrapper is **not used** — it depends on `next-themes` (not installed) and contains a circular import bug. Instead, import directly from the `sonner` package everywhere:

```tsx
// Placing the Toaster in Layout.astro:
import { Toaster } from 'sonner'

// Triggering toasts inside React islands:
import { toast } from 'sonner'
toast.error('Failed to delete diagram')
toast.success('Diagram deleted')
```

Add `<Toaster position="bottom-right" />` to `src/layouts/Layout.astro` as a React island (`client:load`).

### 8. Pagination Utility

#### `src/lib/pagination.ts`

Pure utility extracted from the Pagination component so page number logic can be unit-tested independently.

```typescript
export interface PageItem {
  type: 'page' | 'ellipsis'
  page?: number
}

/** Compute the list of page items (numbers and ellipsis markers) to display. */
export function computePageItems(current: number, total: number): PageItem[]

/** Build a URL for a given page number, preserving extra query params. */
export function buildPageUrl(
  baseUrl: string,
  page: number,
  extraParams?: Record<string, string>
): string
```

### 9. Relative Time Formatting

#### `src/lib/format.ts`

```typescript
/** Format an ISO 8601 timestamp as a relative time string (e.g., "2 hours ago"). */
export function formatRelativeTime(isoDate: string): string

/** Format an ISO 8601 timestamp as a readable date (e.g., "Jan 15, 2026"). */
export function formatDate(isoDate: string): string
```

Use `Intl.RelativeTimeFormat` for locale-aware relative formatting without external dependencies.

### 10. Middleware Change

#### `src/lib/middleware-handler.ts`

Modify the public route passthrough to redirect authenticated users from `/` to `/dashboard`:

- `/share/*` stays fully public (no auth attempt, pass through with `user = null`).
- `/` checks for authentication signals: dev mode OR presence of `CF_Authorization` cookie.
  - If authenticated: return `302 redirect` to `/dashboard`.
  - If not authenticated: set `user = null`, call `next()` (render landing page).
- `/dashboard` and all other non-public routes go through the existing auth flow unchanged.

---

## Testing Requirements

### `tests/unit/lib/format.test.ts`
- Test `formatRelativeTime` for "just now" (< 1 minute).
- Test `formatRelativeTime` for "5 minutes ago".
- Test `formatRelativeTime` for "2 hours ago".
- Test `formatRelativeTime` for "3 days ago".
- Test `formatDate` formats correctly.

### `tests/unit/lib/pagination.test.ts`
- Test `computePageItems` generates correct items for various page/totalPages combinations.
- Test ellipsis placement for large ranges (e.g., page 5 of 20).
- Test edge cases: page 1, last page, single page (empty result).
- Test `buildPageUrl` preserves extra query params.

### `tests/unit/middleware.test.ts` (updates)
- Update "GET / with user: null" test → in dev mode, GET `/` returns 302 redirect to `/dashboard`.
- Add: GET `/` without CF_Authorization cookie (prod mode) returns 200 (landing page).
- Add: GET `/` with CF_Authorization cookie present returns 302 redirect to `/dashboard`.
- Keep all `/share/*` tests unchanged.

---

## Testable Features

1. **Landing page**: Navigate to `http://localhost:4321`. See the branded landing page with "Sign In" button. (In dev mode, you are immediately redirected to `/dashboard`.)

2. **Dashboard loads**: Navigate to `/dashboard`. See the dashboard with action buttons and diagram grid.

3. **Empty state**: With no diagrams, see "No diagrams yet" message with CTA.

4. **Diagram cards**: Create a few diagrams via the canvas editor, return to dashboard. Cards should show title, description, tags, and lazy-loaded thumbnails.

5. **Lazy thumbnails**: Inspect the Network tab. Thumbnail images should load via `/api/diagrams/{id}/thumbnail` with `loading="lazy"`.

6. **Card navigation**: Click a diagram card. Should navigate to `/canvas/{id}`.

7. **New diagram button**: Click "New Diagram". Should navigate to `/canvas/new`.

8. **User menu**: Click the user avatar/name in the header. Dropdown should show Dashboard, New Diagram, Admin Panel links.

9. **Delete diagram**: Click the delete icon on a card. Confirmation dialog should appear. Confirm to delete.

10. **Blueprint browser**: Navigate to `/blueprints`. See blueprint cards (or empty state if none). Search input filters results. Clicking a blueprint navigates to `/canvas/new?blueprint={id}`.

11. **Pagination**: Create many diagrams, verify pagination links appear and navigate correctly.

12. **Auth redirect**: Visit `/` when authenticated (dev mode). Should be redirected to `/dashboard`.

---

## Acceptance Criteria

- [ ] All Astro UI components exist in `src/components/ui/` with Tailwind styling
- [ ] `src/pages/index.astro` shows branded landing page (always — authenticated users are redirected by middleware)
- [ ] `src/pages/dashboard.astro` shows diagram cards with title, description, tags, date
- [ ] `src/pages/blueprints.astro` shows blueprint grid with search and pagination
- [ ] Middleware redirects authenticated users from `/` to `/dashboard`
- [ ] Thumbnails lazy-load via `<img loading="lazy">`
- [ ] "New Diagram" button navigates to `/canvas/new`
- [ ] "Browse Blueprints" button navigates to `/blueprints`
- [ ] User menu dropdown works as React island
- [ ] Delete confirmation dialog works
- [ ] Empty state shown when no diagrams
- [ ] Pagination works for large diagram lists
- [ ] `src/lib/format.ts` provides relative time formatting
- [ ] `src/lib/pagination.ts` provides page computation utilities
- [ ] All exports have JSDoc documentation
- [ ] Unit tests pass
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and dashboard works
- [ ] `npm run build` succeeds
