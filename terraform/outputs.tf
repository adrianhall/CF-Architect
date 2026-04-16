output "d1_database_id" {
  value = cloudflare_d1_database.db.id
}

output "kv_namespace_id" {
  value = cloudflare_workers_kv_namespace.cache.id
}

output "access_app_aud" {
  value       = cloudflare_zero_trust_access_application.app.aud
  description = "AUD tag for JWT validation"
}
