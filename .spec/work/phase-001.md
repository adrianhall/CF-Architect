# Phase 001: Project Scaffolding & Dev Tooling

## Goal

Establish a fully configured project skeleton with all dependencies, dev tooling, Tailwind v4 theming, Terraform infrastructure-as-code, and npm scripts so that `npm run check`, `npm run dev`, `npm run build`, `npm run firstrun`, and `npm run deploy` all work from the very first phase.

## Prerequisites

- Fresh Astro project with `@astrojs/react` and `@astrojs/cloudflare` already installed (current state).
- Node.js >= 22.12.0.

## Deliverables

### 1. Install Dependencies

Add all remaining dependencies to `package.json`. Refer to `.spec/stack.md` for exact packages and versions.

**Production dependencies to add:**
- `tldraw` (^4.5.8)
- `kysely` (^0.28.16)
- `kysely-d1` (^0.4.0)
- `tailwindcss` (^4.2.2)
- `@tailwindcss/vite` (^4.2.2)
- `lucide-react` (^1.8.0)
- `class-variance-authority` (^0.7.1)
- `clsx` (^2.1.1)
- `tailwind-merge` (^3.5.0)

**Dev dependencies to add:**
- `typescript` (^5.9.3)
- `eslint` (^9.27.0)
- `eslint-plugin-astro` (^1.7.0)
- `@typescript-eslint/eslint-plugin` (^8.58.2)
- `@typescript-eslint/parser` (^8.58.2)
- `prettier` (^3.8.2)
- `prettier-plugin-astro` (^0.14.1)
- `prettier-plugin-tailwindcss` (^0.7.2)
- `vitest` (^4.1.4)
- `@cloudflare/vitest-pool-workers` (^0.14.6)
- `@testing-library/react` (^16.3.2)
- `@playwright/test` (^1.59.1)
- `@vitest/coverage-istanbul`

### 2. npm Scripts

Update `package.json` scripts to match `.spec/stack.md` §npm Scripts exactly:

```json
{
  "dev": "npm run copy:tldraw-assets && astro dev",
  "build": "npm run copy:tldraw-assets && astro build",
  "preview": "astro preview",
  "deploy": "npm run build && wrangler deploy",
  "copy:tldraw-assets": "mkdir -p public/tldraw-assets && if [ -d node_modules/@tldraw/assets ]; then cp -r node_modules/@tldraw/assets/* public/tldraw-assets/; fi",
  "firstrun": "cd terraform && terraform init && terraform apply",
  "check": "tsc --noEmit && eslint . && prettier --check .",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "generate-types": "wrangler types",
  "db:migrate": "wrangler d1 migrations apply cf-architect-db",
  "db:migrate:local": "wrangler d1 migrations apply cf-architect-db --local"
}
```

### 3. Configuration Files

#### `eslint.config.js`

Create a flat ESLint config (ESLint v9+ flat config format):
- Extend `@typescript-eslint/recommended`.
- Include `eslint-plugin-astro` recommended rules.
- Ignore `dist/`, `node_modules/`, `.astro/`, `public/tldraw-assets/`.
- Set `parserOptions.project` to `./tsconfig.json`.

#### `prettier.config.js`

```js
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  plugins: ['prettier-plugin-astro', 'prettier-plugin-tailwindcss'],
  overrides: [
    { files: '*.astro', options: { parser: 'astro' } },
  ],
}
```

#### `vitest.config.ts`

Configure Vitest with:
- `@cloudflare/vitest-pool-workers` as the pool for Workers API access.
- Istanbul coverage provider (V8 is not supported by `@cloudflare/vitest-pool-workers`) with 80% thresholds on statements, branches, functions, lines.
- Test file pattern: `tests/unit/**/*.test.{ts,tsx}`.
- Exclude: `node_modules`, `dist`, `tests/e2e`.

**Important:** The `@cloudflare/vitest-pool-workers` pool has specific configuration requirements. Follow the Cloudflare Vitest pool documentation. Create a `vitest.config.ts` at the project root. The pool config needs a `wrangler` section pointing at `wrangler.jsonc` and miniflare D1/KV bindings.

#### `playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev',
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4321',
  },
})
```

### 4. Tailwind v4 Setup

Tailwind v4 uses CSS-first configuration. No `tailwind.config.js` file.

#### `astro.config.mjs`

Add the `@tailwindcss/vite` plugin:

```js
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import cloudflare from '@astrojs/cloudflare'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  integrations: [react()],
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
  },
})
```

#### `src/styles/global.css`

Create a global CSS file with Tailwind imports and Cloudflare brand theme tokens:

```css
@import 'tailwindcss';

@theme {
  --color-cf-orange: #F6821F;
  --color-cf-orange-dark: #E87516;
  --color-cf-dark: #1A1A2E;
  --color-cf-dark-alt: #2D2D44;
  --color-cf-white: #FFFFFF;
  --color-cf-gray-50: #F9FAFB;
  --color-cf-gray-100: #F3F4F6;
  --color-cf-gray-500: #6B7280;
  --color-cf-gray-900: #111827;
}
```

### 5. Wrangler Configuration

Update `wrangler.jsonc` to include D1 and KV bindings per spec §10:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "compatibility_date": "2026-04-14",
  "compatibility_flags": ["global_fetch_strictly_public"],
  "name": "cf-architect",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS"
  },
  "observability": {
    "enabled": true
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "cf-architect-db",
      "database_id": "local"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "local"
    }
  ],
  "vars": {
    "CF_ACCESS_TEAM_NAME": "dev-team",
    "INITIAL_ADMIN_GITHUB_USERNAME": "dev-user"
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": []
    }
  ]
}
```

Note: `database_id` and KV `id` use placeholder values. These are replaced with real IDs from Terraform output before production deploy. Local dev uses miniflare emulation which doesn't need real IDs.

### 6. TypeScript Type Declarations

#### `src/env.d.ts`

```typescript
/// <reference path="../.astro/types.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<{
  DB: D1Database
  CACHE: KVNamespace
  CF_ACCESS_TEAM_NAME: string
  INITIAL_ADMIN_GITHUB_USERNAME: string
}>

declare namespace App {
  interface Locals extends Runtime {
    user: {
      id: string
      github_id: string
      github_username: string
      email: string
      display_name: string
      avatar_url: string | null
      role: 'admin' | 'user'
    } | null
  }
}
```

### 7. Base Layout

#### `src/layouts/Layout.astro`

Create the base HTML layout that all pages extend. Must:
- Include `<!DOCTYPE html>`, `<html lang="en">`, proper `<head>` with charset, viewport, title prop.
- Import `src/styles/global.css` for Tailwind.
- Render a `<slot />` in `<body>`.
- Accept `title` prop (string).
- Include JSDoc-style comment at the top of the frontmatter describing the component.

### 8. Placeholder Pages

#### `src/pages/index.astro`

Replace the default Astro page with a minimal placeholder that uses `Layout.astro`. Display "CF Architect" as a heading and a brief message. This will be fully implemented in phase 006.

### 9. Terraform Configuration

Create `terraform/` directory with three files per spec §9:

#### `terraform/main.tf`
Copy from spec §9.1 exactly. This defines:
- Terraform provider block for `cloudflare/cloudflare ~> 5.0`.
- `cloudflare_d1_database.db`
- `cloudflare_workers_kv_namespace.cache`
- `cloudflare_zero_trust_access_application.app`
- `cloudflare_zero_trust_access_identity_provider.github`
- `cloudflare_zero_trust_access_policy.allow_github`

#### `terraform/variables.tf`
Copy from spec §9.2.

#### `terraform/outputs.tf`
Copy from spec §9.3.

### 10. .gitignore Updates

Add to `.gitignore`:
```
public/tldraw-assets/
terraform/.terraform/
terraform/terraform.tfstate*
terraform/.terraform.lock.hcl
*.tfvars
worker-configuration.d.ts
```

### 11. Create Empty Directory Structure

Create empty placeholder directories (with `.gitkeep` files if needed):
- `src/components/canvas/`
- `src/components/canvas/shapes/`
- `src/components/ui/`
- `src/components/admin/`
- `src/lib/`
- `src/lib/db/`
- `src/lib/db/migrations/`
- `src/lib/auth/`
- `tests/unit/`
- `tests/e2e/`
- `public/icons/cf/`

### 12. shadcn/ui Setup

Initialize shadcn/ui for React components. Create `components.json` at the project root with the appropriate configuration pointing `src/components/ui/` as the component directory and configuring Tailwind CSS variables. Install the `cn` utility function at `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind CSS classes with clsx and tailwind-merge. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

### 13. Smoke Test

Create `tests/unit/setup.test.ts` — a basic smoke test that:
- Verifies the test runner works.
- Confirms that `cn()` utility merges classes correctly.
- Validates that the Cloudflare brand color constants are defined correctly.

This ensures `npm run test:coverage` has something to run and pass in phase 001.

---

## Testing Requirements

- `tests/unit/setup.test.ts` with at least 3 test cases.
- Tests for `cn()` utility function.
- All tests must pass with `npm run test:coverage`.
- Coverage threshold (80%) applies to `src/lib/utils.ts` at minimum.

---

## Testable Features

1. **Dev server starts**: Run `npm run dev`, browse to `http://localhost:4321`, see the placeholder page.
2. **Build succeeds**: `npm run build` completes without errors.
3. **Check passes**: `npm run check` (tsc + eslint + prettier) exits 0.
4. **Tests pass**: `npm run test:coverage` shows 100% pass rate and 80%+ coverage.
5. **Tailwind works**: Placeholder page renders with Tailwind styling (inspect the page, verify utility classes are applied).
6. **Terraform validates**: `cd terraform && terraform init && terraform validate` succeeds (does not require actual apply).

---

## Acceptance Criteria

- [ ] All dependencies from `.spec/stack.md` are installed in `package.json`
- [ ] All npm scripts from `.spec/stack.md` are configured
- [ ] `eslint.config.js` exists and lints cleanly
- [ ] `prettier.config.js` exists and formats cleanly
- [ ] `vitest.config.ts` exists and runs tests
- [ ] `playwright.config.ts` exists
- [ ] Tailwind v4 is configured with CF brand colors
- [ ] `src/layouts/Layout.astro` exists with proper HTML structure
- [ ] `src/env.d.ts` declares CF runtime types
- [ ] `wrangler.jsonc` has D1 and KV bindings
- [ ] `terraform/` contains `main.tf`, `variables.tf`, `outputs.tf`
- [ ] `.gitignore` updated with tldraw-assets, terraform state
- [ ] `src/lib/utils.ts` exists with `cn()` utility
- [ ] `npm run check` exits 0
- [ ] `npm run test:coverage` exits 0 with 80%+ coverage
- [ ] `npm run dev` starts and page loads
- [ ] `npm run build` succeeds
