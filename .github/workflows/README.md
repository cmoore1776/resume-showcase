# GitHub Actions Workflows

## Status: Disabled

All GitHub Actions workflows have been **disabled** and moved to [`.github/workflows-disabled/`](../workflows-disabled/).

## Why?

The project has migrated from AWS EKS (automated CI/CD) to on-premise k3s (manual Helm deployment). The workflows were designed for AWS infrastructure and are no longer needed.

## Current Deployment

The application is now deployed manually using Helm to a k3s cluster. See:
- [K3S_DEPLOYMENT.md](../../K3S_DEPLOYMENT.md) - Deployment guide
- [`.github/workflows-disabled/README.md`](../workflows-disabled/README.md) - About disabled workflows

## Re-enabling Workflows

To re-enable a workflow, see instructions in [`.github/workflows-disabled/README.md`](../workflows-disabled/README.md).
