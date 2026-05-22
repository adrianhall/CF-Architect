---
phase: "10"
title: "MCP Server"
feature: "F10"
status: "Planned"
depends_on: ["09"]
---

# Phase 10 — MCP Server *(post-MVP)*

## Goal

Expose CF-Architect to AI agents via the Model Context Protocol so an LLM (or any MCP client) can
read the catalog and blueprints and create or mutate diagrams on a user's behalf — using the same
data layer and validation as the browser UI.

## Scope

### In Scope

All F10 user stories. MCP endpoint at `/mcp`. Tools: `list_services`, `list_blueprints`,
`get_diagram`, `create_diagram`, `add_node`, `remove_node`, `connect_nodes`, `update_node_data`,
`apply_blueprint`, `validate_architecture`, `export_scaffold`. Auth via Cloudflare Access service
token.

### Out of Scope

- Persistent agent monitoring without explicit invocation
- Fully autonomous diagram modification without user-in-the-loop confirm flow

## Pre-requisites

- Phase 09 complete (scaffold exporter; full service catalog with binding types)

## Tasks

### Dependencies

- [ ] `npm install @modelcontextprotocol/sdk` in `apps/worker` — evaluate version for Worker
  compatibility (must not use Node.js APIs unsupported in Workers)

### MCP transport

- [ ] `apps/worker/src/routes/mcp.ts`:
  - Mount MCP server at `GET /mcp` (SSE transport) and `POST /mcp` (HTTP transport)
  - Use `@modelcontextprotocol/sdk/server` with the Cloudflare Workers HTTP transport
  - Auth: verify `CF-Access-Client-Id` + `CF-Access-Client-Secret` headers (Cloudflare Access
    service token); map to a user record in `users` table; reject with 401 if missing
  - Register all tools (see below)

### MCP tools — read

- [ ] **`list_services`** — no params; returns catalog services array (calls `getCatalog()`)
- [ ] **`list_blueprints`** — params: `{ category?, q? }`; returns published blueprints (calls same query as `GET /api/blueprints`)
- [ ] **`get_diagram`** — params: `{ diagramId }`; returns diagram including `graph_json`; ownership check (caller's user must own the diagram)

### MCP tools — write

All write tools call the same internal service functions as the HTTP API routes. All mutations are
validated against the same Zod schemas used by the UI.

- [ ] **`create_diagram`** — params: `{ title, description? }`; creates blank diagram; returns `{ diagramId, version }`
- [ ] **`add_node`** — params: `{ diagramId, typeId, label?, position? }`; resolves typeId via alias map; validates typeId in catalog; appends node; saves diagram; returns updated `{ version }`
- [ ] **`remove_node`** — params: `{ diagramId, nodeId }`; removes node + connected edges; saves; returns updated `{ version }`
- [ ] **`connect_nodes`** — params: `{ diagramId, sourceNodeId, targetNodeId, edgeType? }`; validates no self-loop; appends edge; saves; returns updated `{ version }`
- [ ] **`update_node_data`** — params: `{ diagramId, nodeId, label?, description?, accentColour? }`; validates field lengths (label ≤80 chars, description ≤500); saves; returns updated `{ version }`
- [ ] **`apply_blueprint`** — params: `{ diagramId, blueprintSlug }`; replaces diagram's `graph_json` with the blueprint's; saves; returns updated `{ version }`
- [ ] **`validate_architecture`** — params: `{ diagramId }`; runs a best-practices ruleset (see below); returns `{ ok: boolean, findings: Finding[] }` where `Finding = { severity: "error" | "warning" | "info", message, nodeId? }`

### Validation ruleset (for `validate_architecture`)

- [ ] `packages/shared/src/rules/` — define an extensible rule interface and initial rules:
  - `no-isolated-nodes` — nodes with no edges are flagged as warnings
  - `d1-requires-worker` — D1 binding must have at least one Workers node in the diagram
  - `ai-gateway-recommended` — Workers AI without AI Gateway → info-level recommendation
  - `queue-needs-consumer` — Queues node must have at least one consumer Worker → warning

### MCP tools — scaffold

- [ ] **`export_scaffold`** — params: `{ diagramId, framework: "vanilla" | "hono" | "astro" }`; calls `generateWranglerConfig` + chosen template; returns the scaffold files as a `{ files: { path, content }[] }` payload (client downloads/uses directly; no ZIP in MCP response)

### Idempotency

- [ ] All write tools accept an optional `idempotencyKey: string` param; if the same key is submitted twice within 60 s, the second call returns the first result without re-executing (KV-backed; TTL 60 s)

## Schema Changes

None. MCP reuses existing D1 tables via the same query helpers.

## API Additions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/mcp` | Access Service Token | MCP SSE transport |
| `POST` | `/mcp` | Access Service Token | MCP HTTP transport |

## Test Plan

### Unit (Vitest)

- [ ] Validation ruleset — `no-isolated-nodes` fires on a graph with an unconnected node; `d1-requires-worker` fires when D1 node has no Worker neighbour
- [ ] `export_scaffold` tool — returns correct file list for hono template with D1 context
- [ ] Idempotency key — same key submitted twice returns identical result; different key returns fresh result

### Worker integration

- [ ] `list_services` → returns catalog with all expected fields
- [ ] `create_diagram` → new row in D1; returned `diagramId` is UUID
- [ ] `add_node` with valid typeId → diagram updated; version incremented
- [ ] `add_node` with unknown typeId → error response with clear message
- [ ] `remove_node` → node and connected edges removed; version incremented
- [ ] `validate_architecture` on a diagram with isolated node → finding returned
- [ ] Unauthenticated request to `/mcp` → 401

## Manual Tests

- [ ] **Tool discovery** — Using an MCP client (or `curl` with the appropriate MCP protocol headers),
  call the MCP endpoint at `GET /mcp`. Confirm a list of available tools is returned including
  `list_services`, `create_diagram`, and `validate_architecture`.
- [ ] **`list_services`** — Call `list_services` with no params. Confirm the response contains at
  least 30 services and each has `typeId`, `name`, `categoryId`, and `docLink`.
- [ ] **`create_diagram`** — Call `create_diagram` with `{ "title": "MCP Test Diagram" }`. Confirm
  a `diagramId` is returned. Open the CF-Architect dashboard in the browser. Confirm the new
  diagram appears with the title "MCP Test Diagram".
- [ ] **`add_node`** — Call `add_node` with `{ "diagramId": "<id>", "typeId": "workers-kv", "label": "Cache Layer" }`. Confirm the tool returns a new `version`. Open the diagram in the canvas.
  Confirm the "Cache Layer" KV node is present.
- [ ] **`connect_nodes`** — After adding two nodes via `add_node`, call `connect_nodes` with their
  IDs and `edgeType: "binding"`. Open the diagram. Confirm a binding edge connects the two nodes.
- [ ] **`validate_architecture`** — On a diagram with a D1 node but no Workers node, call
  `validate_architecture`. Confirm a finding with severity `"error"` and a message about
  `d1-requires-worker` is returned. Add a Workers node. Call again. Confirm the finding is gone.
- [ ] **`apply_blueprint`** — Call `apply_blueprint` with a known blueprint slug. Open the diagram.
  Confirm the graph now matches the blueprint.
- [ ] **`export_scaffold`** — Call `export_scaffold` with a diagramId and `framework: "hono"`.
  Confirm the response contains a `files` array including `wrangler.jsonc`, `package.json`, and
  `src/index.ts`. Paste the `wrangler.jsonc` content into a file and run
  `wrangler deploy --dry-run`; confirm it passes.
- [ ] **Idempotency** — Call `create_diagram` with `idempotencyKey: "test-key-1"`. Note the
  returned `diagramId`. Call the same tool with the same key. Confirm the same `diagramId` is
  returned and no duplicate row appears in the dashboard.
- [ ] **Auth rejection** — Call `POST /mcp` without a Cloudflare Access service token. Confirm HTTP
  401 is returned.

## Acceptance Criteria

| Story | How we verify |
|---|---|
| **F10-US1** — Discover MCP endpoint; list tools | Tool discovery manual test |
| **F10-US2** — Read catalog, blueprint list, and diagram via MCP | `list_services`, `list_blueprints`, `get_diagram` manual tests |
| **F10-US3** — Create diagram, add/remove nodes, connect edges; validated against same schema as UI | `create_diagram`, `add_node`, `connect_nodes`, `remove_node` manual tests + worker integration tests |
| **F10-US4** — `validate_architecture` returns structured critique | Validate architecture manual test |

## Rollout / Rollback

**Rollout:** `npm run deploy`. No migrations. MCP endpoint is additive.

**Rollback:** Remove `GET /mcp` and `POST /mcp` route registrations; redeploy.

## Open Questions

- [ ] Which MCP transport does `@modelcontextprotocol/sdk` support on Cloudflare Workers? The
  standard SDK targets Node.js. Evaluate the `workers` transport variant or the `streamable-http`
  transport which may work without Node APIs. Resolve before implementation starts.
- [ ] Should MCP mutations require the same CSRF protection as the HTTP API? MCP uses a different
  auth mechanism (service tokens), so Origin-based CSRF is not applicable. The service token
  itself is the CSRF equivalent. Document this exception clearly.
