# CF-Architect v2 — Requirements

## 1. Overview

CF-Architect v2 is a visual architecture design tool purpose-built for Cloudflare. Users design architectures on a graph canvas, drawing from a comprehensive catalog of Cloudflare services, share diagrams via read-only links, export them as images or ready-to-run project scaffolds, and manage them across a dashboard — all within a secure, multi-user environment built entirely on the Cloudflare developer platform.

**Product goals:**

- Deliver a fast, accessible canvas-first design experience for Cloudflare architectures.
- Maintain a comprehensive, up-to-date Cloudflare service catalog without requiring code changes for updates.
- Provide a curated blueprint gallery so users can start from proven reference architectures.
- Enable frictionless sharing: anyone with a link can review a diagram without an account.
- Generate ready-to-run Cloudflare Workers project scaffolds directly from a diagram.
- Support secure multi-user deployments backed by existing organisational identity providers.
- Provide AI-powered assistance (post-MVP): programmatic agent access via MCP, and an in-app AI collaborator.

---

## 2. Personas

| Persona | Description | Primary needs |
|---|---|---|
| **Sasha** — Solo Architect | Cloudflare developer designing one architecture for a personal project or customer demo | Fast canvas, good catalog, accurate scaffold, easy sharing |
| **Priya** — Solutions Architect | SA / partner SE who builds many diagrams for many customers | Many diagrams, template starts, fast switching, branded exports |
| **Carlos** — Customer Reviewer | Recipient of a share link; needs to understand an architecture without an account | No-login read-only view, pan/zoom/print, copy to own account |
| **Tomas** — Admin / Team Lead | Owner of a CF-Architect deployment for their team or org | User management, audit, auth provider control |
| **Bea** — Blueprint Author | Internal expert who curates the reference architecture gallery | Publish blueprints without writing code or deploying |
| **Aria** — AI Agent *(post-MVP)* | An LLM or Cloudflare AI agent acting on behalf of another persona via MCP | Stable, typed, idempotent tools for reading and mutating diagrams |

---

## 3. Features

---

### F1 — Platform Foundations

**Goal:** The operational foundation that makes everything else cheap to change: repeatable provisioning, multi-environment deploys, observability, abuse protection, and a consistent API surface.

**In Scope:** Repeatable one-command provisioning of a CF-Architect deployment; clearly separated local / preview / production environments; structured operational logs and metrics; rate limits on abuse-prone endpoints (share creation, share resolution, autosave, admin); preview environment per pull request with isolated data, cleaned up on PR close; consistent API envelope and error taxonomy; secrets handling that fails closed if misconfigured.

**Out of Scope:** Multi-region active-active; SLA contracts; bring-your-own-cloud.

---

#### F1 Jobs to be Done

- **F1-J1 (Tomas):** When I deploy a new CF-Architect instance, I want one command to provision everything, so I can stand it up in minutes.
- **F1-J2 (Tomas):** When something goes wrong, I want structured logs and metrics, so I can debug without bothering a developer.

---

#### F1 User Stories

- **F1-US1** As ops, I want structured JSON logs with request metadata on every request, so that I can debug issues quickly.

- **F1-US2** As ops, I want preview deploys created per PR with isolated data, auto-cleaned up on PR close, so that every change is reviewable in a real environment.

- **F1-US3** As ops, I want rate limits on share creation, share resolution, autosave, and admin endpoints, so that the API is resilient to abuse.

- **F1-US4** As Tomas, I want `npm run provision` to provision all Cloudflare resources from a fresh account with a single API token, so that deployment is repeatable and documented.

- **F1-US5** As Tomas, I want `npm run deploy` to be idempotent and to apply pending schema migrations before deploying, so that schema changes are never skipped.

- **F1-US6** As Tomas, I want `npm start` to run the code locally. 

#### F1 Notes

We use a combination of Terraform and Wrangler to deploy the app.  The ideal process is:

- User copies `.env.example` to `.env` and fills in appropriate information.
- User then runs `npm run provision` - this deploys infrastructure.
- Using the terraform outputs, the `wrangler.jsonc` is updated with outputs (postprovision script)
- The user can now run `npm run deploy` to deploy the code and get a functioning system.

If required, the user can also run locally by just running `npm start` which will run `wrangler dev`.

The [`dotenv` terraform provider](https://registry.terraform.io/providers/jrhouston/dotenv/latest/docs/data-sources/dotenv) can be used to read .env files for secrets.

---

### F2 — Identity, Access & Multi-User

**Goal:** Authenticated multi-user usage with admin controls and a clean auth abstraction.

**In Scope:** Auth strategy interface (Cloudflare Access JWT primary; pluggable IdP), user record on first auth, user profile display (name, email, avatar), admin role, admin user list (paginated, sortable, searchable), promote/demote/delete actions, audit log of admin actions, session timeout handling, CSRF protection on all mutating endpoints.

**Out of Scope:** Teams / orgs; per-diagram sharing with named users; SAML (beyond Cloudflare Access).

---

#### F2 Jobs to be Done

- **F2-J1 (Tomas):** When someone joins my team, I want them to log in via our existing identity provider, so I don't manage another set of credentials.
- **F2-J2 (Tomas):** When someone leaves, I want to revoke their access, so we maintain continuity.

---

#### F2 User Stories

- **F2-US1** As Tomas, I want all protected routes to require Cloudflare Access authentication and return 401 for unauthenticated requests, so that only authorised users can access the app.

- **F2-US2** As Tomas, I want the first admin seeded by a `SEED_ADMIN_EMAIL` environment variable, so that I control who gets elevated access.

- **F2-US3** As Tomas, I want a paginated, sortable, searchable list of users at `/admin`, so that I can manage the user base.

- **F2-US4** As Tomas, I want to promote, demote, or delete a user, so that I can manage access as the team changes.
  - *AC:* Tomas cannot demote or delete his own account.

- **F2-US5** As Tomas, I want to see each user's diagram count and share count in the admin list, so that I can assess usage before deleting an account.

- **F2-US6** As Sasha, I want to see my profile (name, email, avatar) in the editor and dashboard, so that I know I'm logged in with the right account.

- **F2-US7** As a developer, I want local development to bypass auth automatically when `DEV_MODE` is set in `.dev.vars`, so that I can work without a Cloudflare Access setup.
  - *AC:* `DEV_MODE` is never committed in `wrangler.jsonc`; production fails closed if `CF_ACCESS_TEAM_DOMAIN` is unset.

- **F2-US8** As ops, I want all mutating endpoints to require an Origin check or CSRF token, so that cross-site forgery is prevented even with a valid Access JWT.

- **F2-US9** As Tomas, I want an audit log that records actor, target, action, and timestamp for every admin mutation, so that I can review the history of access changes.

#### F2 Notes

We can use <https://github.com/adrianhall/cloudflare-auth> library to handle Cloudflare Access for user ID/email injection and to handle developer auth when `npm start` is run.

The developer can specify the ID of the IdP to be used from a pre-configured IdP list by specifying it in the `.env` file.

---

### F3 — Cloudflare Service Catalog

**Goal:** A maintainable, extensible registry of Cloudflare services and edge types.

**In Scope:** Service registry (id, label, category, icon, description, wrangler binding type, scaffold template id, doc links), category metadata (label and colour), edge type registry, runtime loading with bundled fallback, alias map for renamed services.

**Out of Scope:** Editing the catalog from within the app UI (separate admin tooling).

---

#### F3 Jobs to be Done

- **F3-J1 (Sasha):** When I forget what a service does, I want one click from the canvas to the official Cloudflare docs, so I don't break my flow.
- **F3-J2 (Bea):** When a new Cloudflare product ships, I want to add it to the service catalog palette, so users can discover it without waiting for an app release.

---

#### F3 User Stories

- **F3-US1** As Sasha, I want each service rendered with the correct icon, category colour, and connection handles, so that my diagrams are immediately recognisable.

- **F3-US2** As Bea, I want to add a new service to the catalog without editing application source code, so that I can ship catalog updates without a developer.
  - *AC:* New service appears in the palette and is valid in blueprints after a catalog data update (no rebuild needed).

- **F3-US3** As Bea, I want to rename a service while keeping existing diagrams renderable, so that renaming doesn't break saved diagrams.
  - *AC:* Alias map resolves old type ID → new type ID; both render identically on canvas.

- **F3-US4** As Sasha, I want to click a Documentation link in the properties panel, so that I can read the official Cloudflare docs without leaving my flow.
  - *AC:* Opens in a new tab; links provided per node type in the catalog.

- **F3-US5** As Sasha, I want new Cloudflare products to appear in the palette within hours of launch, so that my diagrams are always current.
  - *AC:* Catalog data can be updated independently of application code.

#### F3 Notes

It's ok to require a new deployment to get new products.  However, it must be "easy" to do as part of regular maintenance.

The set of data comprising a cloudflare service:

- Type ID
- Official Name
- Shortened Name
- Icon
- Documentation Link
- Other Links
  - Type of link (e.g. video, audio, document, example)
  - Link text
  - Link href

---

### F4 — Architecture Canvas

**Goal:** A fast, accessible visual editor for graph-based architecture diagrams.

**In Scope:** Canvas surface, drag-and-drop from palette, selection, multi-select, connection handles, keyboard shortcuts, undo/redo (≥50 steps), properties panel, ELK auto-layout, minimap, snap-to-grid, dark/light mode, print mode.

**Out of Scope:** Real-time collaboration; freehand drawing; multi-page diagrams.

---

#### F4 Jobs to be Done

- **F4-J1 (Sasha):** When I'm sketching a new architecture, I want to drop Cloudflare services onto a canvas and connect them, so I can think visually instead of in Wrangler config.
- **F4-J2 (Sasha):** When my diagram gets messy, I want one button to auto-layout it cleanly, so I can keep designing instead of fiddling.
- **F4-J3 (Sasha/Priya):** When I make a mistake, I want undo/redo, so I can experiment without fear.

---

#### F4 User Stories

- **F4-US1** As Sasha, I want to drag a service from a categorised palette onto the canvas, so that I can build a diagram visually.
  - *AC:* Node dropped at cursor position; receives catalog default label; immediately selectable.

- **F4-US2** As Sasha, I want to search the palette by service name or type ID, so that I can find the service I need quickly.
  - *AC:* Case-insensitive substring match; categories with zero matches hidden.

- **F4-US3** As Sasha, I want to collapse/expand palette categories, so that I can reduce visual noise.
  - *AC:* State persists in user preferences; search overrides collapsed state (all matching items shown).

- **F4-US4** As Sasha, I want to connect two nodes by dragging from a handle, so that I can model data flows and bindings.
  - *AC:* Default edge type is `data-flow`; connection must start from a handle; no self-loops.

- **F4-US5** As Sasha, I want to select a node and edit its label, description, and accent colour, so that I can annotate my design.
  - *AC:* Label 1–80 chars; description ≤500 chars; accent colour resets to category default on clear.

- **F4-US6** As Sasha, I want to select an edge and change its type, label, protocol, and description, so that I can express the nature of the connection.
  - *AC:* Edge type selector shows all 4 types with visual indicator; label ≤80 chars.

- **F4-US7** As Sasha, I want to delete the selected nodes/edges with `Delete` or `Backspace`, so that I can remove mistakes.
  - *AC:* Shortcut never triggers while focus is in a text input or textarea.

- **F4-US8** As Sasha, I want to undo and redo at least 50 steps with `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`, so that I can experiment freely.
  - *AC:* Undo/redo covers structural changes and data-only edits; redo stack clears on new action.

- **F4-US9** As Sasha, I want to auto-layout the diagram top-to-bottom or left-to-right, so that I can tidy a messy canvas in one click.
  - *AC:* Layout runs off the main thread; UI remains responsive during layout; edges re-routed to matching handles; two directions selectable.

- **F4-US10** As Sasha, I want to see live save status (saving / saved Xs ago / unsaved / error), so that I know whether my changes are safe.
  - *AC:* Debounce 500 ms; "unsaved changes" browser warning shown on unload when dirty.

- **F4-US11** As Sasha, I want to see node and edge counts in the status bar, so that I can gauge diagram size at a glance.

- **F4-US12** As Sasha, I want to zoom in/out/fit-to-view and pan the canvas, so that I can navigate large diagrams.
  - *AC:* Keyboard shortcuts: `+`, `-`, `Ctrl+Shift+F` (fit view); also available via toolbar buttons.

- **F4-US13** As Sasha, I want to toggle dark/light theme and have it persist, so that I can use the app in any environment.
  - *AC:* No flash of incorrect theme on reload; respects `prefers-color-scheme` as default.  Store theme with user data in backend (and potentially local storage)

- **F4-US14** As any user, I want the editor to be operable with keyboard only, so that it is accessible regardless of input device.
  - *AC:* All interactive controls have visible focus and accessible names; passes axe-core with zero serious/critical violations.

---

### F5 — Diagram Lifecycle Management

**Goal:** Users can find, create, duplicate, rename, and delete their own diagrams.

**In Scope:** Dashboard with card grid, sort/filter/search, create-blank, create-from-blueprint, duplicate, delete with confirmation modal, inline rename, list pagination.

**Out of Scope:** Folders or tags; cross-user transfer.

---

#### F5 Jobs to be Done

- **F5-J1 (Sasha):** When I'm jumping between several diagrams, I want a dashboard with previews, so I can find the right one at a glance.

---

#### F5 User Stories

- **F5-US1** As Sasha, I want a dashboard showing all my diagrams with a thumbnail, title, and last-updated timestamp, sorted by recency, so that I can find the right diagram quickly.

- **F5-US2** As Sasha, I want to create a new blank diagram from the dashboard, so that I can start designing immediately.

- **F5-US3** As Sasha, I want to duplicate any diagram with one click, so that I can fork a design without starting over.
  - *AC:* Duplicate has title `<original> (Copy)`; browser navigates to the new diagram.

- **F5-US4** As Sasha, I want to delete a diagram with a confirmation modal that shows the title, so that I don't accidentally destroy work.
  - *AC:* Deletion cascades share links server-side.

- **F5-US5** As Sasha, I want to rename a diagram inline from the editor, so that I can keep titles meaningful as the design evolves.
  - *AC:* Change saved on a 1 s debounce.

- **F5-US6** As Priya, I want to search my diagrams by title, so that I can find the right one among many.

- **F5-US7** As Priya, I want the dashboard paginated, so that it remains fast with 100+ diagrams.

---

### F6 — Blueprints & Templates

**Goal:** Curated starting points users can preview, filter, and clone into a new diagram.

**In Scope:** Blueprint store (data-driven, not code), gallery with category filter and search, read-only mini-canvas preview, create-from-blueprint flow with title/description, admin authoring and publish UI, blueprint validation against the live diagram schema.

**Out of Scope:** User-submitted public blueprints; ratings or voting.

---

#### F6 Jobs to be Done

- **F6-J1 (Priya):** When I'm prepping a customer call, I want to start from a relevant blueprint, so I can spend the meeting tailoring instead of explaining primitives.
- **F6-J2 (Bea):** When a new Cloudflare product ships, I want to add an example blueprint for it, so reference architectures stay current without an app release.

---

#### F6 User Stories

- **F6-US1** As Sasha, I want to browse a blueprint gallery with a category filter including an "All" tab, so that I can quickly find a relevant starting point.

- **F6-US2** As Sasha, I want to see a non-interactive preview of each blueprint before using it, so that I can choose the right one.

- **F6-US3** As Sasha, I want to create a new diagram from a blueprint with a custom title and description, so that I can start tailored instead of blank.
  - *AC:* New diagram opens immediately in the editor; blueprint graph is the starting state.

- **F6-US4** As Bea, I want to publish a new blueprint via an admin UI, so that I can add reference architectures without a code deploy.
  - *AC:* Blueprint data validated against the diagram schema at publish time; invalid data rejected with a descriptive error.

- **F6-US5** As Bea, I want to preview a blueprint in the admin UI before publishing, so that I can verify it renders correctly.

---

### F7 — Sharing & Read-Only View

**Goal:** Public, link-based read-only sharing of any diagram.

**In Scope:** Token generation (≥128-bit entropy), optional expiry (1 h / 1 d / 1 w / custom / none), revoke, KV-cached lookup for edge performance, read-only viewer, share banner, "Save a copy" CTA for authenticated visitors.

**Out of Scope:** Per-recipient ACLs; comment threads; embed iframe.

---

#### F7 Jobs to be Done

- **F7-J1 (Sasha):** When I finish a diagram, I want to send a read-only link to anyone, so they can review it without an account.
- **F7-J2 (Priya):** When I share a link with a customer, I want it to expire automatically, so old designs don't leak.
- **F7-J3 (Carlos):** When I receive a shared diagram, I want to copy it into my own account, so I can iterate on it.

---

#### F7 User Stories

- **F7-US1** As Sasha, I want to create a share link for the current diagram and copy it to clipboard with one click, so that I can share my design with a reviewer instantly.

- **F7-US2** As Sasha, I want to set an optional expiry when creating a share link (1 hour / 1 day / 1 week / custom / no expiry), so that old links expire automatically.

- **F7-US3** As Sasha, I want to revoke a share link at any time, so that I can retract access if the diagram changes.

- **F7-US4** As Carlos, I want to open a shared link without logging in and view the diagram with pan/zoom/print only, so that I can review architectures without an account.

- **F7-US5** As Carlos (when logged in), I want to click "Save a copy to my account" on a shared diagram, so that I can iterate on it myself.
  - *AC:* Creates a new owned diagram with the share's graph data; navigates to the new diagram in the editor.

- **F7-US6** As Sasha, I want the share button to return the existing unexpired link rather than generating a new one, so that I don't accumulate stale tokens.

- **F7-US7** As ops, I want share tokens to be at least 128 bits of entropy, so that they cannot be guessed by enumeration.

---

### F8 — Diagram Export & Print

**Goal:** Export diagrams for use outside the app.

**In Scope:** PNG (raster, padded, minimum 400×400), SVG (vector), JSON (blueprint-compatible raw format), print-friendly view with auto-detected landscape/portrait orientation and forced light theme.

**Out of Scope:** Server-side PDF; transparent PNG background (future toggle).

---

#### F8 Jobs to be Done

- **F8-J1 (Carlos):** When I review a shared diagram, I want to print it to PDF, so I can annotate it offline.
- **F8-J2 (Sasha):** When I want to embed a diagram in a doc or slide, I want to export it as PNG/SVG, so it survives without my app.

---

#### F8 User Stories

- **F8-US1** As Sasha, I want to export the diagram as a PNG with padding and a minimum size of 400×400, so that it looks good when embedded in docs.

- **F8-US2** As Sasha, I want to export as SVG for vector-quality embedding.

- **F8-US3** As Sasha, I want to export the raw diagram JSON in blueprint format, so that I can import it later or archive it.

- **F8-US4** As Sasha or Carlos, I want to print the diagram with auto-detected landscape/portrait and light theme, so that it renders well on paper or as PDF.

- **F8-US5** As a developer, I want a `</>` JSON-modal button in the status bar, so that I can inspect and copy the diagram's raw JSON during blueprint authoring.

---

### F9 — Project Scaffold Export

**Goal:** Turn a diagram into a ready-to-run Cloudflare Workers project ZIP.

**In Scope:** `wrangler.jsonc` generation (all supported binding types), `package.json` per template, `tsconfig.json`, framework source files (vanilla / Hono / Astro, pluggable), Drizzle config + D1 migration stub when D1 is present, conditional README, client-side ZIP assembly.

**Out of Scope:** Pushing the project to a Git host; running `wrangler deploy` from the browser.

---

#### F9 Jobs to be Done

- **F9-J1 (Sasha):** When my diagram is approved, I want to download a ready-to-run Wrangler project, so I can skip the boilerplate and ship the first deploy.
- **F9-J2 (Sasha):** When I export a scaffold, I want correct bindings reflecting my diagram, so I don't have to hand-edit `wrangler.jsonc`.

---

#### F9 User Stories

- **F9-US1** As Sasha, I want to export the current diagram as a ZIP containing `wrangler.jsonc`, `package.json`, `tsconfig.json`, source files, and `README.md`, so that I can start coding immediately.

- **F9-US2** As Sasha, I want to choose a base framework template (vanilla / Hono / Astro; extensible), so that the scaffold matches my preferred runtime.

- **F9-US3** As Sasha, I want all bindings reflected accurately in `wrangler.jsonc` with sane resource names derived from node labels, so that I don't have to hand-edit the config.
  - *AC:* Covers D1, KV, R2, Queues, Vectorize, AI, Browser, Containers, mTLS, Hyperdrive, Email, Workers VPC, Pipelines, Artifacts, Dynamic Workers.

- **F9-US4** As Sasha, I want a Drizzle config and D1 migration stub included when D1 is on the canvas, so that I have a complete ORM setup from day one.

- **F9-US5** As Sasha, I want the README to show D1-specific setup instructions only when D1 is in the diagram, so that the scaffold is relevant and uncluttered.

- **F9-US6** As Sasha, I want the export button disabled (with an explanation) when no Cloudflare-bound services are on the canvas, so that I don't download an empty scaffold.

- **F9-US7** As ops, I want every blueprint's exported scaffold to pass `wrangler deploy --dry-run` in CI, so that scaffold quality is continuously verified.

---

### F10 — MCP Server *(post-MVP)*

**Goal:** Expose CF-Architect to AI agents via Model Context Protocol so an LLM can read the catalog and blueprints and create or mutate diagrams on a user's behalf.

**In Scope:** MCP endpoint at a documented URL; tools: `list_services`, `list_blueprints`, `get_diagram`, `create_diagram`, `add_node`, `remove_node`, `connect_nodes`, `update_node_data`, `apply_blueprint`, `validate_architecture`, `export_scaffold`. All mutations flow through the same API and data layer as the UI.

**Out of Scope:** Fully autonomous generation without a user in the loop; persistent agent monitoring without invocation.

---

#### F10 Jobs to be Done

- **F10-J1 (Aria):** When a user asks "design a serverless RAG app on Cloudflare", I want to create the diagram via tools, so the user gets a starting canvas in seconds.
- **F10-J2 (Aria):** When I need to read or modify a user's diagram programmatically, I want stable typed tools over a documented endpoint, so I can integrate without reading source code.

---

#### F10 User Stories

- **F10-US1** As Aria, I want to discover the MCP endpoint at a documented URL and list available tools, so that I can integrate without reading source code.

- **F10-US2** As Aria, I want to read the catalog, blueprint list, and a specific diagram via MCP tools, so that I can understand the user's current context.

- **F10-US3** As Aria, I want to create a diagram, add/remove nodes, and connect/disconnect edges via MCP tools, so that I can build diagrams on behalf of users.
  - *AC:* Every call validated against the same schema as the UI; all mutations flow through the same data layer.

- **F10-US4** As Aria, I want to call a validation tool and receive a structured architecture critique, so that I can advise users on improvements.

---

### F11 — In-App AI Architect Chat *(post-MVP)*

**Goal:** Let users converse with an AI collaborator inside the editor that can read the open diagram, propose changes, run a best-practices critique, and apply changes only with explicit user consent.

**In Scope:** AI chat panel in the editor, diagram-read context, propose-and-preview change flow, explicit apply/reject step, architectural critique against Cloudflare best practices, per-user toggle, per-deployment env flag disable, AI Gateway routing for all LLM calls.

**Out of Scope:** Fully autonomous diagram modification without user confirmation; persistent background monitoring.

---

#### F11 Jobs to be Done

- **F11-J1 (Sasha):** When I have a diagram open, I want to chat with an AI that can read my canvas, propose changes, and apply them only when I confirm, so I can iterate with AI assistance without losing control.
- **F11-J2 (Sasha):** When I'm not sure if my architecture is sound, I want an AI critique against Cloudflare best practices, so I catch design issues early.

---

#### F11 User Stories

- **F11-US1** As Sasha, I want to open an AI chat panel in the editor and ask for diagram changes, see them previewed, and then apply or reject them, so that I can collaborate with an AI assistant.

- **F11-US2** As Sasha, I want to turn the AI chat panel off in my preferences, so that it doesn't get in my way.

- **F11-US3** As Tomas, I want to disable the AI feature at the deployment level via an env flag, so that I can comply with data policies that prohibit external LLM calls.

- **F11-US4** As ops, I want all AI calls routed through Cloudflare AI Gateway with logging and caching enabled, so that I have cost, latency, and abuse visibility.

- **F11-US5** As Sasha, I want AI mutations to require my explicit confirmation before being applied, so that AI never silently changes my diagram.

---

## 4. Design Notes

Visual and interaction design principles for v2.

### Canvas

The diagram editor is a canvas-first, graph-based experience. Users drag nodes and draw connections; there is no list or table view of the architecture. The canvas supports a minimap for navigation in large diagrams and snap-to-grid to keep layouts tidy.

The UI must remain interactive at all times. Auto-layout computation runs off the main thread so the canvas never freezes or shows a blocking spinner during layout.

### Iconography

Each Cloudflare service is rendered with its official Cloudflare icon where one is available. The full icon set is documented — source, license, size, and viewport — and served through a single icon component or sprite sheet. Inline SVG per component is not used; the icon set must not drift across the app.

Every icon button carries an accessible name; no button communicates solely through an icon or emoji.

### Palette

The service palette groups nodes by category, with each category rendered in its assigned colour. The palette is searchable by service name. Categories can be individually collapsed; collapsed state persists in the user's preferences. A search query overrides collapsed state and shows all matching services regardless of category.

### Theming

The app ships with light and dark themes. The default theme respects the system `prefers-color-scheme` preference. The user can override the theme with a manual toggle; the preference is stored server-side so it roams across devices. There is no flash of incorrect theme on page load.

A high-contrast theme variant is also provided.

### Print View

The print view forces the light theme regardless of the user's preference. Orientation (landscape or portrait) is auto-detected from the diagram's bounding box and applied to the print layout. The diagram fits to a single page where possible.

### Status Feedback

The editor displays live save status at all times (saving / saved N seconds ago / unsaved / error). Node and edge counts appear in the status bar. The browser shows an "unsaved changes" warning on page unload when there are pending changes.

### Properties Panel

Selecting a node opens a properties panel showing: label (editable), description (editable), accent colour picker (resets to category default on clear), and a documentation link that opens the service's official Cloudflare docs in a new tab.

Selecting an edge shows: edge type (with visual indicator for each of the 4 types), label, protocol, and description.

### Destructive Action Modals

Any destructive action (diagram delete, user delete) requires confirmation via a modal that displays the target's name. Affected list views update optimistically on confirmation.

### Concurrency and Session

When two sessions modify the same diagram simultaneously, the session that saves second is shown a "another session saved changes — reload?" modal rather than silently overwriting or failing. This prevents silent data loss.

When the auth session is approaching expiry, a banner appears approximately 30 minutes before expiry. The user can re-authenticate from the banner without losing unsaved work.

### Empty States

Every list view (dashboard, blueprint gallery, admin user list) includes an empty state that guides the user to a relevant action. An empty dashboard, for example, directs users to the blueprint gallery.

### Read-Only Viewer

The share link read-only viewer uses the same visual renderer as the editor. Editing controls are hidden; pan, zoom, and print are available. A share banner is displayed at the top identifying the diagram owner and share status.

### Accessibility

Accessibility is a first-class requirement, not a post-launch concern:

- The full editor is operable with keyboard only.
- All interactive controls have a visible focus indicator.
- All icon buttons carry accessible names.
- `prefers-reduced-motion` disables edge animations and auto-layout transition effects.
- Screen-reader landmark regions are present on every page.
- The app passes axe-core with zero serious or critical violations on every page.

### AI Consent

AI-driven diagram changes are always shown to the user before being applied. The user explicitly applies or rejects each proposed change; AI never silently mutates a diagram.

The AI chat panel is toggleable per user in their preferences. It can also be disabled at the deployment level via an environment variable, allowing deployments to comply with data policies that restrict external LLM calls.

### Internationalisation

All user-facing strings are externalised into a single bundle in ICU message format. The app ships in English only at launch; the string bundle structure enables translation without UI refactoring. Component layouts must tolerate typical translation length variance.
