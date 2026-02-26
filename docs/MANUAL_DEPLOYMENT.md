# Manual Deployment

## First-Time Deployment

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 2. Create the D1 database

```bash
npx wrangler d1 create cf-architect-db
```

Copy the `database_id` from the output -- you'll need it in step 5.

### 3. Create the KV namespaces

```bash
npx wrangler kv namespace create KV
npx wrangler kv namespace create SESSION
```

Copy each `id` from the output -- you'll need them in step 5.

### 4. Create the R2 bucket

```bash
npx wrangler r2 bucket create cf-architect-assets
```

No ID needed -- R2 bindings use the bucket name.

### 5. Configure environment variables

Copy the example file and fill in the IDs from the previous steps:

```bash
cp .env.example .env
```

```env
D1_DATABASE_ID=<your-database-id>
KV_NAMESPACE_ID=<your-kv-id>
SESSION_NAMESPACE_ID=<your-session-kv-id>
```

The `.env` file is gitignored, so your IDs will never be committed.

### 6. Build and deploy

```bash
npm run deploy
```

This command:

1. Generates a temporary `wrangler.toml` with your real resource IDs
2. Applies any pending D1 migrations to the remote database (including seeding the default user)
3. Builds the Astro site for production
4. Deploys to Cloudflare Workers
5. Cleans up the temporary config

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
