resource "cloudflare_r2_bucket" "assets" {
  account_id = local.account_id
  name       = "cf-arch-assets-${var.environment}"
  location   = "WNAM"
}
