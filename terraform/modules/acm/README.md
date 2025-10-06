# ACM Certificate Module

Creates an AWS Certificate Manager (ACM) certificate for SSL/TLS support on the ALB.

## Prerequisites

- A domain name (e.g., `ws.christianmoore.me`)
- Access to DNS records for the domain

## Usage

```hcl
module "acm" {
  source = "./modules/acm"

  project_name = "christianmoore-me"
  environment  = "prod"
  domain_name  = "ws.christianmoore.me"

  # Optional: Add additional domains
  subject_alternative_names = ["*.christianmoore.me"]

  # Set to true only if using Route53 for DNS
  validate_certificate = false
}
```

## DNS Validation Steps

After running `terraform apply`, you need to validate the certificate:

1. **Get validation records:**
   ```bash
   terraform output acm_validation_records
   ```

2. **Add DNS records to your domain:**
   - Type: CNAME
   - Name: `_xxxxx.ws.christianmoore.me`
   - Value: `_xxxxx.acm-validations.aws`

3. **Wait for validation** (usually 5-10 minutes)
   - Check status: `aws acm describe-certificate --certificate-arn <arn>`

4. **Once validated**, the certificate is ready for use with ALB

## DNS Providers

### Namecheap
1. Go to Domain List → Manage → Advanced DNS
2. Add new CNAME Record
3. Host: `_xxxxx.ws` (from validation record)
4. Value: `_xxxxx.acm-validations.aws.`
5. TTL: Automatic

### Cloudflare
1. Go to DNS → Records
2. Add record: Type CNAME
3. Name: Full validation name
4. Target: Validation value
5. Proxy status: DNS only (gray cloud)

### Route53 (Automatic)
Set `validate_certificate = true` in the module and Terraform will handle it.

## Security Notes

- Certificates are free from ACM
- Automatically renews before expiration
- Regional resource (must be in same region as ALB)
- Supports wildcard certificates
