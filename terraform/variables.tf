variable "cloudflare_api_token" {
  description = "Cloudflare API token with D1, KV, and Access permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cf_workers_domain" {
  description = "Cloudflare Workers subdomain (e.g. photoadrian.workers.dev)"
  type        = string
}

variable "cf_access_team_domain" {
  description = "Cloudflare Zero Trust team name (e.g. photoadrian, not the full domain)"
  type        = string
}

variable "github_client_id" {
  description = "GitHub OAuth App client ID"
  type        = string
}

variable "github_client_secret" {
  description = "GitHub OAuth App client secret"
  type        = string
  sensitive   = true
}
