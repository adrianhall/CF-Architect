output "d1_database_id" {
  description = "D1 database ID — written to D1_DATABASE_ID in .env by firstrun"
  value       = cloudflare_d1_database.main.id
}

output "kv_namespace_id" {
  description = "KV namespace ID — written to KV_NAMESPACE_ID in .env by firstrun"
  value       = cloudflare_workers_kv_namespace.kv.id
}

output "session_namespace_id" {
  description = "Session KV namespace ID — written to SESSION_NAMESPACE_ID in .env by firstrun"
  value       = cloudflare_workers_kv_namespace.session.id
}

output "cf_access_team_domain" {
  description = "Zero Trust team domain — written to CF_ACCESS_TEAM_DOMAIN in .env by firstrun"
  value       = var.cf_access_team_domain
}
