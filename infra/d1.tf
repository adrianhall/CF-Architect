resource "cloudflare_d1_database" "main" {
  account_id = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  name       = "cf-arch-${var.environment}"
}
