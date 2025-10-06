# ACM Certificate for ALB
resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = var.subject_alternative_names

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cert"
  }
}

# DNS validation records (output these to add to your DNS provider)
resource "aws_acm_certificate_validation" "main" {
  count = var.validate_certificate ? 1 : 0

  certificate_arn = aws_acm_certificate.main.arn

  # Only works if using Route53
  # For other DNS providers, you'll need to manually add the validation records
}
