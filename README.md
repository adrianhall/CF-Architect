# CF Architect

A web application for designing, building, and sharing architecture diagrams for the Cloudflare Developer Platform. Drag and drop Cloudflare service nodes onto an interactive canvas, connect them to represent data flow and service bindings, and share finished diagrams via a read-only link.

Built with Astro, React, and React Flow, running entirely on the Cloudflare Developer Platform.

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

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- [npm](https://www.npmjs.com/) v10 or later
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (for deployment; not required for local development)

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create the local D1 database

Apply the migration to provision a local SQLite database with tables and seed data:

```bash
npm run db:migrate:local
```

This creates the `users`, `diagrams`, and `share_links` tables and seeds a default user. The local database is stored in `.wrangler/` (gitignored).

### 3. Start the dev server

```bash
npm run dev
```

This starts the Astro dev server with the Cloudflare platform proxy enabled, giving you local emulation of D1, KV, and R2 bindings via Miniflare. The app is available at **http://localhost:4321**.

> Alternatively, `npm start` runs `wrangler dev` which uses the full `workerd` runtime for a closer-to-production experience, but `npm run dev` has faster HMR during active development.

### 4. Open the app

Navigate to http://localhost:4321. You'll be redirected to the dashboard where you can create your first diagram.

## Available Scripts

| Script                     | Command                                                       | Description                                             |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| `npm run dev`              | `astro dev`                                                   | Astro dev server with HMR and Cloudflare platform proxy |
| `npm start`                | `wrangler dev`                                                | Full Cloudflare Workers local runtime (`workerd`)       |
| `npm run build`            | `astro build`                                                 | Production build                                        |
| `npm run preview`          | `astro preview`                                               | Preview the production build locally                    |
| `npm run deploy`           | `wrangler d1 migrations apply DB --remote && wrangler deploy` | Deploy to Cloudflare (see below)                        |
| `npm run db:generate`      | `drizzle-kit generate`                                        | Generate a new D1 migration from schema changes         |
| `npm run db:migrate:local` | `wrangler d1 migrations apply DB --local`                     | Apply migrations to the local D1 database               |
| `npm run lint`             | `eslint . && prettier --check .`                              | Run ESLint and check Prettier formatting                |
| `npm run format`           | `prettier --write .`                                          | Auto-format all files with Prettier                     |
| `npm run typecheck`        | `tsc --noEmit`                                                | TypeScript type checking                                |
| `npm run test`             | `vitest run`                                                  | Run unit and integration tests                          |
| `npm run test:coverage`    | `vitest run --coverage`                                       | Run tests and report code coverage                      |

## Linting & Formatting

The project uses [ESLint](https://eslint.org/) for static analysis and [Prettier](https://prettier.io/) for code formatting.

```bash
npm run lint       # check for lint errors and formatting issues
npm run format     # auto-format all files with Prettier
```

ESLint is configured in `eslint.config.mjs` (ESLint 9 flat config) with:

- **`typescript-eslint`** recommended type-checked rules for TypeScript files
- **`eslint-plugin-astro`** for `.astro` component linting
- **`eslint-plugin-react-hooks`** for React hooks rules in `.tsx` files
- **`eslint-config-prettier`** to disable formatting rules that conflict with Prettier

Prettier is configured in `.prettierrc.mjs` with `prettier-plugin-astro` for `.astro` file formatting.

## First-Time Deployment

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 2. Create the D1 database

```bash
npx wrangler d1 create cf-architect-db
```

Copy the `database_id` from the output and replace the placeholder `"local"` value in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cf-architect-db"
database_id = "<your-database-id>"   # paste here
```

### 3. Create the KV namespaces

```bash
npx wrangler kv namespace create KV
npx wrangler kv namespace create SESSION
```

Update `wrangler.toml` with the returned IDs:

```toml
[[kv_namespaces]]
binding = "KV"
id = "<your-kv-id>"                  # paste here

[[kv_namespaces]]
binding = "SESSION"
id = "<your-session-kv-id>"          # paste here
```

### 4. Create the R2 bucket

```bash
npx wrangler r2 bucket create cf-architect-assets
```

No ID update needed in `wrangler.toml` -- R2 bindings use the bucket name.

### 5. Build and deploy

```bash
npm run deploy
```

This command:

1. Applies any pending D1 migrations to the remote database (including seeding the default user)
2. Builds the Astro site for production
3. Deploys to Cloudflare Workers

The CLI will output your deployment URL (e.g., `https://cf-architect.<your-subdomain>.workers.dev`).

## Subsequent Deployments

After the initial setup, deploying is a single command:

```bash
npm run deploy
```

If you've made schema changes, generate a new migration first:

```bash
npm run db:generate        # generates SQL in migrations/
npm run db:migrate:local   # test locally
npm run deploy             # applies migration remotely, then deploys
```

## Automated CI/CD

The project includes two GitHub Actions workflows for continuous integration and deployment.

### CI on Pull Requests

The **CI** workflow (`.github/workflows/ci.yml`) runs automatically on every pull request and can also be triggered manually via `workflow_dispatch`. It executes the following checks in order:

1. `npm run typecheck` -- TypeScript type checking
2. `npm run lint` -- ESLint static analysis
3. `npm run format:check` -- Prettier format verification
4. `npm run build` -- Production build
5. `npm run test:coverage` -- Unit/integration tests with code coverage

A coverage summary table is appended to the GitHub Actions job summary after each run.

#### Requiring CI to pass before merging

To block PRs until CI passes, configure a branch protection rule:

1. Go to **Settings > Branches** in your GitHub repository.
2. Click **Add branch protection rule** (or edit the existing rule for `main`).
3. Check **Require status checks to pass before merging**.
4. Search for and select the **Build & Test** status check.
5. (Recommended) Check **Require branches to be up to date before merging**.
6. Save changes.

### Deploy on Release

The **Deploy** workflow (`.github/workflows/deploy.yml`) runs automatically when a GitHub release is published. It builds the project, applies any pending D1 database migrations, and deploys to Cloudflare Workers.

#### First-time setup

1. **Create a Cloudflare API token.** Go to the [Cloudflare dashboard API Tokens page](https://dash.cloudflare.com/profile/api-tokens) and create a token with the following permissions:
   - **Account / Cloudflare Workers Scripts** -- Edit
   - **Account / Cloudflare D1** -- Edit
   - **Account / Cloudflare R2** -- Edit (if using R2 assets)
   - **Account / Account Settings** -- Read

2. **Add repository secrets.** In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add:
   - `CLOUDFLARE_API_TOKEN` -- the API token created above
   - `CLOUDFLARE_ACCOUNT_ID` -- your Cloudflare account ID (found at the top of any zone or account page in the dashboard)

3. **(Optional) Create a `production` environment.** Go to **Settings > Environments**, create an environment named `production`, and optionally add required reviewers for an approval gate before deploys.

4. **Ensure `wrangler.toml` has real resource IDs.** Replace the `"local"` placeholder values for `database_id` and KV namespace `id` fields with the actual IDs from your Cloudflare account (see [First-Time Deployment](#first-time-deployment) above for commands to create these resources).

5. **Cut a release.** Go to **Releases > Draft a new release**, create a tag (e.g., `v0.1.0`), and publish. The deploy workflow will trigger automatically.

## Project Structure

```
cf-architect/
├── astro.config.mjs          # Astro + Cloudflare adapter config
├── eslint.config.mjs         # ESLint 9 flat config
├── .prettierrc.mjs           # Prettier config (Astro plugin)
├── wrangler.toml             # D1, KV, R2 bindings
├── drizzle.config.ts         # Drizzle ORM config
├── package.json
├── tsconfig.json
├── docs/
│   └── SPEC.md               # Full project specification
├── migrations/               # D1 SQL migrations (Drizzle)
├── public/
│   └── icons/                # Cloudflare product SVG icons (30 services)
├── src/
│   ├── middleware.ts          # Auth bypass, locals injection
│   ├── env.d.ts              # TypeScript env/binding types
│   ├── components/           # Astro components (Layout, Navbar)
│   ├── islands/              # React islands (client-hydrated)
│   │   ├── DiagramCanvas.tsx # Main React Flow canvas
│   │   ├── nodes/            # Custom CF node component
│   │   ├── edges/            # Custom edge renderers
│   │   ├── panels/           # ServicePalette, PropertiesPanel
│   │   ├── toolbar/          # Toolbar, StatusBar
│   │   ├── dashboard/        # DiagramList
│   │   └── store/            # Zustand diagram store
│   ├── lib/
│   │   ├── catalog.ts        # 30 CF node types + 4 edge types
│   │   ├── blueprints.ts     # Blueprint templates (post-MVP)
│   │   ├── share.ts          # Share link creation/resolution
│   │   ├── validation.ts     # Zod schemas + API response helpers
│   │   ├── helpers.ts        # ID generation, JSON responses
│   │   ├── auth/             # AuthStrategy interface + bypass
│   │   └── db/               # Drizzle schema + client
│   ├── pages/
│   │   ├── index.astro       # Redirects to /dashboard
│   │   ├── dashboard.astro   # Diagram list
│   │   ├── blueprints.astro  # Blueprint gallery (placeholder)
│   │   ├── diagram/[id].astro # Editor
│   │   ├── s/[token].astro   # Shared read-only view
│   │   └── api/v1/           # REST API routes
│   └── styles/
│       ├── global.css        # Tailwind directives, theme vars
│       └── components.css    # Component styles
└── tests/                    # (planned) Vitest + Playwright
```

## Key Features

- **30 Cloudflare service nodes** across 6 categories (Compute, Storage, AI, Media, Network, External)
- **4 edge types** with distinct visual styles (data flow, service binding, trigger, external)
- **Drag-and-drop** from the service palette onto the canvas
- **Auto-layout** powered by ELK (layered, orthogonal edge routing)
- **Autosave** with 500ms debounce and save status indicator
- **Undo/redo** with session-scoped history (Ctrl+Z / Ctrl+Shift+Z)
- **Share links** with read-only view and copy-to-clipboard
- **Dark mode** with system preference detection and manual toggle
- **Responsive** layout (palette collapses on smaller screens)
- **Properties panel** for editing node labels, descriptions, edge types, and protocols

## Authentication

The MVP runs in single-user mode with no login required. A seed user is created by the database migration. The `AuthStrategy` interface is designed for a future OIDC integration (Auth0 via Oslo/Arctic) without changes to route handlers or components.

## License

Private -- not open source.
