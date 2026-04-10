#!/usr/bin/env node
/**
 * firstrun.mjs — first-time setup via Terraform
 *
 * Reads configuration from .env, generates terraform/terraform.tfvars,
 * runs `terraform init` (if needed) and `terraform apply`, then writes
 * the resulting resource IDs back into .env so that `npm run deploy`
 * works immediately afterwards.
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

// ---------------------------------------------------------------------------
// 2. Load .env (values won't overwrite already-set environment variables)
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
// 4. Generate terraform/terraform.tfvars
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
console.log("Generated terraform/terraform.tfvars");

// ---------------------------------------------------------------------------
// 5. terraform init (only if not already initialised)
// ---------------------------------------------------------------------------

if (!existsSync(TERRAFORM_INITIALIZED)) {
  console.log("\nRunning terraform init...");
  execSync("terraform init", { cwd: TERRAFORM_DIR, stdio: "inherit" });
} else {
  console.log("\nSkipping terraform init (already initialised).");
}

// ---------------------------------------------------------------------------
// 6. terraform apply
// ---------------------------------------------------------------------------

console.log("\nRunning terraform apply...");
execSync("terraform apply -auto-approve", {
  cwd: TERRAFORM_DIR,
  stdio: "inherit",
});

// ---------------------------------------------------------------------------
// 7. Read outputs and update .env
// ---------------------------------------------------------------------------

console.log("\nReading Terraform outputs...");
const outputsRaw = execSync("terraform output -json", {
  cwd: TERRAFORM_DIR,
  encoding: "utf-8",
});
const outputs = JSON.parse(outputsRaw);

/** @type {Record<string, string>} */
const updates = {
  D1_DATABASE_ID: outputs.d1_database_id?.value,
  KV_NAMESPACE_ID: outputs.kv_namespace_id?.value,
  SESSION_NAMESPACE_ID: outputs.session_namespace_id?.value,
  CF_ACCESS_TEAM_DOMAIN: outputs.cf_access_team_domain?.value,
};

const missingOutputs = Object.entries(updates)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingOutputs.length) {
  console.error(
    `Error: Missing Terraform outputs: ${missingOutputs.join(", ")}`,
  );
  console.error(
    "Check the terraform/outputs.tf file and re-run npm run firstrun.",
  );
  process.exit(1);
}

// Read the current .env content and upsert each key
let envContent = readFileSync(ENV_FILE, "utf-8");

for (const [key, value] of Object.entries(updates)) {
  const pattern = new RegExp(`^(#\\s*)?${key}=.*$`, "m");
  const replacement = `${key}=${value}`;
  if (pattern.test(envContent)) {
    // Replace existing line (including commented-out variants)
    envContent = envContent.replace(pattern, replacement);
  } else {
    // Append if not present at all
    envContent += `\n${replacement}\n`;
  }
}

writeFileSync(ENV_FILE, envContent, "utf-8");

console.log("\nUpdated .env with:");
for (const [key, value] of Object.entries(updates)) {
  console.log(`  ${key}=${value}`);
}

console.log(
  "\nFirst-run setup complete. You can now run `npm run deploy` to deploy CF-Architect.",
);
