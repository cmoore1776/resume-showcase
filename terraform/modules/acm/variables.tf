variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name for the certificate"
  type        = string
}

variable "subject_alternative_names" {
  description = "Additional domain names for the certificate (e.g., wildcards)"
  type        = list(string)
  default     = []
}

variable "validate_certificate" {
  description = "Whether to wait for certificate validation (requires Route53 or manual DNS setup)"
  type        = bool
  default     = false
}
