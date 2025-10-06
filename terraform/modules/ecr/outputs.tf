output "repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.websocket_server.repository_url
}

output "repository_arn" {
  description = "ECR repository ARN"
  value       = aws_ecr_repository.websocket_server.arn
}

output "repository_name" {
  description = "ECR repository name"
  value       = aws_ecr_repository.websocket_server.name
}

output "provisioner_repository_url" {
  description = "Session provisioner ECR repository URL"
  value       = aws_ecr_repository.session_provisioner.repository_url
}

output "provisioner_repository_arn" {
  description = "Session provisioner ECR repository ARN"
  value       = aws_ecr_repository.session_provisioner.arn
}

output "provisioner_repository_name" {
  description = "Session provisioner ECR repository name"
  value       = aws_ecr_repository.session_provisioner.name
}
