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

Copy the `database_id` from the output -- you'll need it in step 4.

### 3. Create the KV namespaces

```bash
npx wrangler kv namespace create KV
npx wrangler kv namespace create SESSION
```

Copy each `id` from the output -- you'll need them in step 4.

### 4. Configure environment variables

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

### 5. Configure Cloudflare Access (Zero Trust)

Authentication is handled by Cloudflare Access. You need to create an Access Application that protects the application's routes.

1. Go to the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Access > Applications** and create a new **Self-hosted** application
3. Set the **Application domain** to your Workers deployment URL — this is the full hostname shown after you deploy (e.g. `cf-architect.myaccount.workers.dev`). You can also find it in the Cloudflare dashboard under **Workers & Pages**.
4. Add path rules to protect: `/dashboard`, `/diagram/*`, and `/api/v1/*`
5. Configure an identity provider (e.g. GitHub, Google, or email OTP) under **Settings > Authentication**
6. Set the `CF_ACCESS_TEAM_DOMAIN` secret in your Worker. This is your **Zero Trust organization name** (not the workers subdomain). You can find it in the Zero Trust dashboard URL (`https://one.dash.cloudflare.com/<account-id>/<team-name>/...`) or under **Settings > Custom Pages**. The app uses it to construct the JWT issuer URL `https://<team>.cloudflareaccess.com`.

```bash
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN
# Enter your Zero Trust team name (e.g. "myteam") when prompted
```

Ensure `DEV_MODE` is **not** set in production. The `wrangler.toml` `[vars]` section only applies to local development; production environment variables are managed via the Cloudflare dashboard or `wrangler secret`.

**Admin assignment:** The first user to authenticate after deployment is automatically granted admin privileges. If this is incorrect (e.g. an unintended user authenticates first), you can fix it via the D1 console:

```sql
UPDATE users SET is_admin = 0 WHERE email = 'wrong-user@example.com';
UPDATE users SET is_admin = 1 WHERE email = 'real-admin@example.com';
```

### 6. Build and deploy

```bash
npm run deploy
```

This command:

1. Generates a temporary `wrangler.toml` with your real resource IDs
2. Applies any pending D1 migrations to the remote database
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
