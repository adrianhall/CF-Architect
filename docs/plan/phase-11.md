---
phase: "11"
title: "In-App AI Architect Chat"
feature: "F11"
status: "Planned"
depends_on: ["10"]
---

# Phase 11 — In-App AI Architect Chat *(post-MVP)*

## Goal

Embed an AI collaborator in the canvas editor that can read the open diagram, propose changes,
run a best-practices critique, and apply changes only with explicit user confirmation — never
autonomously.

## Scope

### In Scope

All F11 user stories. All LLM calls routed through Cloudflare AI Gateway. Per-user panel toggle.
Per-deployment `AI_ENABLED` env flag.

### Out of Scope

- Fully autonomous diagram modification without user confirmation
- Persistent background monitoring without explicit invocation

## Pre-requisites

- Phase 10 complete (architecture validation ruleset; `export_scaffold` tool; shared service layer)

## Tasks

### Infrastructure

- [ ] Provision Cloudflare AI Gateway in `infra/ai-gateway.tf` using the Cloudflare v5 provider;
  output the gateway ID and URL; add to `wrangler.template.jsonc` as `AI_GATEWAY_ID` env var
- [ ] Add `AI_ENABLED` variable to `infra/variables.tf` (default `true`); expose as Worker env var
- [ ] `apps/worker/src/middleware/ai-gate.ts`: middleware that checks `env.AI_ENABLED !== "false"`;
  returns 403 with `{ code: "AI_DISABLED" }` for all `/api/ai/*` routes when disabled

### AI backend route

- [ ] `apps/worker/src/routes/ai.ts`:
  - `POST /api/ai/chat` — authenticated; body: `{ diagramId, messages: ChatMessage[] }`; streams
    response via SSE
  - Loads current diagram from D1 (read-only; no save in this handler)
  - Builds system prompt: serialised diagram graph (nodes + edges with labels and typeIds) + catalog
    context (service descriptions for nodes present in the diagram) + architectural ruleset context
    + instructions that AI must propose changes in a structured JSON diff format
  - Calls the configured LLM (Cloudflare Workers AI `@cf/meta/llama-3.3-70b-instruct` or
    configurable via `AI_MODEL` env var) through AI Gateway; enables logging + caching
  - Parses LLM response to extract `proposedChanges: DiagramDiff[]` and `narrative: string`
  - Returns `{ narrative, proposedChanges }` as SSE events
- [ ] `DiagramDiff` type (in `packages/shared/src/schemas/ai.ts`): discriminated union of
  `AddNodeDiff | RemoveNodeDiff | ConnectNodesDiff | RemoveEdgeDiff | UpdateNodeDataDiff` —
  exactly the same operations as the MCP write tools; Zod-validated

### Web app — AI chat panel

- [ ] `apps/web/src/features/f11-ai/AIChatPanel.tsx`:
  - Collapsible side panel on the right edge of the editor (toggles with the properties panel;
    they share the right slot and only one is visible at a time)
  - Chat history: scrollable list of user messages and AI responses
  - AI responses show: `narrative` text + expandable "Proposed changes" section listing each diff
  - "Apply all" button and per-diff "Apply" / "Reject" buttons
  - Input area: text input + send button; `Enter` to send; `Shift+Enter` for newline
  - Loading state: shows "Thinking…" with accessible spinner while streaming
  - "Run critique" button at top of panel (calls `/api/ai/chat` with a pre-built critique prompt)
- [ ] AI chat panel toggle: button in canvas toolbar; preference persisted in `user_preferences.ai_panel_enabled`; disabled and hidden when `AI_ENABLED` env var is false (client checks `GET /api/version` response for an `aiEnabled: boolean` field)
- [ ] Add `aiEnabled` field to `GET /api/version` response

### Apply/reject flow

- [ ] `apps/web/src/features/f11-ai/useApplyDiff.ts`:
  - `applyDiff(diff: DiagramDiff)` — updates the diagram store using the same action functions as
    normal user interactions (addNode, removeNodes, addEdge, etc.); enters the undo history so the
    user can `Ctrl+Z` to undo an applied AI change
  - `rejectDiff(diff: DiagramDiff)` — marks the diff as rejected in local state; dismissed from
    the proposed changes list; no diagram change
- [ ] Each applied diff shows a brief toast: "AI change applied — Ctrl+Z to undo"
- [ ] AI changes never auto-apply without a button click; the LLM response only stages diffs;
  no code path applies a diff without user action (F11-US5)

### Per-user toggle

- [ ] "Hide AI panel" preference toggle in user settings (or directly in the panel header)
- [ ] When `ai_panel_enabled = false`, the panel button is removed from the toolbar entirely
- [ ] Separate from the `AI_ENABLED` deployment-level flag

## Schema Changes

None. AI panel state and preferences use the existing `user_preferences` table
(`ai_panel_enabled` column already present from Phase 02).

## API Additions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/ai/chat` | Required | Stream AI response with proposed diffs |

`GET /api/version` gains an `aiEnabled: boolean` field.

## Test Plan

### Unit (Vitest)

- [ ] `DiagramDiff` Zod schema — each variant parses correctly; unknown variant type returns error
- [ ] `applyDiff` — `AddNodeDiff` calls `addNode` in the diagram store; diff appears in undo history
- [ ] `applyDiff` — `RemoveNodeDiff` calls `removeNodes`; undoable
- [ ] AI gate middleware — returns 403 when `AI_ENABLED = "false"`; passes through otherwise
- [ ] `GET /api/version` returns `aiEnabled: true` when enabled; `false` when env flag is false

### Worker integration

- [ ] `POST /api/ai/chat` with `AI_ENABLED = "false"` → 403
- [ ] `POST /api/ai/chat` with a valid diagram → streams events including `narrative` and `proposedChanges`

### E2E (Playwright)

- [ ] Toggle AI panel on from toolbar; confirm panel opens
- [ ] Type "Add a Workers KV node for caching"; confirm AI response arrives with at least one proposed change
- [ ] Click "Apply" on a proposed `AddNodeDiff`; confirm the node appears on canvas
- [ ] Press `Ctrl+Z`; confirm the AI-applied node is removed (it is in undo history)
- [ ] Click "Reject" on a proposed change; confirm it disappears from the list; confirm diagram unchanged
- [ ] Toggle AI panel off from user preferences; confirm panel button disappears from toolbar

### Accessibility `@a11y`

- [ ] AI chat panel: zero serious/critical axe violations
- [ ] Loading spinner has accessible label
- [ ] Proposed changes list items have accessible names

## Manual Tests

- [ ] **AI panel toggle** — Open the canvas editor. Click the AI panel button in the toolbar.
  Confirm the AI chat panel opens on the right side. Click it again to close. Confirm it closes.
- [ ] **Deployment-level disable** — Set `AI_ENABLED=false` in `.dev.vars`. Restart `npm start`.
  Confirm the AI panel button is absent from the toolbar entirely. Confirm `GET /api/version`
  returns `aiEnabled: false`.
- [ ] **Ask for a change** — Open a diagram with Workers + D1 nodes. Open the AI panel. Type
  "Suggest adding a caching layer between the Worker and D1". Confirm a response arrives with
  a narrative explanation and at least one proposed change (likely an "Add Workers KV" node diff).
- [ ] **Apply a proposed change** — Click "Apply" on the proposed AddNode diff. Confirm the KV node
  appears on the canvas with the label suggested by the AI. Confirm the save status changes to
  "Unsaved changes" and then saves.
- [ ] **Undo applied AI change** — After applying the AI change above, press `Ctrl+Z`. Confirm the
  AI-applied node is removed from the canvas. Confirm it re-enters the proposed changes list (or
  is simply gone — either behaviour is acceptable, but undo must work).
- [ ] **Reject proposed change** — When AI proposes a change, click "Reject". Confirm the proposed
  change is dismissed from the list. Confirm the diagram is unchanged.
- [ ] **Run critique** — Click the "Run critique" button in the AI panel header. Confirm a critique
  response arrives describing any architectural issues. If the diagram is well-formed, confirm the
  AI reports no critical findings.
- [ ] **AI chat never auto-applies** — Send several messages to the AI. Confirm that at no point
  does any node or edge appear on the canvas without you explicitly clicking "Apply". The diagram
  store must only change when the user actively applies a diff.
- [ ] **Per-user toggle** — Click "Hide AI panel" in user preferences. Log out and log back in.
  Confirm the AI panel button is absent from the toolbar. Re-enable from preferences. Confirm it
  returns.
- [ ] **AI Gateway logging** — After sending a chat message, open the Cloudflare dashboard → AI
  Gateway. Confirm a log entry for the request appears with model, token usage, and latency.
- [ ] **Streaming** — Watch the AI response area while a request is in flight. Confirm the response
  text appears incrementally (character by character or chunk by chunk), not all at once.

## Acceptance Criteria

| Story | How we verify |
|---|---|
| **F11-US1** — AI chat panel in editor; propose/preview changes; apply or reject | Apply + reject manual tests |
| **F11-US2** — Per-user toggle to hide AI panel | Per-user toggle manual test |
| **F11-US3** — Deployment-level disable via `AI_ENABLED` env flag | Deployment-level disable manual test |
| **F11-US4** — All AI calls routed through AI Gateway with logging and caching | AI Gateway logging manual test |
| **F11-US5** — AI mutations require explicit user confirmation; never auto-applied | Auto-apply check manual test |

## Rollout / Rollback

**Rollout:** Set `AI_ENABLED=true`, provision AI Gateway via `npm run provision`, then
`npm run deploy`. No migrations. If AI Gateway provisioning fails, the feature can be soft-disabled
by setting `AI_ENABLED=false` without redeploying.

**Rollback:** Set `AI_ENABLED=false` in the Worker environment; redeploy. The AI panel disappears
from all users' UIs without any data loss.

## Open Questions

- [ ] Which LLM to use as default? Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct`) keeps
  all data within Cloudflare's network. Allow `AI_MODEL` to be overridden to support other models
  via AI Gateway (e.g. GPT-4o, Claude).
- [ ] Should AI chat history be persisted to D1 per user? Recommendation: keep it ephemeral
  (in-memory per session) for v2. Persistence can be added in v3 if users request it.
- [ ] Token budgeting: large diagrams sent as context could exceed model context windows. Implement
  a `trimContextToFit(diagram, model)` helper that truncates node descriptions if needed, with a
  warning in the UI ("Some diagram details were omitted from the AI context").
