# ---------------------------------------------------------------------------
# Centralised secret / config values
#
# All values are currently sourced from the dotenv provider reading ../.env.
# To switch to a different secrets back-end (e.g. Vault, AWS SSM, 1Password
# operator) update ONLY this file — every resource references local.* and
# will pick up the change automatically.
# ---------------------------------------------------------------------------
locals {
  # Cloudflare account credentials
  account_id = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  api_token  = data.dotenv.env.env["CLOUDFLARE_API_TOKEN"]

  # Cloudflare Access settings
  access_idp_id          = data.dotenv.env.env["CLOUDFLARE_ACCESS_IDP_ID"]
  worker_domain          = data.dotenv.env.env["WORKER_DOMAIN"]
  allowed_email_domain   = data.dotenv.env.env["ALLOWED_EMAIL_DOMAIN"]
  cloudflare_team_domain = data.dotenv.env.env["CLOUDFLARE_TEAM_DOMAIN"]
}
