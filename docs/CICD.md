# Deploy via GitHub Actions

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
   - **Account / Account Settings** -- Read

2. **Add repository secrets.** In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add:
   - `CLOUDFLARE_API_TOKEN` -- the API token created above
   - `CLOUDFLARE_ACCOUNT_ID` -- your Cloudflare account ID (found at the top of any zone or account page in the dashboard)
   - `D1_DATABASE_ID` -- the D1 database ID (run `npx wrangler d1 list` to find it)
   - `KV_NAMESPACE_ID` -- the KV namespace ID for the `KV` binding
   - `SESSION_NAMESPACE_ID` -- the KV namespace ID for the `SESSION` binding

3. **(Optional) Create a `production` environment.** Go to **Settings > Environments**, create an environment named `production`, and optionally add required reviewers for an approval gate before deploys.

4. **Cut a release.** Go to **Releases > Draft a new release**, create a tag (e.g., `v0.1.0`), and publish. The deploy workflow will trigger automatically.
