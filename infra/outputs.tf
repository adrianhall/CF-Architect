# ---------------------------------------------------------------------------
# Terraform outputs consumed by scripts/render-wrangler.ts
#
# The local_file resource writes these as a JSON object to
# .terraform-outputs.json in the repo root. That file is gitignored.
# render-wrangler.ts reads it and substitutes ${TF_OUTPUT_*} tokens in
# wrangler.template.jsonc to produce the final wrangler.jsonc.
# ---------------------------------------------------------------------------

output "d1_database_id" {
  description = "D1 database UUID"
  value       = cloudflare_d1_database.main.id
}

output "d1_database_name" {
  description = "D1 database name"
  value       = cloudflare_d1_database.main.name
}

output "kv_shares_namespace_id" {
  description = "KV namespace ID for share-token cache"
  value       = cloudflare_workers_kv_namespace.shares.id
}

output "kv_catalog_namespace_id" {
  description = "KV namespace ID for catalog cache"
  value       = cloudflare_workers_kv_namespace.catalog.id
}

output "r2_bucket_name" {
  description = "R2 bucket name for diagram thumbnails"
  value       = cloudflare_r2_bucket.assets.name
}

output "worker_name" {
  description = "Cloudflare Worker script name"
  value       = cloudflare_workers_script.app.script_name
}

output "cloudflare_account_id" {
  description = "Cloudflare account ID (echoed for convenience)"
  value       = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  sensitive   = true
}

# ---------------------------------------------------------------------------
# Write outputs to a JSON file consumed by render-wrangler.ts
# ---------------------------------------------------------------------------
resource "local_file" "tf_outputs" {
  filename = "${path.module}/../.terraform-outputs.json"
  content = jsonencode({
    TF_OUTPUT_D1_DATABASE_ID       = cloudflare_d1_database.main.id
    TF_OUTPUT_D1_DATABASE_NAME     = cloudflare_d1_database.main.name
    TF_OUTPUT_KV_SHARES_ID         = cloudflare_workers_kv_namespace.shares.id
    TF_OUTPUT_KV_CATALOG_ID        = cloudflare_workers_kv_namespace.catalog.id
    TF_OUTPUT_R2_BUCKET_NAME       = cloudflare_r2_bucket.assets.name
    TF_OUTPUT_WORKER_NAME          = cloudflare_workers_script.app.script_name
    TF_OUTPUT_CLOUDFLARE_ACCOUNT_ID = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  })
  file_permission = "0600"
}
