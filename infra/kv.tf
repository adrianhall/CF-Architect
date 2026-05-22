resource "cloudflare_workers_kv_namespace" "shares" {
  account_id = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  title      = "cf-arch-shares-${var.environment}"
}

resource "cloudflare_workers_kv_namespace" "catalog" {
  account_id = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  title      = "cf-arch-catalog-${var.environment}"
}
