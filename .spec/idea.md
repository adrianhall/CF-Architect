# Cloudflare Architect

I am working on a new project called "Cloudflare architect".  This is a web based application that consists of three sides:

Side 1: A react-based island that provides a canvas that an authenticated user can use to create service architextures for the Cloudflare Dev Platform.  They will be able to create an architecture from either a blueprint or a blank canvas and then modify by dragging services from a service selector toolbar and linking the services via lines.  Use something like tlflow for this.  Once finished, the user can share the architecture with a customer.

Side 2: An SSR page that allows an anonymous user to view and export an architecture that is shared with them.  The export includes PNG and SVG options.

Side 3: An SSR driven administrative interface that allows an authenticated administrator to add and remove users (and to promote/demote users from admin role).

Hosting: Cloudflare Workers
Database: Cloudflare D1
Cache: Cloudflare Workers KV
Identity / AuthN: Cloudflare Access via a GitHub identity provider

Setup:

- Set up the following in `.env` file:
  - CF_ACCESS_TEAM_NAME
  - GITHUB_CLIENT_ID
  - GITHUB_CLIENT_SECRET
- Run `npm run firstrun` to use terraform for setting up production env.
- Run `npm run deploy` to deploy code to the production site.

Local dev:

- Run `npm run dev` to run the site locally

Other commands:

- `npm run check`
  - Typecheck (TypeScript `tsc --noEmit`)
  - eslint
  - prettier
- `npm run test`
  - Unit tests (vitest, potentially with miniflare)
- `npm run test:coverage`
  - Unit tests with v8 coverage - expect 80% coverage
- `npm run test:e2e`
  - Playwright based end-to-end tests

Other important things:

- Use tldraw for canvas
- Use Kysely for database access
- Use tailwindcss and shadcn/ui for user interface
- Use Cloudflare color scheme and official SVG icons
