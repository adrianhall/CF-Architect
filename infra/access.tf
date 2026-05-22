# ---------------------------------------------------------------------------
# Cloudflare Access — application + allow policy
#
# Protects the CF-Architect Worker so that only authenticated users whose
# email matches ALLOWED_EMAIL_DOMAIN can access it. The `aud` attribute
# (audience tag) is read from the Terraform output and injected into
# wrangler.jsonc so the Worker middleware can validate JWTs.
#
# Pre-requisites:
#   - WORKER_DOMAIN set in .env (e.g. cf-architect-production.<sub>.workers.dev)
#   - ALLOWED_EMAIL_DOMAIN set in .env (e.g. example.com)
#
# Two-step first provisioning:
#   1. Run `npm run provision` without WORKER_DOMAIN to create the Worker
#      and note its workers.dev URL from the Cloudflare dashboard.
#   2. Set WORKER_DOMAIN in .env and re-run `npm run provision`.
#      Terraform will create the Access application on the second run.
# ---------------------------------------------------------------------------

resource "cloudflare_zero_trust_access_application" "app" {
  account_id = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  name       = "CF-Architect (${var.environment})"
  type       = "self_hosted"

  # Protect the Worker domain.
  # For workers.dev deployments set WORKER_DOMAIN to:
  #   <worker-name>.<account-workers-subdomain>.workers.dev
  # For custom domains set it to the domain or path (wildcards supported).
  destinations = [
    {
      type = "public"
      uri  = data.dotenv.env.env["WORKER_DOMAIN"]
    }
  ]

  # JWT session length — must be long enough for a working day.
  session_duration = "24h"

  # Set HttpOnly=true on the CF_Authorization cookie.
  http_only_cookie_attribute = true

  # Skip the Cloudflare Access interstitial when the user is already
  # authenticated via their IdP for a smoother sign-in experience.
  skip_interstitial = true

  # ---------------------------------------------------------------------------
  # Inline allow policy — users whose email is @<ALLOWED_EMAIL_DOMAIN>
  # ---------------------------------------------------------------------------
  policies = [
    {
      name       = "Allow @${data.dotenv.env.env["ALLOWED_EMAIL_DOMAIN"]} users"
      precedence = 1
      decision   = "allow"

      include = [
        {
          email_domain = {
            domain = data.dotenv.env.env["ALLOWED_EMAIL_DOMAIN"]
          }
        }
      ]
    }
  ]
}
