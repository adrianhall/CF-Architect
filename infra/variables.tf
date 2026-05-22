variable "environment" {
  description = "Deployment environment (e.g. production, staging). Used to name all Cloudflare resources."
  type        = string
  default     = "production"
}
