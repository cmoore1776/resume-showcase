# GitHub Actions OIDC Module

This Terraform module creates:
- GitHub OIDC provider for AWS authentication
- IAM role for GitHub Actions with deployment permissions
- Policies for EKS, ECR, S3, and Terraform state management

## Usage

```hcl
module "github_oidc" {
  source = "./modules/github-oidc"

  role_name   = "github-actions-deploy"
  github_org  = "your-org"
  github_repo = "your-repo"
}
```

## What It Creates

1. **OIDC Provider**: Enables GitHub Actions to authenticate with AWS without long-lived credentials
2. **IAM Role**: `github-actions-deploy` with permissions for:
   - EKS cluster management
   - ECR image push/pull
   - Terraform state management (S3 + DynamoDB)
   - VPC/networking read access

## GitHub Actions Setup

After running `terraform apply`, add the role ARN to your GitHub repository secrets:

```bash
# Get the role ARN
terraform output github_actions_role_arn

# Add to GitHub: Settings → Secrets → Actions
# Name: AWS_ROLE_ARN
# Value: <output from above>
```

## Workflow Configuration

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: us-east-1
```

## Security

- Uses OIDC for secure, keyless authentication
- Scoped to specific GitHub org/repo via trust policy
- No long-lived AWS credentials stored in GitHub
- Follows AWS IAM least-privilege principles
