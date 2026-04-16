# CF Architect

A web application for creating, editing, sharing, and exporting service architecture diagrams for the Cloudflare Developer Platform.

## Prerequisites

- Node.js >= 22.12.0
- [Terraform](https://www.terraform.io/) >= 1.14 (for infrastructure provisioning only)
- A Cloudflare account (for deployment only; local development uses emulation)

## Getting Started

```sh
npm install
npm run dev
```

The dev server starts at `http://localhost:4321`. Local D1 and KV are emulated by miniflare via Wrangler — no Cloudflare account or credentials needed for development.

Database migrations are applied automatically before the dev server starts.

## Scripts

| Script                     | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `npm run dev`              | Start local dev server (applies migrations first)              |
| `npm run build`            | Production build to `./dist/`                                  |
| `npm run preview`          | Preview production build locally                               |
| `npm run check`            | Type check + lint + format check (parallel)                    |
| `npm run fullcheck`        | `check` + unit tests with coverage                             |
| `npm run test`             | Run unit tests                                                 |
| `npm run test:coverage`    | Unit tests with Istanbul coverage (80% threshold)              |
| `npm run test:e2e`         | Playwright end-to-end tests (applies migrations + build first) |
| `npm run clean`            | Remove build artifacts, coverage, local D1 state               |
| `npm run deploy`           | Build and deploy to Cloudflare Workers                         |
| `npm run firstrun`         | Provision infrastructure via Terraform                         |
| `npm run db:migrate:local` | Apply D1 migrations locally                                    |
| `npm run db:migrate`       | Apply D1 migrations to production                              |

## Testing

Unit tests run inside the Cloudflare Workers runtime via `@cloudflare/vitest-pool-workers`, giving tests access to real D1 and KV bindings through miniflare.

```sh
npm run test              # unit tests
npm run test:coverage     # unit tests + Istanbul coverage report
npm run test:e2e          # Playwright browser tests (starts dev server)
```

## Deploying to Cloudflare

### First-time setup

1. Set up Terraform variables in `terraform/terraform.tfvars`:

   ```hcl
   cloudflare_account_id = "your-account-id"
   app_domain            = "cf-architect.your-cf-domain.workers.dev"
   github_client_id      = "your-github-oauth-client-id"
   github_client_secret  = "your-github-oauth-client-secret"
   ```

2. Provision infrastructure:

   ```sh
   npm run firstrun
   ```

   This creates the D1 database, KV namespace, and Cloudflare Access application.

3. Update `wrangler.jsonc` with the real resource IDs from Terraform output:
   - `d1_databases[0].database_id` from `d1_database_id`
   - `kv_namespaces[0].id` from `kv_namespace_id`

4. Set Worker secrets:

   ```sh
   wrangler secret put CF_ACCESS_TEAM_NAME
   wrangler secret put INITIAL_ADMIN_GITHUB_USERNAME
   ```

### Deploying

```sh
npm run db:migrate   # apply any pending migrations to production D1
npm run deploy       # build + deploy to Cloudflare Workers
```

## License

MIT
