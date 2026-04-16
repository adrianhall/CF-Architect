variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID"
}

variable "app_domain" {
  type        = string
  description = "Domain for the CF Architect application"
}

variable "github_client_id" {
  type        = string
  description = "GitHub OAuth App client ID"
}

variable "github_client_secret" {
  type        = string
  sensitive   = true
  description = "GitHub OAuth App client secret"
}
