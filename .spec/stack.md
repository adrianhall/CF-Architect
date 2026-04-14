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
- Custom `ShapeUtil` subclasses define Cloudflare service node shapes.
- Built-in arrow shapes and bindings system handle service connections.
- Export via `editor.getSvgString()` and `editor.toImage()` for SVG/PNG.
- Read-only mode via `editor.updateInstanceState({ isReadonly: true })` for shared views.
- Persistence via `editor.store.getStoreSnapshot()` serialized to D1 as JSON.
- Blueprints are pre-built store snapshots loaded via `store.loadStoreSnapshot()`.
- tldraw UI assets (fonts, icons, translations) are self-hosted via `public/tldraw-assets/` to avoid external CDN requests in corporate environments. Configured using `@tldraw/assets/selfHosted` with a custom `assetUrls` override.

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
| `typescript` | ^6.0.2 | Type checking |
| `wrangler` | ^4.82.2 | Cloudflare Workers CLI, local D1/KV emulation |
| `eslint` | ^10.2.0 | Linting (flat config) |
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
| `@playwright/test` | ^1.59.1 | End-to-end browser testing |

**Testing notes:**
- Vitest runs unit tests with miniflare pool for D1/KV access in tests.
- v8 coverage provider targeting 80% threshold.
- Playwright tests cover all three "sides" (canvas, share view, admin).

## npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `npm run copy:tldraw-assets && astro dev` | Local development with Wrangler emulation |
| `build` | `npm run copy:tldraw-assets && astro build` | Production build |
| `preview` | `astro preview` | Preview production build locally |
| `deploy` | `npm run build && wrangler deploy` | Build and deploy to Cloudflare |
| `copy:tldraw-assets` | `cp -r node_modules/@tldraw/assets/* public/tldraw-assets/` | Copy tldraw UI assets for self-hosting |
| `firstrun` | `cd terraform && terraform init && terraform apply` | Provision infrastructure |
| `check` | `tsc --noEmit && eslint . && prettier --check .` | Type check + lint + format check |
| `test` | `vitest run` | Run unit tests |
| `test:watch` | `vitest` | Run unit tests in watch mode |
| `test:coverage` | `vitest run --coverage` | Unit tests with v8 coverage (80% threshold) |
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
│   └── tldraw-assets/              # Self-hosted tldraw fonts/icons/translations (copied at build, gitignored)
├── src/
│   ├── components/
│   │   ├── canvas/                 # tldraw canvas components
│   │   │   ├── CanvasEditor.tsx    # Full editor (Side 1)
│   │   │   ├── CanvasViewer.tsx    # Read-only viewer (Side 2)
│   │   │   └── shapes/            # Custom tldraw shape definitions
│   │   │       ├── CfServiceShapeUtil.tsx
│   │   │       └── cf-services.ts  # Service registry (names, icons, metadata)
│   │   ├── ui/                     # shadcn/ui components
│   │   └── admin/                  # Admin interface components
│   ├── layouts/
│   │   └── Layout.astro            # Base HTML layout
│   ├── pages/
│   │   ├── index.astro             # Landing / dashboard
│   │   ├── canvas/
│   │   │   ├── new.astro           # New architecture
│   │   │   └── [id].astro          # Edit architecture
│   │   ├── share/
│   │   │   └── [token].astro       # Anonymous share view (Side 2)
│   │   ├── admin/
│   │   │   ├── index.astro         # Admin dashboard (Side 3)
│   │   │   └── users.astro         # User management
│   │   └── api/                    # API endpoints
│   │       ├── architectures/
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
│   │   ├── cache.ts                # KV cache helpers
│   │   └── share.ts                # Share token generation/validation
│   ├── middleware.ts                # Astro middleware (auth, locals)
│   └── env.d.ts                    # Astro + Cloudflare type declarations
├── terraform/
│   ├── main.tf                     # Provider config + resources
│   ├── variables.tf                # Input variables
│   └── outputs.tf                  # Output values
├── tests/
│   ├── unit/                       # Vitest unit tests
│   └── e2e/                        # Playwright tests
├── astro.config.mjs
├── tsconfig.json
├── wrangler.jsonc
├── eslint.config.js
├── prettier.config.js
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```
