# Local Development

Use the following instructions to enable local development using miniflare:

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

This starts the Astro dev server with the Cloudflare platform proxy enabled, giving you local emulation of D1 and KV bindings via Miniflare. The app is available at **http://localhost:4321**.

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
