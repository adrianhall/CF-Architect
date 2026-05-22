terraform {
  required_version = ">= 1.9"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    dotenv = {
      source  = "jrhouston/dotenv"
      version = "~> 1.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

# ---------------------------------------------------------------------------
# Read .env from the repo root via the dotenv provider.
# All secrets (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, etc.) are stored
# in that file and never hard-coded here.
# ---------------------------------------------------------------------------
data "dotenv" "env" {
  filename = "../.env"
}

# ---------------------------------------------------------------------------
# Cloudflare provider — credentials sourced from .env
# ---------------------------------------------------------------------------
provider "cloudflare" {
  api_token = local.api_token
}
