# Local Development

Use the following instructions to enable local development using miniflare:

### 1. Install dependencies

```bash
npm install
```

### 2. Create the local D1 database

Apply the migrations to provision a local SQLite database with tables:

```bash
npm run db:migrate:local
```

This creates the `users`, `diagrams`, and `share_links` tables. The local database is stored in `.wrangler/` (gitignored). After migration, the `users` table starts empty — users are created automatically on first authentication.

### 3. Start the dev server

```bash
npm run dev
```

This starts the Astro dev server with the Cloudflare platform proxy enabled, giving you local emulation of D1 and KV bindings via Miniflare. The app is available at **http://localhost:4321**.

> Alternatively, `npm start` runs `wrangler dev` which uses the full `workerd` runtime for a closer-to-production experience, but `npm run dev` has faster HMR during active development.

### 4. Open the app

Navigate to http://localhost:4321. You'll be redirected to the dashboard where you can create your first diagram.

## Authentication

Authentication is handled by **Cloudflare Access (Zero Trust)** in production. In local development, authentication is bypassed automatically via the `DEV_MODE` environment variable.

### How dev-mode auth works

The `wrangler.toml` `[vars]` section sets `DEV_MODE = "true"` for local development. When a request hits a protected route (`/dashboard`, `/diagram/*`, `/api/v1/*`) without a Cloudflare Access JWT header, the middleware automatically:

1. Creates (or retrieves) a `dev@localhost` user in the local D1 database
2. Sets that user on `context.locals.user`
3. Logs `[Auth] Using mock user for development.` to the console

The dev user is the first user created in a fresh database, so it automatically receives admin privileges (`isAdmin = true`).

Public routes (`/`, `/blueprints`, `/s/*`) do not require authentication and work without any auth headers.

### Testing with a real JWT

To test the production-like JWT flow locally against `wrangler dev`:

```bash
curl -H "Cf-Access-Jwt-Assertion: <your-jwt-token>" http://localhost:4321/api/v1/diagrams
```

The JWT will be verified against your Cloudflare Access team's public key endpoint. Set the `CF_ACCESS_TEAM_DOMAIN` environment variable to your team domain for this to work.

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
