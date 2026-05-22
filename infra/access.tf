# ---------------------------------------------------------------------------
# Cloudflare Access — application + allow policy
#
# Protects the CF-Architect Worker so that only authenticated users whose
# email matches ALLOWED_EMAIL_DOMAIN AND who authenticated via the
# configured IdP (CLOUDFLARE_ACCESS_IDP_ID) can access it.
#
# The `aud` attribute (audience tag) is captured as a Terraform output and
# injected into wrangler.jsonc so the Worker middleware can validate JWTs.
#
# Pre-requisites (all set in .env before running `npm run provision`):
#   - WORKER_DOMAIN          — workers.dev or custom domain to protect
#   - ALLOWED_EMAIL_DOMAIN   — org email domain (e.g. example.com)
#   - CLOUDFLARE_ACCESS_IDP_ID — ID of the configured IdP in Zero Trust
# ---------------------------------------------------------------------------

resource "cloudflare_zero_trust_access_application" "app" {
  account_id = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  name       = "CF-Architect (${var.environment})"
  type       = "self_hosted"

  # Restrict authentication to the single configured IdP.
  # Prevents users from choosing an alternative IdP at login.
  allowed_idps = [data.dotenv.env.env["CLOUDFLARE_ACCESS_IDP_ID"]]

  # Protect the Worker domain.
  # For workers.dev: <worker-name>.<account-workers-subdomain>.workers.dev
  # For custom domains: the full domain or path (wildcards supported).
  destinations = [
    {
      type = "public"
      uri  = data.dotenv.env.env["WORKER_DOMAIN"]
    }
  ]

  # JWT session length — long enough for a working day.
  session_duration = "24h"

  # Set HttpOnly=true on the CF_Authorization cookie.
  http_only_cookie_attribute = true

  # Skip the Cloudflare Access interstitial when the user is already
  # authenticated via their IdP for a smoother sign-in experience.
  skip_interstitial = true

  # ---------------------------------------------------------------------------
  # Inline allow policy
  # Users must satisfy BOTH conditions (Cloudflare Access AND semantics):
  #   include — at least one must match  → email is @<ALLOWED_EMAIL_DOMAIN>
  #   require — all must match           → authenticated via the configured IdP
  #
  # `allowed_idps` above already restricts the IdP at the application level;
  # `require.login_method` adds defence-in-depth at the policy level.
  # ---------------------------------------------------------------------------
  policies = [
    {
      name       = "Allow @${data.dotenv.env.env["ALLOWED_EMAIL_DOMAIN"]} via IdP"
      precedence = 1
      decision   = "allow"

      include = [
        {
          email_domain = {
            domain = data.dotenv.env.env["ALLOWED_EMAIL_DOMAIN"]
          }
        }
      ]

      require = [
        {
          login_method = {
            id = data.dotenv.env.env["CLOUDFLARE_ACCESS_IDP_ID"]
          }
        }
      ]
    }
  ]
}
