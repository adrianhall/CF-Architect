resource "cloudflare_workers_kv_namespace" "shares" {
  account_id = local.account_id
  title      = "cf-arch-shares-${var.environment}"
}

resource "cloudflare_workers_kv_namespace" "catalog" {
  account_id = local.account_id
  title      = "cf-arch-catalog-${var.environment}"
}
