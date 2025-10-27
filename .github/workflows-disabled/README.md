# Disabled GitHub Actions Workflows

This directory contains GitHub Actions workflows that have been **disabled but preserved for reference**.

## Why Disabled?

The project has migrated from AWS EKS to on-premise k3s deployment using Helm charts. The automated CI/CD workflows were designed for AWS infrastructure and are no longer needed for the current deployment model.

## Workflows in This Directory

### Active Workflows (Now Disabled)

- **`build.yml`**: Build and validate frontend/backend on PRs
- **`lint.yml`**: Code quality checks (JavaScript, Python)
- **`security.yml`**: Security scanning (Trivy, npm audit)
- **`pages.yml`**: Deploy frontend to GitHub Pages

### Deployment Workflows (Now Disabled)

- **`deploy.yml`**: AWS EKS deployment with Terraform (legacy)
  - Provisions AWS infrastructure (EKS, VPC, ALB, ECR)
  - Builds and pushes to Amazon ECR
  - Deploys to EKS with kubectl

- **`deploy-k3s.yml`**: k3s deployment with Docker Hub
  - Builds multi-arch images
  - Pushes to Docker Hub
  - Optional k3s deployment (commented out)

## Current Deployment Method

The application is now deployed **manually** to an on-premise k3s cluster using Helm:

```bash
# Build images
docker build -t registry.psyk3s.local:5000/resume-showcase-websocket:latest ./backend
docker build -f ./backend/Dockerfile.provisioner -t registry.psyk3s.local:5000/resume-showcase-provisioner:latest ./backend

# Push to local k3s registry
docker push registry.psyk3s.local:5000/resume-showcase-websocket:latest
docker push registry.psyk3s.local:5000/resume-showcase-provisioner:latest

# Deploy with Helm
helm upgrade --install resume-showcase ./helm/resume-showcase \
  --namespace resume-showcase \
  --create-namespace
```

See [K3S_DEPLOYMENT.md](../../K3S_DEPLOYMENT.md) for complete deployment guide.

## How to Re-enable a Workflow

If you want to re-enable any of these workflows:

1. **Move the workflow back to `.github/workflows/`**:
   ```bash
   git mv .github/workflows-disabled/workflow-name.yml .github/workflows/
   ```

2. **Update the workflow** for your environment:
   - Update registry URLs (Docker Hub, local registry, etc.)
   - Update deployment targets
   - Update secrets/credentials as needed

3. **Commit and push**:
   ```bash
   git add .github/workflows/workflow-name.yml
   git commit -m "Re-enable workflow-name workflow"
   git push
   ```

## Useful Workflows to Consider Re-enabling

### For Development

- **`lint.yml`**: Still useful for code quality checks on PRs
- **`security.yml`**: Still useful for security scanning

### For Production

- **`build.yml`**: Could be adapted for local registry
- **`pages.yml`**: Still needed if using GitHub Pages for frontend

## Notes

- These workflows are preserved in git history for reference
- They represent the AWS EKS deployment architecture
- Some workflows (lint, security) could be adapted for k3s deployment
- The AWS-specific workflows (deploy.yml) would need significant changes to work with k3s

## See Also

- [K3S_DEPLOYMENT.md](../../K3S_DEPLOYMENT.md) - Current deployment guide
- [MIGRATION_SUMMARY.md](../../MIGRATION_SUMMARY.md) - Migration from EKS to k3s
- [CLAUDE.md](../../CLAUDE.md) - Development guidelines
