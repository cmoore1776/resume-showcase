output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_security_group_id" {
  description = "Security group ID for EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = module.ecr.repository_url
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = module.alb.alb_zone_id
}

output "configure_kubectl" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions IAM role (add this to GitHub secrets as AWS_ROLE_ARN)"
  value       = module.github_oidc.role_arn
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider"
  value       = module.github_oidc.oidc_provider_arn
}

output "acm_certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = module.acm.certificate_arn
}

output "acm_validation_records" {
  description = "DNS records for ACM certificate validation - Add these to your DNS provider"
  value       = module.acm.validation_records
}

output "backend_domain" {
  description = "Backend domain name for WebSocket endpoint"
  value       = var.backend_domain_name
}

output "backend_target_group_arn" {
  description = "ARN of the backend WebSocket target group"
  value       = module.alb.backend_target_group_arn
}

output "session_provisioner_target_group_arn" {
  description = "ARN of the session provisioner target group"
  value       = module.alb.session_provisioner_target_group_arn
}

output "alb_security_group_id" {
  description = "Security group ID for the Application Load Balancer"
  value       = module.alb.alb_security_group_id
}
