# Project Structure

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Framework      | Astro 5 (SSR on Cloudflare Workers) |
| UI Islands     | React 19                            |
| Diagram Engine | React Flow (`@xyflow/react` v12)    |
| Styling        | Tailwind CSS 4                      |
| State          | Zustand                             |
| Database       | Cloudflare D1 (SQLite)              |
| Blob Storage   | Cloudflare R2                       |
| Cache          | Cloudflare Workers KV               |
| ORM            | Drizzle ORM                         |
| Validation     | Zod                                 |
| Auto-Layout    | ELK (`elkjs`)                       |

## File Structure

```text
cf-architect/
├── astro.config.mjs          # Astro + Cloudflare adapter config
├── eslint.config.mjs         # ESLint 9 flat config
├── .prettierrc.mjs           # Prettier config (Astro plugin)
├── wrangler.toml             # D1, KV, R2 bindings
├── drizzle.config.ts         # Drizzle ORM config
├── package.json
├── tsconfig.json
├── docs/
│   └── SPEC.md               # Full project specification
├── migrations/               # D1 SQL migrations (Drizzle)
├── public/
│   └── icons/                # Cloudflare product SVG icons (30 services)
├── src/
│   ├── middleware.ts          # Auth bypass, locals injection
│   ├── env.d.ts              # TypeScript env/binding types
│   ├── components/           # Astro components (Layout, Navbar)
│   ├── islands/              # React islands (client-hydrated)
│   │   ├── DiagramCanvas.tsx # Main React Flow canvas
│   │   ├── nodes/            # Custom CF node component
│   │   ├── edges/            # Custom edge renderers
│   │   ├── panels/           # ServicePalette, PropertiesPanel
│   │   ├── toolbar/          # Toolbar, StatusBar
│   │   ├── dashboard/        # DiagramList
│   │   └── store/            # Zustand diagram store
│   ├── lib/
│   │   ├── catalog.ts        # 30 CF node types + 4 edge types
│   │   ├── blueprints.ts     # Blueprint templates (post-MVP)
│   │   ├── share.ts          # Share link creation/resolution
│   │   ├── validation.ts     # Zod schemas + API response helpers
│   │   ├── helpers.ts        # ID generation, JSON responses
│   │   ├── auth/             # AuthStrategy interface + bypass
│   │   └── db/               # Drizzle schema + client
│   ├── pages/
│   │   ├── index.astro       # Redirects to /dashboard
│   │   ├── dashboard.astro   # Diagram list
│   │   ├── blueprints.astro  # Blueprint gallery (placeholder)
│   │   ├── diagram/[id].astro # Editor
│   │   ├── s/[token].astro   # Shared read-only view
│   │   └── api/v1/           # REST API routes
│   └── styles/
│       ├── global.css        # Tailwind directives, theme vars
│       └── components.css    # Component styles
└── tests/                    # (planned) Vitest + Playwright
```
