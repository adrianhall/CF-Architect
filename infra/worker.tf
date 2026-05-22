# ---------------------------------------------------------------------------
# Worker script resource — placeholder.
# wrangler manages the actual script content and all binding configurations.
# Terraform only provisions the named Worker slot so that the Worker exists
# in the Cloudflare account before wrangler deploys code into it.
# ---------------------------------------------------------------------------
# NOTE: cloudflare/cloudflare v5 uses cloudflare_workers_script (not
# cloudflare_worker_script). The name here must match the `name` field in
# wrangler.template.jsonc so wrangler deploy targets the same Worker.
resource "cloudflare_workers_script" "app" {
  account_id  = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  script_name = "cf-architect-${var.environment}"
  # Placeholder module Worker content.
  # wrangler manages the real script body on every deploy.
  main_module = "placeholder.mjs"
  content     = "export default { async fetch() { return new Response('placeholder'); } };"
}
