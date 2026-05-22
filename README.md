# CF-Architect

Visual architecture design tool purpose-built for Cloudflare.

> **Status:** Phase 01 in progress — Platform Foundations.
> See [docs/PLAN.md](./docs/PLAN.md) for the full engineering reference.

---

## Prerequisites

| Tool      | Minimum version | Install                                                                      |
| --------- | --------------- | ---------------------------------------------------------------------------- |
| Node.js   | 22.0.0          | [nodejs.org](https://nodejs.org) or use `.nvmrc` with `nvm use`              |
| npm       | 10.0.0          | Bundled with Node.js                                                         |
| Terraform | 1.9.0           | [developer.hashicorp.com](https://developer.hashicorp.com/terraform/install) |

---

## Quickstart

### 1. Clone and install

```bash
git clone https://github.com/adrianhall/CF-Architect.git
cd CF-Architect
git checkout v2
cp .env.example .env
```

Edit `.env` and fill in all required values before running `npm run provision`:

| Variable                   | Required | Description                                                                                                      |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`    | Yes      | Your Cloudflare account ID — right sidebar at dash.cloudflare.com                                                |
| `CLOUDFLARE_API_TOKEN`     | Yes      | Provisioning-scoped token: Workers, D1, KV, R2, Access permissions — see `.env.example` for exact scopes         |
| `SEED_ADMIN_EMAIL`         | Yes      | Email of the first admin user; must be able to authenticate via Cloudflare Access                                |
| `CLOUDFLARE_TEAM_DOMAIN`   | Yes      | Your Zero Trust team domain, e.g. `myteam.cloudflareaccess.com` — Zero Trust → Settings → Custom Pages           |
| `WORKER_DOMAIN`            | Yes      | Domain Cloudflare Access will protect, e.g. `cf-architect-production.<subdomain>.workers.dev`                    |
| `ALLOWED_EMAIL_DOMAIN`     | Yes      | Email domain to allow, e.g. `example.com` — any `@example.com` user authenticated via the IdP is permitted       |
| `CLOUDFLARE_ACCESS_IDP_ID` | Yes      | UUID of the Cloudflare Access Identity Provider — Zero Trust → Integrations → Identity Providers → click the IdP |
| `ENVIRONMENT`              | No       | Resource name suffix; defaults to `production`                                                                   |
| `CLOUDFLARE_ACCESS_AUD`    | —        | **Auto-populated** by Terraform after provision; do not fill in manually                                         |

```bash
npm ci
```

> `npm ci` automatically runs the `postinstall` script which rebuilds native deps (currently: esbuild).

### 2. Provision Cloudflare resources

```bash
npm run provision
```

This chains `terraform init → terraform apply → generate:wrangler` in one command and
generates `wrangler.jsonc`.

Confirm in the Cloudflare dashboard that the following resources were created:

- D1 database: `cf-arch-production`
- KV namespaces: `cf-arch-shares-production`, `cf-arch-catalog-production`
- R2 bucket: `cf-arch-assets-production`
- Worker: `cf-architect-production`

### 3. Deploy

```bash
npm run deploy
```

`npm run deploy` chains `generate:wrangler → migrate:remote → deploy:worker` automatically.
Migrations are idempotent — running deploy twice is safe. The Worker URL is printed by wrangler at
the end of this step.

---

## Local development

```bash
npm start
```

This builds the Vite SPA once (`npm run build:web`) and then starts
`wrangler dev`. The app is available at `http://localhost:8787`.

For hot-reloading UI changes, run the following in two separate terminals:

```bash
# Terminal 1 — Vite dev server with HMR
npm run dev:web

# Terminal 2 — Wrangler Worker with auto-reload
npm run dev:worker
```

The Vite dev server proxies `/api/*` and `/_auth/*` to `http://localhost:8787`.

Copy `.dev.vars.example` to `.dev.vars` and set `DEV_MODE=true` to enable
the interactive developer login bypass (no Cloudflare Access required locally).

---

## Script reference

| Script                      | What it does                                         | Destructive?                   |
| --------------------------- | ---------------------------------------------------- | ------------------------------ |
| `npm run build`             | Build web + worker (sequential)                      | No                             |
| `npm run build:web`         | Vite production build                                | No                             |
| `npm run build:worker`      | Wrangler dry-run build                               | No                             |
| `npm run check`             | types + lint + format + audit                        | No                             |
| `npm run check:types`       | TypeScript type-check                                | No                             |
| `npm run check:lint`        | ESLint across all workspaces                         | No                             |
| `npm run check:format`      | Prettier format check                                | No                             |
| `npm run check:audit`       | `npm audit` high/critical + signatures               | No                             |
| `npm run fix`               | Auto-fix lint + format issues                        | Yes                            |
| `npm run fix:lint`          | ESLint `--fix`                                       | Yes                            |
| `npm run fix:format`        | Prettier `--write`                                   | Yes                            |
| `npm run test`              | Unit tests + E2E tests                               | No                             |
| `npm run test:unit`         | Vitest (all projects) with Istanbul coverage         | No                             |
| `npm run test:e2e`          | Playwright E2E suite                                 | No                             |
| `npm run test:a11y`         | Playwright `@a11y`-tagged specs only                 | No                             |
| `npm run test:ci`           | Unit tests only (used in CI)                         | No                             |
| `npm start`                 | Build web then `wrangler dev`                        | No                             |
| `npm run dev:web`           | Vite dev server                                      | No                             |
| `npm run dev:worker`        | `wrangler dev`                                       | No                             |
| `npm run provision`         | `terraform init → apply → generate:wrangler`         | Yes                            |
| `npm run generate:wrangler` | Substitute TF outputs → `wrangler.jsonc`             | Yes                            |
| `npm run migrate:local`     | Apply Drizzle migrations (local miniflare)           | Yes                            |
| `npm run migrate:remote`    | Apply Drizzle migrations (production D1)             | Yes                            |
| `npm run deploy`            | `generate:wrangler → migrate:remote → deploy:worker` | Yes                            |
| `npm run teardown`          | `terraform destroy` + remove generated files         | **Yes — destroys cloud infra** |
| `npm run clean`             | Remove dist, coverage, `.wrangler` state             | Yes (local files only)         |

---

## Supply-chain security

This project implements layered supply-chain hardening. Seven of the eight planned
layers are active. Layer 1 (`ignore-scripts=true`) is **suspended during active
development (Phases 01–11)** and will be re-instated in Phase 12 (Security
Hardening). See [docs/plan/phase-12.md](./docs/plan/phase-12.md).

### Layer 1 — `ignore-scripts=true` _(suspended until Phase 12)_

When active, `.npmrc` sets `ignore-scripts=true` so no package lifecycle script
(postinstall, prepare, etc.) runs automatically during `npm ci`. This eliminates the
Shai-Hulud class of attacks where a compromised package exfiltrates tokens via
postinstall. Currently suspended to keep the dev loop frictionless; will be
re-instated and the postinstall allowlist fully audited in Phase 12.

### Layer 2 — Postinstall allowlist

`scripts/postinstall.mjs` runs a hand-maintained allowlist. Currently only `esbuild`
is listed (it needs to select a platform-specific binary). The script runs
automatically via npm's `postinstall` lifecycle hook. Adding a package to the
allowlist **requires a code-reviewed PR with written justification**.

### Layer 3 — Renovate 14-day cooldown

`.renovaterc.json` sets `minimumReleaseAge: "14d"`. A version published today is
invisible to Renovate for 14 days, giving time for typosquatting and
supply-chain attacks to be detected. Security advisory patches bypass this
cooldown and are expedited.

### Layer 4 — CI scanning

- `npm audit --audit-level=high` — blocks on high/critical CVEs
- `npm audit signatures` — verifies sigstore signatures; rejects tampered packages
- OSV-Scanner — second-opinion CVE scan from the OSV.dev database
- GitHub Dependabot security alerts — enabled on the repository

### Layer 5 — SHA-pinned GitHub dependency

`@adrianhall/cloudflare-auth` is installed directly from GitHub pinned to a
specific commit SHA:

```json
"@adrianhall/cloudflare-auth": "github:adrianhall/cloudflare-auth#447daa60bc3a0c4b72a9c2aa7f2ab2ac06013139"
```

Wildcards (`main`, branch names) are **never** used for GitHub-sourced deps.

### Lockfile registry check

Every `resolved` URL in `package-lock.json` must begin with
`https://registry.npmjs.org/`. The `lockfile-lint` step in CI enforces this.
The one exception is the `@adrianhall/cloudflare-auth` GitHub SHA URL, which
must be explicitly allowlisted if required.

---

## GitHub Actions secrets

The following secrets must be set on the repository before `deploy.yml` can
deploy to production:

| Secret                  | Scope                     | Description                                     |
| ----------------------- | ------------------------- | ----------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Repository                | Target Cloudflare account ID                    |
| `CLOUDFLARE_API_TOKEN`  | Environment: `production` | Workers Scripts:Edit-scoped token (deploy only) |

> Recommendation: use a dedicated CI sub-account with the narrowest possible
> token scope. The provisioning token (broad) should never be stored as a
> GitHub secret.

---

## Project structure

See [docs/PLAN.md §3](./docs/PLAN.md#3-repository-layout) for the full layout
reference.

```
/
├── .env.example              # Required environment variable documentation
├── .dev.vars.example         # Local-only variable documentation
├── .npmrc                    # Supply-chain: ignore-scripts, engine-strict
├── .renovaterc.json          # 14-day dependency cooldown
├── wrangler.template.jsonc   # Wrangler config template (${TF_OUTPUT_*} tokens)
├── wrangler.test.jsonc       # Test fixture with stub IDs (committed)
├── infra/                    # Terraform: D1, KV, R2, Worker
├── scripts/                  # CLI scripts: render-wrangler, migrate, postinstall
├── packages/shared/          # Shared Zod schemas, error codes, i18n stubs
├── apps/web/                 # Vite + React 19 SPA
├── apps/worker/              # Hono Worker (API + ASSETS)
└── e2e/                      # Playwright tests
```

---

## Phase index

See [docs/PLAN.md §13](./docs/PLAN.md#13-phase-index) for all phases.

This repository is currently implementing **Phase 01 — Platform Foundations**.
