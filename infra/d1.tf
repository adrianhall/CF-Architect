resource "cloudflare_d1_database" "main" {
  account_id = data.dotenv.env.env["CLOUDFLARE_ACCOUNT_ID"]
  name       = "cf-arch-${var.environment}"

  # Explicitly disable read replication.
  # Without this block the provider omits the field on the first apply, then
  # detects a drift on subsequent runs and tries to update the resource,
  # causing spurious plan changes or errors on the second provisioning run.
  read_replication = {
    mode = "disabled"
  }
}
