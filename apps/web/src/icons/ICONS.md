# Icon Sources and Regeneration Guide

This directory contains the SVG icon assets used in CF-Architect.

---

## Directory layout

```
apps/web/src/icons/
├── src/                   Source SVG files (committed — edit here)
│   ├── workers.svg        Cloudflare product icons (copied from cloudflare-docs)
│   ├── ...
│   ├── gen-user.svg       Generic architecture primitives (custom-authored)
│   └── ...
├── ICONS.md               This file
└── ServiceIcon.tsx        React component that renders icons from the sprite
```

```
apps/web/public/icons/
└── sprite.svg             Generated SVG sprite (committed — do NOT edit manually)
```

---

## Icon sources

### Cloudflare product icons

**Source:** Sibling repository `../cloudflare-docs/src/icons/`

| Field    | Value                                                            |
| -------- | ---------------------------------------------------------------- |
| Upstream | Cloudflare Docs repository (internal)                            |
| Licence  | Pre-cleared for use in CF-Architect (see D10 in DECISION_LOG.md) |
| Re-sync  | Copy updated files and re-run the sprite builder (see below)     |

The following icons were copied at Phase 03 build time:

`access`, `ai-gateway`, `analytics`, `argo-smart-routing`, `artifacts`,
`browser-run`, `cache`, `cloudflare-one`, `cloudflare-wan`, `containers`,
`d1`, `dns`, `durable-objects`, `dynamic-workers`, `email-routing`,
`hyperdrive`, `images`, `kv`, `magic-transit`, `notifications`, `pages`,
`pipelines`, `queues`, `r2`, `rules`, `ssl`, `stream`, `vectorize`,
`warp-client`, `workers-ai`, `workers-vpc`, `workers`, `zaraz`, `workflows`

### Generic resource icons

Custom-authored SVGs for common non-Cloudflare architecture primitives.
These are original works and have no external licence dependency.

`gen-user`, `gen-agent`, `gen-external-api`, `gen-internet`,
`gen-mobile`, `gen-browser`, `gen-server`, `gen-database`

### Link / Service Bindings icon

`link` — adapted from a public SVG reference, simplified to match the
Cloudflare icon visual style (single path, monochrome fill, 24×24 viewBox).

---

## Regenerating the sprite

Run whenever you add, remove, or update a source SVG in `src/`:

```bash
npx tsx scripts/build-icon-sprite.ts
```

This reads every `*.svg` file in `apps/web/src/icons/src/`, strips `width`/
`height` attributes, removes explicit `fill="#000"` overrides, and writes
`apps/web/public/icons/sprite.svg`.

Commit both the updated source SVG and the updated `sprite.svg`.

**Why is the sprite committed?** See D12 in `docs/DECISION_LOG.md`.

---

## Adding a new icon

1. Obtain or author the SVG.
2. Ensure it has a `viewBox` attribute.
3. Strip `width=` and `height=` attributes (the sprite builder removes them,
   but keeping the source clean is preferred).
4. Place the file at `apps/web/src/icons/src/{iconId}.svg`.
5. Regenerate the sprite: `npx tsx scripts/build-icon-sprite.ts`
6. Commit both files.
7. Add a service entry in `packages/shared/src/catalog/services.ts` with
   `iconId: "{iconId}"`.

See `packages/shared/src/catalog/CONTRIBUTING.md` for the full workflow.

---

## `<ServiceIcon>` component

```tsx
import { ServiceIcon } from "../icons/ServiceIcon.js";

<ServiceIcon iconId="workers-kv" name="Workers KV" />
<ServiceIcon iconId="workers-kv" name="Workers KV" size={32} />
```

- Renders `<svg role="img" aria-label="{name}"><use href="/icons/sprite.svg#{iconId}" /></svg>`.
- Falls back to an accessible `<span role="img" aria-label="{name}">` when
  `iconId` is empty or the sprite fails to load the symbol.
- Never throws.
