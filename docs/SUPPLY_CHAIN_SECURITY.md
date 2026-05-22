# Supply-Chain Security

CF-Architect implements an eight-layer supply-chain defence. This document is the authoritative
reference for each layer: what is active today, what is suspended during active development
(Phases 01–11), and what is deferred to Phase 12 for full hardening.

For the security-hardening phase plan see [`docs/plan/phase-12.md`](./plan/phase-12.md).
For architectural decisions that affected this area see [`docs/DECISION_LOG.md`](./DECISION_LOG.md)
(especially D08).

---

## Active layers

### Layer 1 — Reproducible installs

**Status:** Partially active. Layer 1a is fully active. Layer 1b (`ignore-scripts=true`) is
suspended until Phase 12.

**Layer 1a (active):**

- `.npmrc` sets `engine-strict=true` — the install fails if the Node.js or npm version does not
  meet the `engines` field in `package.json`.
- `npm ci` is used in every automated context (CI, Husky pre-commit). `npm install` is never
  used in scripts.
- `lockfile-lint` runs in CI and fails if any `resolved` URL in `package-lock.json` is not
  `https://registry.npmjs.org/`. The single exception — the `@adrianhall/cloudflare-auth`
  GitHub SHA URL — must be explicitly allowlisted. Missing integrity hashes and `git+` URLs
  also fail.

**Layer 1b (suspended until Phase 12):**

- `.npmrc` `ignore-scripts=true` prevents all package lifecycle scripts (postinstall, prepare,
  etc.) from running during `npm ci`. This eliminates the class of attacks where a compromised
  package exfiltrates secrets via postinstall. Currently suspended to keep the dev loop
  frictionless. See [Phase 12 tasks](#phase-12-deferred-tasks) for the reinstatement plan.

---

### Layer 2 — Postinstall allowlist

**Status:** Active (auto-runs; will require an explicit step after Phase 12 reinstates Layer 1b).

`scripts/postinstall.mjs` maintains a hand-curated allowlist of packages permitted to run build
steps via `npm rebuild <pkg>`. The current allowlist contains only `esbuild` (required to select
the platform-specific binary).

Rules:

- Adding a package to the allowlist **requires a code-reviewed PR with written justification**.
- When `ignore-scripts=true` is reinstated in Phase 12, `npm run postinstall` must be called
  explicitly after `npm ci` in CI and documented in the quickstart.

---

### Layer 3 — Dependency update cooldown

**Status:** Active.

Renovate is configured (`.renovaterc.json`) with:

- `minimumReleaseAge: "14d"` — a version published today is invisible to Renovate for 14 days,
  giving time for typosquatting and supply-chain attacks to be detected and reported.
- Minor/patch updates grouped into a single weekly PR.
- Major updates get individual PRs with mandatory manual review.
- Dependabot security-advisory patches bypass the cooldown window and are expedited.

---

### Layer 4 — Automated scanning in CI

**Status:** Partially active. See [deferred section](#layer-4-osv-scanner) for OSV-Scanner.

Active CI gates (`.github/workflows/ci.yml`):

- `npm audit --audit-level=high` — fails the build on any high or critical CVE in the dependency
  tree. Source: GitHub Advisory Database (npm ecosystem).
- `npm audit signatures` — verifies that every installed package carries a valid sigstore
  signature. Rejects packages that have been tampered with after publication, even if no CVE has
  been filed yet.
- `lockfile-lint` — enforces registry-only resolution (see Layer 1a above).
- GitHub Dependabot security alerts — enabled on the repository; surfaces advisory-database
  vulnerabilities as GitHub issues without requiring a code push.

---

### Layer 5 — SHA-pinned GitHub-sourced dependency

**Status:** Active.

`@adrianhall/cloudflare-auth` is the only dependency installed directly from GitHub. It is pinned
to a specific commit SHA in `apps/worker/package.json`:

```json
"@adrianhall/cloudflare-auth": "github:adrianhall/cloudflare-auth#447daa60bc3a0c4b72a9c2aa7f2ab2ac06013139"
```

Rules:

- Wildcards (`main`, branch names, `latest`) are **never** used for any GitHub-sourced dependency.
- The SHA is bumped deliberately via a reviewed PR; it is never auto-updated by Renovate without
  a diff review.
- The `lockfile-lint` allowlist explicitly permits the one `github:` resolved URL for this package.

---

### Layer 6 — SBOM and provenance evidence

**Status:** Active (evidence recorded; formal SBOM generation deferred to Phase 12).

- `deploy.yml` records `sha256sum package-lock.json` at deploy time. Any post-incident review can
  answer "which exact lockfile was in effect for deploy X?".
- `npm sbom --sbom-format spdx` will be run on every release build and stored as a CI artefact
  once Phase 12 formalises the process.

---

### Layer 7 — Runtime hardening (Worker)

**Status:** Active (full CSP hardening deferred to Phase 12).

- **Strict Content Security Policy** (Phase 12 will add full header middleware): `default-src
'self'; script-src 'self'; connect-src 'self'` prevents a compromised bundled dependency from
  beaconing secrets to an external host.
- **No CDN-loaded JavaScript**: every third-party library goes through the Vite bundler. No
  `<script src="cdn.example.com/…">` tags are permitted.
- **Separate API tokens**: the `provision` Terraform token has broad permissions; the `deploy`
  token is scoped to `Workers Scripts:Edit` only. A build-time token leak cannot mutate
  infrastructure.

---

### Layer 8 — Developer hygiene

**Status:** Active (documented in README and onboarding guide).

- Run `npm ci` inside a devcontainer or a clean shell. Postinstall scripts run in the developer's
  environment; a clean shell limits the blast radius.
- Store `.env` secrets in a secrets manager (1Password, etc.) — never in dotfiles, shell history,
  or committed files. `.env` and `.dev.vars` are gitignored and must never be committed.

---

## Phase 12 deferred tasks

The following supply-chain items are explicitly deferred to
[Phase 12 — Security Hardening](./plan/phase-12.md). They are tracked there as open tasks.

### Layer 1b — `ignore-scripts=true` reinstatement

Re-institute `ignore-scripts=true` in `.npmrc`. This requires:

1. Auditing every package in the Layer 2 postinstall allowlist and documenting justification.
2. Updating `ci.yml` and `deploy.yml` to call `npm run postinstall` explicitly after `npm ci`.
3. Updating README quickstart documentation.
4. Verifying Husky v9 is a no-op in CI (`CI=true` is detected automatically).

### Layer 4 — OSV-Scanner

**Decision: D08 (accepted 2026-05-22) — see [`docs/DECISION_LOG.md`](./DECISION_LOG.md).**

OSV-Scanner was included in the original Phase 01 CI design as a second-opinion CVE scanner
cross-referencing the OSV.dev database against the GitHub Advisory Database used by `npm audit`.
The `ci.yml` step used `google/osv-scanner-action@v2`, but no such tag exists on the action
repository — the repo only publishes full semver tags (e.g. `v2.3.8`), and its root `action.yml`
is metadata-only. The scanner has therefore never actually executed in CI. The broken step was
removed in a Phase 01 follow-up (D08).

Phase 12 will decide:

- **Reinstate** using the correct reusable-workflow pattern
  (`google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@<pinned-version>`),
  grant the CI job `security-events: write`, and verify SARIF results land in
  GitHub Security → Code scanning.
- **Retire permanently** — document the residual-risk acceptance that an OSV-only CVE
  (one present in OSV.dev but not yet in the GitHub Advisory Database) could slip through
  between `npm audit` runs.

Until Phase 12 resolves this, `npm audit --audit-level=high` and `npm audit signatures` remain
the active CVE gates.

### Full Phase 12 security hardening

Phase 12 also covers OWASP Top 10 review, full security response headers (HSTS, CSP,
`X-Frame-Options`, etc.), rate-limiting full implementation, input-validation audit, error-handling
audit, and authentication hardening. See [`docs/plan/phase-12.md`](./plan/phase-12.md) for the
complete task list.
