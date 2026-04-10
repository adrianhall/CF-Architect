# Deployment Guide

This guide covers everything needed to deploy CF-Architect to Cloudflare Workers,
from first-time setup through to ongoing deployments.

---

## Prerequisites

### Required for all deployments

- [Node.js](https://nodejs.org/) >= 24.0.0
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) with
  [Zero Trust](https://one.dash.cloudflare.com/) enabled (the free plan is
  sufficient; payment details are required to activate Zero Trust)

### Required for first-time setup only

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.2,
  installed and available in your `PATH`
- A [GitHub account](https://github.com) (used as the identity provider for
  Cloudflare Access)

---

## First-time setup

Run through these steps once to provision all required Cloudflare resources and
deploy the worker for the first time.

### Step 0 - Pre-setup

Obtain your **Workers Domain**:

- Open the [Cloudflare Dashboard](https://dash.cloudflare.com).
- Select **Workers & Pages** from the sidebar.
- Note the **Subdomain** under **Account Details**.

Obtain your **Zero Trust Team Name**:

- Open the [Cloudflare Dashboard](https://dash.cloudflare.com).
- Select **Zero Trust** > **Settings**.
- Note the **Team name** in the Settings panel.

### Step 1 — Create a GitHub OAuth application

- Go to [GitHub Developer Settings](https://github.com/settings/apps).
- Select **OAuth Apps**
- Select **New OAuth App**
- Fill in the form as below:

| Field                      | Value                                                                   |
| -------------------------- | ----------------------------------------------------------------------- |
| Application name           | CF Architect (or any name you like)                                     |
| Homepage URL               | `https://cf-architect.<your-workers-domain>`                            |
| Authorization callback URL | `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/callback` |

Where:

- `<your-workers-domain>` is your Cloudflare Workers subdomain.
- `<your-team-name>` is your Cloudflare Zero Trust team name.

After creating the app:

- Record the **Client ID**
- Click **Generate a new client secret** and record the value — it is only
  shown once

### Step 2 — Create a Cloudflare API token

- Go to [**Cloudflare Dashboard**](https://dash.cloudflare.com).
- Select **Manage account** > **Account API tokens**.
- Select **Create Token** > **Create Custom Token**.
- Add these **Account-level** permissions:

| Permission group                                      | Level |
| ----------------------------------------------------- | ----- |
| Workers Scripts                                       | Edit  |
| D1                                                    | Edit  |
| Workers KV Storage                                    | Edit  |
| Access: Apps and Policies                             | Edit  |
| Access: Organizations, Identity Providers, and Groups | Edit  |

Record the token — it is only shown once.

> The `Workers Scripts` permission is needed by `npm run deploy`. The remaining
> permissions are needed by `npm run firstrun` (Terraform). A single token
> covering all five permissions can be used for both commands.

### Step 3 — Configure your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in these values (leave the resource ID fields blank — they
are written automatically by `firstrun`):

| Variable                | Where to find it                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Token created in step 2                                                            |
| `CLOUDFLARE_ACCOUNT_ID` | Visible in the Cloudflare dashboard URL, or under **Account Home → right sidebar** |
| `CF_WORKERS_DOMAIN`     | Your Workers subdomain, e.g. `photoadrian.workers.dev`                             |
| `CF_ACCESS_TEAM_DOMAIN` | Your Zero Trust team name, e.g. `photoadrian`                                      |
| `GITHUB_CLIENT_ID`      | Client ID from step 1                                                              |
| `GITHUB_CLIENT_SECRET`  | Client secret from step 1                                                          |

The `.env` file is gitignored and will never be committed.

### Step 4 — Run `npm run firstrun`

```bash
npm run firstrun
```

This will:

1. Validate that all required variables are set in `.env`
2. Generate `terraform/terraform.tfvars` from your `.env` values
3. Run `terraform init` to install the Cloudflare provider (first run only)
4. Run `terraform apply` to create:
   - A D1 database (`cf-architect-db`)
   - Two Workers KV namespaces (`cf-architect-kv`, `cf-architect-session`)
   - A GitHub identity provider in Cloudflare Zero Trust
   - A Zero Trust Access application protecting the authenticated routes
   - A Zero Trust Access policy allowing any GitHub-authenticated user
5. Write the resulting resource IDs back into your `.env` file:
   - `D1_DATABASE_ID`
   - `KV_NAMESPACE_ID`
   - `SESSION_NAMESPACE_ID`

`firstrun` is idempotent — running it again is safe and is a no-op if nothing
has changed.

### Step 5 — Deploy the worker

```bash
npm run deploy
```

This will:

1. Load resource IDs from `.env`
2. Generate a temporary `wrangler.toml` with the real resource IDs
   (and `CF_ACCESS_TEAM_DOMAIN` as a Worker variable)
3. Apply any pending D1 schema migrations to the remote database
4. Build the Astro site for production
5. Deploy to Cloudflare Workers
6. Clean up the temporary config

The CLI will output your deployment URL:
`https://cf-architect.<your-workers-domain>`

### Step 6 — Log in

Browse to `https://cf-architect.<your-workers-domain>/dashboard`. Cloudflare
Access will redirect you to GitHub to authenticate. The first user to
successfully log in is automatically granted admin privileges.

> If the wrong user logs in first, you can correct this via the Cloudflare
> dashboard D1 console, or with `wrangler d1 execute`:
>
> ```bash
> npx wrangler d1 execute cf-architect-db --remote --command \
>   "UPDATE users SET is_admin = 0 WHERE email = 'wrong@example.com';
>    UPDATE users SET is_admin = 1 WHERE email = 'you@example.com';"
> ```

---

## Regular deployments

After the initial setup, deploying a new version is a single command:

```bash
npm run deploy
```

The command is idempotent — it always applies pending migrations before
deploying, so it is safe to run even when there are no schema changes.

### Schema migrations

If you have made changes to the database schema:

```bash
npm run db:generate        # generates a new SQL migration file in migrations/
npm run db:migrate:local   # apply and test locally
npm run deploy             # apply migration remotely, then deploy
```

Never edit migration files by hand after they have been applied to a remote
database.

---

## Deploy via GitHub Actions

You can automate deployment on every GitHub release using the deploy workflow
described in [CICD.md](./CICD.md).

The workflow requires these repository secrets (all of which come from your
`.env` after running `firstrun`):

| Secret                  | Value                                            |
| ----------------------- | ------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token (Workers Scripts + D1 Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                       |
| `D1_DATABASE_ID`        | D1 database ID                                   |
| `KV_NAMESPACE_ID`       | KV namespace ID                                  |
| `SESSION_NAMESPACE_ID`  | Session KV namespace ID                          |
| `CF_ACCESS_TEAM_DOMAIN` | Zero Trust team name                             |

See [CICD.md](./CICD.md) for the full setup instructions.

---

## Teardown

To permanently destroy all Cloudflare resources managed by Terraform:

```bash
npm run teardown
```

> **Warning:** This deletes the D1 database and all data it contains. There is
> no undo. Export or back up any important diagrams before running teardown.

After teardown completes, clear the resource ID variables from your `.env` file.
The Zero Trust Access application, identity provider, and KV namespaces are also
deleted — a fresh `npm run firstrun` will recreate them.

---

## What each part manages

| Managed by                     | Resources                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `npm run firstrun` (Terraform) | D1 database, KV namespaces, Zero Trust identity provider, Access policy, Access application |
| `npm run deploy` (Wrangler)    | Cloudflare Worker code, D1 schema migrations, Worker environment variables                  |
| `npm run teardown` (Terraform) | Destroys all resources created by `firstrun`                                                |

Terraform state is stored locally in `terraform/terraform.tfstate` (gitignored).
The worker itself is not tracked by Terraform and is not affected by `teardown`.
