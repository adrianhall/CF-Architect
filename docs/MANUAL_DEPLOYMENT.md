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

#### Sign in to CloudFlare One

1. Go to the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/)
2. If required, follow the prompts to set up an account (Free Plan is ok). You will be required to provide payment details.

#### Create an Identity Provider

1. Select **Integrations > Identity Providers**.
2. Select **Add an identity provider**.
3. Select your preferred identity provider, then follow the instructions all the way through to "Finish Setup" step.
4. Once you have verified your identity provider, you can continue to the next step.

#### Configure CloudFlare Access

1. Log into [CloudFlare Dev Platform dashboard](https://dash.cloudflare.com)
2. Select **Build > Workers & Pages**
3. Select your CF-Architect worker.
4. Select **Settings**.
5. On the `workers.dev` **Domains & Routes**, select the triple dot, then turn on **CloudFlare Access**
6. In **Variables and Secrets**, create a new variable called `CF_ACCESS_TEAM_DOMAIN` - set it to your CloudFlare one team name.

You can also do this last step from the command line:

**Option A** -- set it in `.env` so the deploy script includes it as a Worker var automatically:

```env
CF_ACCESS_TEAM_DOMAIN=myteam
```

**Option B** -- set it as a secret directly on the Worker:

```bash
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN
# Enter your Zero Trust team name (e.g. "myteam") when prompted
```

If the value is already set as a secret on the Worker and you don't provide it in `.env`, the existing secret is preserved.

#### Update the CloudFlare One Application

1. Go back to the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/).
2. Select **Access controls > Applications > cf-architect - CloudFlare Workers** (or whatever your application is called)
3. Select **Configure**.
4. Replace the Public hostname
   - Subdomain: cf-architect (or your worker name)
   - Domain: foo.workers.dev (or your worker domain)
   - Path: dashboard
5. Add two new public hostnames that are identical except for the path: `diagram/*` and `api/v1/*`
6. Click **Save application**
7. Select **Login methods**#
8. Ensure the Login method matches your identity provider.

#### Update the CloudFlare One Policy

1. Select **Access controls > Policies > cf-architect - Production** (or whatever your policy is called)
2. Select **Configure**
3. Set the rule to be:
   - Selector: **Login Methods**
   - Value: _Your identity provider_
4. Click **Save**

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
