# ArgoCD Configuration

This directory contains ArgoCD manifests for GitOps deployment of the resume-showcase application.

## Files

- `appproject.yaml` - ArgoCD AppProject defining project-level policies and permissions
- `application.yaml` - ArgoCD Application defining the deployment configuration and sync policy

## Quick Start

1. Ensure ArgoCD is installed in your cluster
2. Apply the manifests:

```bash
kubectl apply -f argocd/appproject.yaml
kubectl apply -f argocd/application.yaml
```

3. Monitor the deployment:

```bash
kubectl get application resume-showcase -n argocd -w
```

For complete documentation, see [ARGOCD_DEPLOYMENT.md](../ARGOCD_DEPLOYMENT.md) in the root directory.

## Key Features

- **Auto-Sync**: Automatically deploys changes from Git
- **Self-Heal**: Corrects manual changes back to Git state
- **Prune**: Removes resources deleted from Git
- **Server-Side Apply**: Better conflict resolution
- **Retry Logic**: Automatic retry with exponential backoff

## Configuration

The application is configured to:
- Track the `main` branch
- Deploy from `helm/resume-showcase/` directory
- Create resources in `resume-showcase` namespace
- Use Helm for templating

## Customization

To customize the deployment:

1. **Change sync branch**: Edit `spec.source.targetRevision` in `application.yaml`
2. **Override values**: Add `spec.source.helm.values` in `application.yaml`
3. **Disable auto-sync**: Set `spec.syncPolicy.automated` to `null`

## Troubleshooting

```bash
# Check application status
kubectl get application resume-showcase -n argocd

# View application details
kubectl describe application resume-showcase -n argocd

# Force sync
kubectl patch application resume-showcase -n argocd \
  --type merge \
  -p '{"operation":{"initiatedBy":{"username":"manual"},"sync":{"revision":"HEAD"}}}'
```

See [ARGOCD_DEPLOYMENT.md](../ARGOCD_DEPLOYMENT.md) for more troubleshooting steps.
