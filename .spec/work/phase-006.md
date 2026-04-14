# Phase 006: Dashboard & Navigation

## Goal

Build the landing page / user dashboard that displays the authenticated user's diagrams in a card grid, provides navigation to create new diagrams or browse blueprints, and includes the user menu. Also create all reusable Astro UI components used across the app.

## Prerequisites

- Phase 005 complete (canvas editor and API endpoints working).

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
- "Dashboard" → `/`
- "New Diagram" → `/canvas/new`
- If admin: "Admin Panel" → `/admin`
- Separator
- "Sign Out" → redirect to CF Access logout URL

### 3. Dashboard Page

#### `src/pages/index.astro`

Rewrite the placeholder page to implement the full dashboard per spec §4.7.

**SSR frontmatter:**
1. Check `Astro.locals.user`:
   - If authenticated: fetch user's diagrams from DB (latest 20, ordered by `updated_at desc`).
   - Also fetch diagram tags for the results.
   - If not authenticated: render landing page.

**Landing page (unauthenticated):**
- Hero section with "Cloudflare Architect" heading.
- Brief description of the tool.
- "Sign In with GitHub" button that links to the CF Access-protected route (`/canvas/new`), which triggers the OAuth flow.
- Clean, branded design with CF orange accents.

**Dashboard (authenticated):**
- **Header**: Logo/title on left, UserMenu island on right (with avatar, name).
- **Action bar**: "New Diagram" button → `/canvas/new`, "Browse Blueprints" button (opens blueprint list).
- **Diagram grid**: Cards for each diagram showing:
  - Title
  - Description snippet (truncated to ~100 chars)
  - Tags as badges
  - Last updated date (formatted as relative time e.g., "2 hours ago")
  - Lazy-loaded thumbnail: `<img src="/api/diagrams/{id}/thumbnail" loading="lazy" alt="...">`
  - On card click → navigate to `/canvas/{id}`
  - Card actions: Edit (pencil icon link to `/canvas/{id}`), Share (link icon — placeholder), Delete (trash icon — triggers confirmation)
- **Empty state**: If no diagrams, show "No diagrams yet" with "Create your first diagram" CTA.
- **Pagination**: If more than 20 diagrams, show pagination links at the bottom.

### 4. Blueprint Browser

#### `src/components/BlueprintBrowser.tsx`

A React island (`client:load`) for browsing and selecting blueprints.

**Props:**
```typescript
interface BlueprintBrowserProps {
  onSelect?: (blueprintId: string) => void
}
```

**Behavior:**
- Fetches `GET /api/blueprints` on mount.
- Displays blueprints in a grid with title, description, tags.
- Clicking a blueprint navigates to `/canvas/new?blueprint={id}`.
- Search input to filter blueprints.
- If no blueprints exist, show a message: "No blueprints available yet."

### 5. Delete Confirmation Dialog

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
- On success, refreshes the page (or removes the card from DOM).
- On error, shows error toast.

### 6. Toast Notifications

Install shadcn component: `toast` (and its `toaster`, `use-toast` hook).

Create a `ToastProvider` that wraps interactive islands and provides toast notifications for success/error feedback on save, delete, share operations.

### 7. Relative Time Formatting

#### `src/lib/format.ts`

```typescript
/** Format an ISO 8601 timestamp as a relative time string (e.g., "2 hours ago"). */
export function formatRelativeTime(isoDate: string): string

/** Format an ISO 8601 timestamp as a readable date (e.g., "Jan 15, 2026"). */
export function formatDate(isoDate: string): string
```

Use `Intl.RelativeTimeFormat` for locale-aware relative formatting without external dependencies.

---

## Testing Requirements

### `tests/unit/components/ui/*.test.ts`

Test Astro UI components where feasible (testing rendered HTML output):
- Test `Pagination` generates correct links for various page/totalPages combinations.
- Test `Pagination` preserves extra query params.
- Test edge cases: page 1 (no previous), last page (no next), single page (no pagination).

### `tests/unit/lib/format.test.ts`
- Test `formatRelativeTime` for "just now" (< 1 minute).
- Test `formatRelativeTime` for "5 minutes ago".
- Test `formatRelativeTime` for "2 hours ago".
- Test `formatRelativeTime` for "3 days ago".
- Test `formatDate` formats correctly.

### `tests/unit/components/BlueprintBrowser.test.tsx`
- Test renders loading state.
- Test renders blueprint cards after fetch.
- Test renders empty state when no blueprints.
- Test search filter works.

---

## Testable Features

1. **Landing page**: In an incognito window (no auth), navigate to `http://localhost:4321`. See the branded landing page with "Sign In" button.

2. **Dashboard loads**: When authenticated (dev mode), navigate to `/`. See the dashboard with action buttons and diagram grid.

3. **Empty state**: With no diagrams, see "No diagrams yet" message with CTA.

4. **Diagram cards**: Create a few diagrams via the canvas editor, return to dashboard. Cards should show title, description, tags, and lazy-loaded thumbnails.

5. **Lazy thumbnails**: Inspect the Network tab. Thumbnail images should load via `/api/diagrams/{id}/thumbnail` with `loading="lazy"`.

6. **Card navigation**: Click a diagram card. Should navigate to `/canvas/{id}`.

7. **New diagram button**: Click "New Diagram". Should navigate to `/canvas/new`.

8. **User menu**: Click the user avatar/name in the header. Dropdown should show Dashboard, New Diagram, Admin Panel links.

9. **Delete diagram**: Click the delete icon on a card. Confirmation dialog should appear. Confirm to delete.

10. **Blueprint browser**: Click "Browse Blueprints". Modal/panel shows available blueprints (or empty state if none).

11. **Pagination**: Create many diagrams, verify pagination links appear and navigate correctly.

---

## Acceptance Criteria

- [ ] All Astro UI components exist in `src/components/ui/` with Tailwind styling
- [ ] `src/pages/index.astro` shows landing page (unauthed) or dashboard (authed)
- [ ] Dashboard displays diagram cards with title, description, tags, date
- [ ] Thumbnails lazy-load via `<img loading="lazy">`
- [ ] "New Diagram" button navigates to `/canvas/new`
- [ ] User menu dropdown works as React island
- [ ] Delete confirmation dialog works
- [ ] Blueprint browser fetches and displays blueprints
- [ ] Empty state shown when no diagrams
- [ ] Pagination works for large diagram lists
- [ ] `src/lib/format.ts` provides relative time formatting
- [ ] All exports have JSDoc documentation
- [ ] Unit tests pass
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and dashboard works
- [ ] `npm run build` succeeds
