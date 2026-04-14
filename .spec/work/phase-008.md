# Phase 008: Admin Panel (Side 3)

## Goal

Build the complete admin panel with dashboard statistics, user management (promote/demote/remove), and blueprint management (promote/demote). This is "Side 3" of the application. All admin routes require `role: 'admin'` (enforced by middleware from phase 003).

## Prerequisites

- Phase 007 complete (share flow working, all three "sides" have foundations).

## Deliverables

### 1. Admin API Endpoints

#### `src/pages/api/admin/stats.ts`

**`GET /api/admin/stats`** — Dashboard statistics.

Spec reference: §7.4.

1. Get user from locals (401 if null, 403 if not admin — but middleware already handles this).
2. Run four COUNT queries on D1:
   - `SELECT COUNT(*) FROM users` → `totalUsers`
   - `SELECT COUNT(*) FROM diagrams` → `totalDiagrams`
   - `SELECT COUNT(*) FROM share_tokens` (only non-expired) → `totalActiveShares`
   - `SELECT COUNT(*) FROM diagrams WHERE is_blueprint = 1` → `totalBlueprints`
3. For active shares, filter: `WHERE expires_at IS NULL OR expires_at > datetime('now')`.
4. Return:
```json
{
  "totalUsers": 15,
  "totalDiagrams": 42,
  "totalActiveShares": 8,
  "totalBlueprints": 5
}
```

#### `src/pages/api/admin/users/index.ts`

**`GET /api/admin/users`** — List all users (paginated).

Spec reference: §7.4.

Query params: `page`, `limit` (default 25), `search`, `role`, `sort` (default `created_at`), `order` (default `desc`).

1. Build Kysely query on `users` table.
2. If `search`: `WHERE github_username LIKE '%term%' OR display_name LIKE '%term%' OR email LIKE '%term%'`.
3. If `role`: `WHERE role = :role`.
4. Apply sort/order, pagination.
5. Run count query for total.
6. Map rows to `UserResponse` (camelCase).
7. Return `paginatedResponse()`.

#### `src/pages/api/admin/users/[id]/role.ts`

**`PUT /api/admin/users/[id]/role`** — Update user role.

Spec reference: §7.4.

1. Validate Content-Type.
2. Parse body: `{ role }`. Must be `"admin"` or `"user"`.
3. Validate: cannot change own role (compare `params.id` with `locals.user.id`). Return 400 with message "Cannot change your own role".
4. Query user by ID. If not found, return 404.
5. Update `role` and `updated_at` in `users` table.
6. **Delete user's KV cache** (`user:{email}`) so the new role takes effect immediately (spec §7.4 explicit requirement).
7. Return 200 with updated user.

#### `src/pages/api/admin/users/[id].ts`

**`DELETE /api/admin/users/[id]`** — Remove user and all their data.

Spec reference: §7.4.

1. Validate: cannot delete yourself. Return 400 with "Cannot delete your own account".
2. Query user by ID. If not found, return 204 (idempotent).
3. Before deleting, cleanup:
   a. Find all share tokens for the user's diagrams. Delete their KV cache entries.
   b. Delete the user's KV cache entry (`user:{email}`).
4. Delete user from `users` table. FK cascades will delete their diagrams, diagram_tags, and share_tokens.
5. Return 204 No Content.

#### `src/pages/api/admin/blueprints/[id].ts`

**`POST /api/admin/blueprints/[id]`** — Promote diagram to blueprint.

1. Query diagram by ID. If not found, return 404.
2. If already a blueprint (`is_blueprint = 1`), return 200 (idempotent).
3. Update `is_blueprint = 1` and `updated_at`.
4. Return 200 with updated diagram.

**`DELETE /api/admin/blueprints/[id]`** — Demote blueprint to regular diagram.

1. Query diagram by ID WHERE `is_blueprint = 1`. If not found, return 404.
2. Update `is_blueprint = 0` and `updated_at`.
3. Return 204 No Content.

### 2. Admin Layout

#### `src/layouts/AdminLayout.astro`

Create an admin-specific layout extending the base `Layout.astro`:

- **Sidebar** (left, fixed width ~256px):
  - Logo/title: "CF Architect Admin"
  - Navigation links:
    - Dashboard (`/admin`) — chart/stats icon
    - Users (`/admin/users`) — people icon
    - Blueprints (`/admin/blueprints`) — layers icon
  - Separator
  - "Back to App" link → `/`
  - Highlight active link based on current pathname.
  
- **Header bar** (top, to the right of sidebar):
  - Page title (passed as prop).
  - User info on the right: avatar, name, "Admin" badge.

- **Main content area**: `<slot />` for page content.

All styled with Tailwind. No React needed for the layout itself.

**Props:**
```typescript
interface Props {
  title: string
  activeNav?: 'dashboard' | 'users' | 'blueprints'
}
```

### 3. Admin Dashboard Page

#### `src/pages/admin/index.astro`

Spec reference: §6.2.

**SSR frontmatter:**
1. Fetch stats from D1 directly (same queries as the API endpoint — no need to call the API from SSR, query DB directly for efficiency).
2. Compute stats: totalUsers, totalDiagrams, totalActiveShares, totalBlueprints.

**Page content** (using `AdminLayout`):
- Four stat cards in a grid:
  - Total Users (people icon, count)
  - Total Diagrams (file icon, count)
  - Active Shares (link icon, count)
  - Blueprints (layers icon, count)
- Quick links: "Manage Users" → `/admin/users`, "Manage Blueprints" → `/admin/blueprints`.
- All rendered as pure Astro components with Tailwind. No React islands needed.

### 4. User Management Page

#### `src/pages/admin/users.astro`

Spec reference: §6.3.

**SSR frontmatter:**
1. Parse query params: `page`, `limit` (25), `search`, `role`, `sort`, `order`.
2. Query users from DB with filters and pagination.
3. Get total count for pagination.

**Page content** (using `AdminLayout`):
- **Search bar**: `<form>` with text input and optional role filter dropdown. Submits as GET with query params (no JS needed for search).
- **Users table**: HTML `<table>` with columns:
  - Avatar (small image)
  - Display Name
  - GitHub Username
  - Email
  - Role (badge: "Admin" in orange, "User" in gray)
  - Created Date
  - Actions
- **Actions column**: Contains React islands for interactive operations:
  - Role toggle: A small React island (`client:idle`) with a select/button to promote/demote.
  - Delete button: React island with confirmation dialog.
- **Pagination**: Astro `Pagination` component at the bottom.

#### `src/components/admin/RoleSelector.tsx`

Install shadcn component: `select`.

**Props:**
```typescript
interface RoleSelectorProps {
  userId: string
  currentRole: 'admin' | 'user'
  isSelf: boolean  // Disable if this is the current user
}
```

**Behavior:**
- Renders a select dropdown with "Admin" and "User" options.
- Disabled if `isSelf` is true.
- On change, calls `PUT /api/admin/users/{id}/role` with the new role.
- Shows success toast, updates the displayed role.
- Shows error toast on failure.

#### `src/components/admin/DeleteUserDialog.tsx`

Install shadcn component: `alert-dialog` (if not already installed in phase 006).

**Props:**
```typescript
interface DeleteUserDialogProps {
  userId: string
  userName: string
  isSelf: boolean
}
```

**Behavior:**
- Renders a delete button (disabled if `isSelf`).
- On click, opens confirmation: "Delete user {name}? This will remove the user and all their diagrams. This action cannot be undone."
- On confirm, calls `DELETE /api/admin/users/{id}`.
- On success, refresh page.
- On error, show error toast.

### 5. Blueprint Management Page

#### `src/pages/admin/blueprints.astro`

Spec reference: §6.4.

**SSR frontmatter:**
1. Query diagrams WHERE `is_blueprint = 1`, with pagination.
2. Also prepare a search for "promote" functionality.

**Page content** (using `AdminLayout`):
- **Blueprint list**: Cards or table showing current blueprints:
  - Title (editable inline — or via a modal)
  - Description
  - Tags as badges
  - Owner username
  - Created date
  - Actions: Preview (link to `/share/` or read-only view), Demote (remove blueprint status)
- **Promote section**: Search input to find existing diagrams by title. Results show as a list with a "Promote to Blueprint" button per diagram.
- **Pagination** for both blueprint list and search results.

#### `src/components/admin/BlueprintActions.tsx`

React island (`client:idle`) for blueprint management actions:

**Promote action:**
- Button that calls `POST /api/admin/blueprints/{id}`.
- Success toast, refresh.

**Demote action:**
- Button with confirmation that calls `DELETE /api/admin/blueprints/{id}`.
- Success toast, refresh.

### 6. Diagram Search for Blueprint Promotion

#### `src/pages/api/admin/diagrams.ts`

**`GET /api/admin/diagrams`** — Admin-only diagram search (for finding diagrams to promote).

This is similar to the regular diagram list but:
- Not filtered by owner (admins can see all diagrams).
- Excludes diagrams already marked as blueprints.
- Used only by the blueprint management page.

Query params: `search` (required), `page`, `limit`.

Response: Same paginated format as other list endpoints.

---

## Testing Requirements

### `tests/unit/api/admin/stats.test.ts`
- Test returns correct counts for each metric.
- Test counts update after adding/removing data.

### `tests/unit/api/admin/users.test.ts`
- Test **GET /api/admin/users**: Returns paginated user list. Search filter works. Role filter works.
- Test **PUT /api/admin/users/[id]/role**: Updates role, clears KV cache. Rejects self-role-change (400). Rejects invalid role (400). Returns 404 for non-existent user.
- Test **DELETE /api/admin/users/[id]**: Removes user and cascades. Clears KV cache. Rejects self-delete (400). Idempotent for non-existent user.

### `tests/unit/api/admin/blueprints.test.ts`
- Test **POST /api/admin/blueprints/[id]**: Promotes diagram. Idempotent if already blueprint. Returns 404 for non-existent.
- Test **DELETE /api/admin/blueprints/[id]**: Demotes blueprint. Returns 404 for non-blueprint.

### `tests/unit/api/admin/diagrams.test.ts`
- Test returns all users' diagrams (not owner-filtered).
- Test excludes blueprints from results.
- Test search filter works.

---

## Testable Features

1. **Admin dashboard**: Navigate to `/admin`. See four stat cards with counts. Quick links to Users and Blueprints.

2. **User list**: Navigate to `/admin/users`. See a table of all users with avatars, names, roles.

3. **Search users**: Type in the search box, submit. Table filters to matching users.

4. **Promote user**: Click the role selector on a "user" row, change to "Admin". The role should update.

5. **Demote user**: Click the role selector on an "admin" row, change to "User". The role should update. Verify you cannot change your own role (selector disabled).

6. **Delete user**: Click the delete button on a user row. Confirmation dialog appears. Confirm. User is removed. Their diagrams are gone.

7. **Blueprint list**: Navigate to `/admin/blueprints`. See current blueprints (or empty state).

8. **Promote to blueprint**: Use the search input to find a diagram. Click "Promote". The diagram appears in the blueprint list.

9. **Demote blueprint**: Click "Demote" on a blueprint. It's removed from the blueprint list (still exists as a regular diagram).

10. **Access control**: In a test, verify that a non-admin user gets 403 when accessing `/admin` or `/api/admin/*`.

---

## Acceptance Criteria

- [ ] `GET /api/admin/stats` returns correct statistics
- [ ] `GET /api/admin/users` lists all users with pagination/search/filter
- [ ] `PUT /api/admin/users/[id]/role` updates roles, clears KV cache
- [ ] `DELETE /api/admin/users/[id]` removes users with cascade, clears KV
- [ ] `POST /api/admin/blueprints/[id]` promotes diagrams
- [ ] `DELETE /api/admin/blueprints/[id]` demotes blueprints
- [ ] `GET /api/admin/diagrams` provides admin-level diagram search
- [ ] `AdminLayout` has sidebar navigation, header, main content area
- [ ] `/admin` shows stats dashboard
- [ ] `/admin/users` shows user table with role selector and delete
- [ ] `/admin/blueprints` shows blueprint list with promote/demote
- [ ] Cannot change own role or delete yourself
- [ ] All exports have JSDoc documentation
- [ ] Unit tests cover all admin API endpoints
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and admin panel works
- [ ] `npm run build` succeeds
