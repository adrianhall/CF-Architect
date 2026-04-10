terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.2"
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

locals {
  # The worker is deployed as cf-architect.<workers-domain>
  worker_hostname = "cf-architect.${var.cf_workers_domain}"
}

# --- D1 Database ---
resource "cloudflare_d1_database" "main" {
  account_id = var.cloudflare_account_id
  name       = "cf-architect-db"
}

# --- KV Namespaces ---
resource "cloudflare_workers_kv_namespace" "kv" {
  account_id = var.cloudflare_account_id
  title      = "cf-architect-kv"
}

resource "cloudflare_workers_kv_namespace" "session" {
  account_id = var.cloudflare_account_id
  title      = "cf-architect-session"
}

# --- GitHub Identity Provider ---
resource "cloudflare_zero_trust_access_identity_provider" "github" {
  account_id = var.cloudflare_account_id
  name       = "GitHub"
  type       = "github"
  config = {
    client_id     = var.github_client_id
    client_secret = var.github_client_secret
  }
}

# --- Reusable Access Policy: allow users authenticated via GitHub ---
# The login_method rule asserts that the user must have authenticated through
# the GitHub IdP specifically. This is defence in depth alongside the
# allowed_idps restriction on the application — the policy independently
# verifies the authentication method rather than relying solely on the login UI.
# The first user to log in is automatically promoted to admin by the application.
resource "cloudflare_zero_trust_access_policy" "allow_authenticated" {
  account_id = var.cloudflare_account_id
  name       = "Allow GitHub authenticated users"
  decision   = "allow"
  include = [{
    login_method = {
      id = cloudflare_zero_trust_access_identity_provider.github.id
    }
  }]
}

# --- Access Application ---
# Protects all authenticated routes. Public routes (/, /s/*, /blueprints,
# static assets) are not listed here and remain accessible without login.
resource "cloudflare_zero_trust_access_application" "cf_architect" {
  account_id = var.cloudflare_account_id
  name       = "CF Architect"
  type       = "self_hosted"

  # Primary domain shown in the App Launcher
  domain = "${local.worker_hostname}/dashboard"

  # All protected paths — must stay in sync with PROTECTED_PATTERNS in src/middleware.ts
  destinations = [
    { type = "public", uri = "${local.worker_hostname}/dashboard" },
    { type = "public", uri = "${local.worker_hostname}/diagram/*" },
    { type = "public", uri = "${local.worker_hostname}/api/v1/*" },
    { type = "public", uri = "${local.worker_hostname}/admin" },
  ]

  # Restrict login to GitHub only
  allowed_idps = [cloudflare_zero_trust_access_identity_provider.github.id]

  # Skip the IdP selection screen since there is only one IdP
  auto_redirect_to_identity = true

  session_duration = "24h"

  policies = [{
    id         = cloudflare_zero_trust_access_policy.allow_authenticated.id
    precedence = 1
  }]
}
