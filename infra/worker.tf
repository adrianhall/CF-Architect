# ---------------------------------------------------------------------------
# Worker definition resource.
#
# `cloudflare_worker` registers the named Worker in the Cloudflare account.
# Unlike `cloudflare_workers_script`, this resource represents the worker
# entity itself (not just its script content), so `terraform destroy` will
# fully remove the Worker from the account.
#
# wrangler manages the actual script content and all binding configurations
# on every `npm run deploy`. The name here must match the `name` field in
# wrangler.template.jsonc so that wrangler targets the same Worker.
# ---------------------------------------------------------------------------
resource "cloudflare_worker" "app" {
  account_id = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  name       = "cf-architect-${var.environment}"
  logpush    = false

  observability = {
    enabled = true
  }
}
