# Cloudflare Architect - Technical Stack

## Runtime & Hosting

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Hosting | Cloudflare Workers | SSR + API edge runtime |
| Database | Cloudflare D1 | SQLite-based relational data |
| Cache | Cloudflare Workers KV | Session cache, share-token lookups |
| Auth | Cloudflare Access | GitHub IdP integration, JWT validation |
| Assets | Cloudflare Workers Assets | Static file serving (via Astro adapter) |

## Framework & Core Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| `astro` | ^6.1.6 | SSR framework with island architecture |
| `@astrojs/react` | ^5.0.3 | React island integration for Astro |
| `@astrojs/cloudflare` | ^13.1.9 | Cloudflare Workers SSR adapter |
| `react` | ^19.2.5 | UI component library (islands) |
| `react-dom` | ^19.2.5 | React DOM renderer |

## Canvas & Diagramming

| Package | Version | Purpose |
|---------|---------|---------|
| `tldraw` | ^4.5.8 | Interactive canvas for architecture diagrams |

**tldraw integration notes:**
- Rendered as a React island using `client:only="react"` (no SSR - tldraw requires DOM APIs).
- Custom shapes use `BaseBoxShapeUtil` with `TLGlobalShapePropsMap` module augmentation and `RecordProps` + `T` validators (tldraw v4 pattern). Ref: https://tldraw.dev/docs/shapes
- Built-in arrow shapes and bindings system handle service connections.
- Export via `editor.getSvgString()` and `editor.toImage()` for SVG/PNG.
- Read-only mode via `editor.updateInstanceState({ isReadonly: true })` for shared views.
- Persistence via `getSnapshot(editor.store)` / `loadSnapshot(editor.store, { document })` standalone functions from the `tldraw` package (tldraw v4 API). Ref: https://tldraw.dev/docs/persistence
- Blueprints are pre-built store snapshots loaded via `loadSnapshot(editor.store, { document })`.
- tldraw v4 bundles its own UI assets (fonts, icons, translations) internally. The `@tldraw/assets` package no longer exists as a standalone copy target. If corporate network restrictions block tldraw's default CDN loads, configure asset URLs via tldraw's `assetUrls` prop at the component level. The `public/tldraw-assets/` directory remains as a placeholder for this purpose.

## Database & ORM

| Package | Version | Purpose |
|---------|---------|---------|
| `kysely` | ^0.28.16 | Type-safe SQL query builder |
| `kysely-d1` | ^0.4.0 | Kysely dialect adapter for Cloudflare D1 |

**Kysely integration notes:**
- D1 binding accessed via Astro's `Astro.locals.runtime.env.DB`.
- All queries go through Kysely - no raw SQL strings outside of migration files.
- Database schema types generated/maintained alongside migration files.

## UI & Styling

| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^4.2.2 | Utility-first CSS framework |
| `@tailwindcss/vite` | ^4.2.2 | Tailwind v4 Vite plugin (replaces @astrojs/tailwind for v4) |
| `lucide-react` | ^1.8.0 | Icon library (used by shadcn/ui) |
| `class-variance-authority` | ^0.7.1 | Component variant management (shadcn dep) |
| `clsx` | ^2.1.1 | Conditional class merging |
| `tailwind-merge` | ^3.5.0 | Tailwind class deduplication |

**Note on shadcn/ui:** shadcn/ui is not an npm dependency. Components are scaffolded into `src/components/ui/` via the `npx shadcn@latest add` CLI and then owned by the project.

**Note on sonner:** The `sonner` npm package is used directly — import `{ Toaster }` and `{ toast }` from `'sonner'`. The shadcn-generated `sonner.tsx` wrapper is intentionally **not used** because it depends on `next-themes` (not installed in this project) and contained a circular import bug in the generated output. Ref: https://sonner.emilkowal.ski/

**UI notes:**
- Cloudflare brand colors as Tailwind theme tokens (orange `#F6821F`, dark `#1A1A2E`, etc.).
- Official Cloudflare Developer Platform SVG icons stored in `public/icons/cf/`.
- shadcn/ui components installed via CLI into `src/components/ui/`.

## Infrastructure as Code

| Tool | Version | Purpose |
|------|---------|---------|
| `terraform` | ^1.14.8 | Infrastructure provisioning (external CLI dependency) |
| `cloudflare/cloudflare` (Terraform provider) | ~5 | Cloudflare resource provider |

**Terraform manages:**
- D1 database creation
- KV namespace creation
- Cloudflare Access application and policy
- DNS records (if applicable)
- Workers secrets configuration

## Development Tooling

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.9.3 | Type checking |
| `wrangler` | ^4.82.2 | Cloudflare Workers CLI, local D1/KV emulation |
| `eslint` | ^9.27.0 | Linting (flat config) |
| `eslint-plugin-astro` | ^1.7.0 | Astro-specific lint rules |
| `@typescript-eslint/eslint-plugin` | ^8.58.2 | TypeScript lint rules |
| `prettier` | ^3.8.2 | Code formatting |
| `prettier-plugin-astro` | ^0.14.1 | Astro file formatting |
| `prettier-plugin-tailwindcss` | ^0.7.2 | Tailwind class sorting |

## Testing

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^4.1.4 | Unit/integration test runner |
| `@cloudflare/vitest-pool-workers` | ^0.14.6 | Miniflare-backed test pool for Workers APIs |
| `@testing-library/react` | ^16.3.2 | React component testing utilities |
| `@testing-library/jest-dom` | ^6.x | Custom DOM matchers for testing-library |
| `jsdom` | ^26.x | DOM environment for component tests |
| `@playwright/test` | ^1.59.1 | End-to-end browser testing |

**Testing architecture:**

The test suite uses **two Vitest projects** running in a single process via `test.projects` in the root `vitest.config.ts`. Coverage is collected globally across both projects with Istanbul.

| Project | Config file | Environment | Test directory | Purpose |
|---------|-------------|-------------|----------------|---------|
| `workerd` | `vitest.config.workerd.ts` | Cloudflare workerd (miniflare) | `tests/unit/` | Server-side logic needing D1/KV bindings |
| `dom` | `vitest.config.dom.ts` | jsdom | `tests/component/` | React component tests needing DOM APIs |

- A single `npm run test:coverage` invocation runs **both** projects and reports **combined** coverage against 80% thresholds.
- Istanbul coverage provider (V8 is not supported by `@cloudflare/vitest-pool-workers`).
- Component tests mock the `Tldraw` component and `useEditor()` hook. Full tldraw integration is covered by Playwright E2E tests.
- Playwright tests cover all three "sides" (canvas, share view, admin).

## npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `astro dev` | Local development with Wrangler emulation |
| `build` | `astro build` | Production build |
| `preview` | `astro preview` | Preview production build locally |
| `deploy` | `npm run build && wrangler deploy` | Build and deploy to Cloudflare |
| `firstrun` | `cd terraform && terraform init && terraform apply` | Provision infrastructure |
| `check` | `run-p check:*` | Type check + lint + format check (parallel) |
| `fullcheck` | `run-s check test:coverage` | Full CI gate: check + tests with 80% coverage |
| `test` | `vitest run` | Run all unit + component tests (both projects) |
| `test:watch` | `vitest` | Run tests in watch mode |
| `test:coverage` | `vitest run --coverage` | Tests with Istanbul coverage (80% threshold, combined) |
| `test:e2e` | `playwright test` | End-to-end tests |
| `generate-types` | `wrangler types` | Generate Cloudflare binding types |
| `db:migrate` | `wrangler d1 migrations apply cf-architect-db` | Run D1 migrations (production) |
| `db:migrate:local` | `wrangler d1 migrations apply cf-architect-db --local` | Run D1 migrations (local) |

## Environment Variables (`.env`)

| Variable | Purpose |
|----------|---------|
| `CF_ACCESS_TEAM_NAME` | Cloudflare Access team/org name |
| `INITIAL_ADMIN_GITHUB_USERNAME` | GitHub username for the initial admin (e.g. `octocat`) |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |

## Wrangler Bindings (configured in `wrangler.jsonc`)

| Binding | Type | Name |
|---------|------|------|
| `DB` | D1 Database | `cf-architect-db` |
| `CACHE` | KV Namespace | `cf-architect-cache` |
| `ASSETS` | Workers Assets | (auto-configured by Astro adapter) |

## Project Structure

```
CF-Architect/
├── .spec/                          # Specification documents
│   ├── PROMPT.md
│   ├── stack.md
│   └── spec.md
├── public/
│   ├── favicon.svg
│   ├── icons/cf/                   # Cloudflare service SVG icons
│   └── tldraw-assets/              # Placeholder for tldraw asset overrides (gitignored)
├── src/
│   ├── components/
│   │   ├── canvas/                 # tldraw canvas components
│   │   │   ├── CanvasEditor.tsx    # Full editor (Side 1)
│   │   │   ├── CanvasViewer.tsx    # Read-only viewer (Side 2)
│   │   │   └── shapes/            # Custom tldraw shape definitions
│   │   │       ├── CfServiceShapeUtil.tsx
│   │   │       └── cf-services.ts  # Service registry (names, icons, metadata)
│   │   ├── ui/                     # Astro + shadcn/ui components
│   │   │   ├── Button.astro        # Astro: primary/secondary/outline/ghost/destructive
│   │   │   ├── Card.astro          # Astro: rounded card with header/body/footer slots
│   │   │   ├── Badge.astro         # Astro: inline tag/role indicator
│   │   │   ├── Avatar.astro        # Astro: rounded image with initials fallback
│   │   │   ├── Input.astro         # Astro: styled native input
│   │   │   ├── Pagination.astro    # Astro: server-rendered prev/page/next links
│   │   │   ├── Skeleton.astro      # Astro: animate-pulse loading placeholder
│   │   │   ├── EmptyState.astro    # Astro: centered empty state with optional CTA
│   │   │   ├── UserMenu.tsx        # React island: dropdown user menu (client:load)
│   │   │   └── DeleteDiagramDialog.tsx  # React island: delete confirmation (client:load)
│   │   └── admin/                  # Admin interface components
│   ├── layouts/
│   │   └── Layout.astro            # Base HTML layout (includes Toaster)
│   ├── pages/
│   │   ├── index.astro             # Public landing page (unauthenticated only)
│   │   ├── dashboard.astro         # Authenticated diagram dashboard (/dashboard)
│   │   ├── blueprints.astro        # Blueprint browser (/blueprints)
│   │   ├── canvas/
│   │   │   ├── new.astro           # New architecture
│   │   │   └── [id].astro          # Edit architecture
│   │   ├── share/
│   │   │   └── [token].astro       # Anonymous share view (Side 2)
│   │   ├── admin/
│   │   │   ├── index.astro         # Admin dashboard (Side 3)
│   │   │   └── users.astro         # User management
│   │   └── api/                    # API endpoints
│   │       ├── diagrams/
│   │       ├── blueprints/
│   │       ├── share/
│   │       └── admin/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts           # Kysely database types
│   │   │   ├── client.ts           # Kysely D1 client factory
│   │   │   └── migrations/         # D1 SQL migration files
│   │   ├── auth/
│   │   │   ├── middleware.ts        # CF Access JWT validation
│   │   │   └── roles.ts            # Role checking utilities
│   │   ├── api.ts                  # API response helpers
│   │   ├── api-client.ts           # Client-side fetch wrapper
│   │   ├── cache.ts                # KV cache helpers
│   │   ├── format.ts               # Relative time & date formatting utilities
│   │   ├── pagination.ts           # Page number computation utilities
│   │   ├── share.ts                # Share token generation/validation
│   │   ├── utils.ts                # cn() Tailwind merge utility
│   │   └── validators.ts           # Input validation helpers
│   ├── styles/
│   │   └── global.css              # Tailwind v4 import + CF brand theme tokens
│   ├── middleware.ts                # Astro middleware (auth, locals, / redirect)
│   └── env.d.ts                    # Astro + Cloudflare type declarations
├── terraform/
│   ├── main.tf                     # Provider config + resources
│   ├── variables.tf                # Input variables
│   └── outputs.tf                  # Output values
├── tests/
│   ├── unit/                       # Vitest server-side tests (workerd pool)
│   │   └── lib/
│   │       ├── format.test.ts      # formatRelativeTime + formatDate tests
│   │       └── pagination.test.ts  # computePageItems + buildPageUrl tests
│   ├── component/                  # Vitest React component tests (jsdom)
│   └── e2e/                        # Playwright tests
├── astro.config.mjs
├── tsconfig.json
├── wrangler.jsonc
├── eslint.config.js
├── prettier.config.js
├── vitest.config.ts                # Root config: projects + global coverage
├── vitest.config.workerd.ts        # Workerd project config (D1/KV tests)
├── vitest.config.dom.ts            # DOM project config (component tests)
├── playwright.config.ts
└── package.json
```
