terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {
  # Uses CLOUDFLARE_API_TOKEN env var
}

# D1 Database
resource "cloudflare_d1_database" "db" {
  account_id = var.cloudflare_account_id
  name       = "cf-architect-db"
}

# KV Namespace
resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = var.cloudflare_account_id
  title      = "cf-architect-cache"
}

# Cloudflare Access Application
# Scoped to protected path prefixes only. Requests to / and /share/*
# are NOT covered by Access and pass directly to the Worker.
resource "cloudflare_zero_trust_access_application" "app" {
  account_id       = var.cloudflare_account_id
  name             = "CF Architect"
  type             = "self_hosted"
  session_duration = "24h"
  allowed_idps     = [cloudflare_zero_trust_access_identity_provider.github.id]

  self_hosted_domains = [
    "${var.app_domain}/canvas",
    "${var.app_domain}/admin",
    "${var.app_domain}/api",
  ]
}

# GitHub Identity Provider
resource "cloudflare_zero_trust_access_identity_provider" "github" {
  account_id = var.cloudflare_account_id
  name       = "GitHub"
  type       = "github"

  config {
    client_id     = var.github_client_id
    client_secret = var.github_client_secret
  }
}

# Access Policy - Allow all GitHub users (user management is in-app)
resource "cloudflare_zero_trust_access_policy" "allow_github" {
  account_id     = var.cloudflare_account_id
  application_id = cloudflare_zero_trust_access_application.app.id
  name           = "Allow GitHub Users"
  decision       = "allow"
  precedence     = 1

  include {
    login_method = [cloudflare_zero_trust_access_identity_provider.github.id]
  }
}
