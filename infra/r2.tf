resource "cloudflare_r2_bucket" "assets" {
  account_id = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  name       = "cf-arch-assets-${var.environment}"
  location   = "WNAM"
}
