#!/usr/bin/env node
/**
 * teardown.mjs — destroy all Terraform-managed Cloudflare resources
 *
 * Reads configuration from .env, regenerates terraform/terraform.tfvars,
 * and runs `terraform destroy` to remove the D1 database, KV namespaces,
 * and Zero Trust Access resources created by `npm run firstrun`.
 *
 * WARNING: This permanently deletes all data in the D1 database and KV
 * namespaces. There is no undo. Back up any important data first.
 *
 * Prerequisites: terraform >= 1.2 must be installed and in PATH.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const ENV_FILE = join(ROOT, ".env");
const TERRAFORM_DIR = join(ROOT, "terraform");
const TFVARS_FILE = join(TERRAFORM_DIR, "terraform.tfvars");
const TERRAFORM_INITIALIZED = join(TERRAFORM_DIR, ".terraform");

// ---------------------------------------------------------------------------
// 1. Check prerequisites
// ---------------------------------------------------------------------------

try {
  execSync("terraform version", { stdio: "pipe" });
} catch {
  console.error("Error: terraform is not installed or not in PATH.");
  console.error(
    "Install it from https://developer.hashicorp.com/terraform/install",
  );
  process.exit(1);
}

if (!existsSync(TERRAFORM_INITIALIZED)) {
  console.error(
    "Error: Terraform has not been initialised. Run `npm run firstrun` first.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Load .env
// ---------------------------------------------------------------------------

if (!existsSync(ENV_FILE)) {
  console.error("Error: .env file not found.");
  console.error("Copy .env.example to .env and fill in the required values.");
  process.exit(1);
}

for (const line of readFileSync(ENV_FILE, "utf-8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed
    .slice(eq + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
  process.env[key] ??= val;
}

// ---------------------------------------------------------------------------
// 3. Validate required variables
// ---------------------------------------------------------------------------

const REQUIRED = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CF_WORKERS_DOMAIN",
  "CF_ACCESS_TEAM_DOMAIN",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `Error: Missing required variables in .env: ${missing.join(", ")}`,
  );
  console.error("See .env.example for descriptions of each variable.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 4. Regenerate terraform/terraform.tfvars
// ---------------------------------------------------------------------------

const tfvars = [
  `cloudflare_api_token  = ${JSON.stringify(process.env.CLOUDFLARE_API_TOKEN)}`,
  `cloudflare_account_id = ${JSON.stringify(process.env.CLOUDFLARE_ACCOUNT_ID)}`,
  `cf_workers_domain     = ${JSON.stringify(process.env.CF_WORKERS_DOMAIN)}`,
  `cf_access_team_domain = ${JSON.stringify(process.env.CF_ACCESS_TEAM_DOMAIN)}`,
  `github_client_id      = ${JSON.stringify(process.env.GITHUB_CLIENT_ID)}`,
  `github_client_secret  = ${JSON.stringify(process.env.GITHUB_CLIENT_SECRET)}`,
].join("\n");

writeFileSync(TFVARS_FILE, tfvars + "\n", "utf-8");
console.log("Regenerated terraform/terraform.tfvars");

// ---------------------------------------------------------------------------
// 5. terraform destroy
// ---------------------------------------------------------------------------

console.log(
  "\nWARNING: This will permanently delete all Cloudflare resources managed by",
);
console.log(
  "Terraform (D1 database, KV namespaces, Zero Trust Access configuration).",
);
console.log("All data stored in these resources will be lost.\n");

console.log("Running terraform destroy...");
execSync("terraform destroy -auto-approve", {
  cwd: TERRAFORM_DIR,
  stdio: "inherit",
});

console.log("\nTeardown complete.");
console.log(
  "Remember to clear D1_DATABASE_ID, KV_NAMESPACE_ID, SESSION_NAMESPACE_ID,",
);
console.log("and CF_ACCESS_TEAM_DOMAIN from your .env file.");
