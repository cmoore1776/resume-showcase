# ArgoCD GitOps Deployment

This document describes how to deploy the resume-showcase application using ArgoCD for GitOps continuous delivery.

## Prerequisites

- ArgoCD already installed in your Kubernetes cluster
- `kubectl` configured to access your cluster
- Access to the ArgoCD namespace (typically `argocd`)
- Git repository pushed to GitHub: `https://github.com/cmoore1776/resume-showcase.git`

## Architecture

The ArgoCD deployment uses two main resources:

1. **AppProject** (`argocd/appproject.yaml`) - Defines project-level policies and permissions
2. **Application** (`argocd/application.yaml`) - Defines the application sync configuration

The Application monitors the `helm/resume-showcase` directory in the Git repository and automatically syncs changes to the cluster.

## Initial Setup

### 1. Apply the AppProject

Create the ArgoCD project for resume-showcase:

```bash
kubectl apply -f argocd/appproject.yaml
```

Verify the project was created:

```bash
kubectl get appproject resume-showcase -n argocd
```

### 2. Apply the Application

Create the ArgoCD application:

```bash
kubectl apply -f argocd/application.yaml
```

Verify the application was created:

```bash
kubectl get application resume-showcase -n argocd
```

### 3. Monitor Initial Sync

Watch the application sync status:

```bash
# Using kubectl
kubectl get application resume-showcase -n argocd -w

# Or using ArgoCD CLI if installed
argocd app get resume-showcase

# Watch sync status with auto-refresh
argocd app sync resume-showcase --watch
```

The initial sync should create:
- Namespace: `resume-showcase`
- StatefulSet: `session-provisioner` (1 replica)
- StatefulSet: `websocket-server` (3 replicas)
- Services, Ingress, RBAC, and other resources

## Sync Policy

The application is configured with **automated sync**:

- **Auto-Sync**: Changes in Git automatically deploy to the cluster
- **Self-Heal**: Drift in cluster state is automatically corrected
- **Prune**: Resources removed from Git are deleted from the cluster

### Sync Behavior

```yaml
syncPolicy:
  automated:
    prune: true      # Delete resources not in Git
    selfHeal: true   # Correct manual changes in cluster
```

This means:
- Commit changes to `helm/resume-showcase/` → ArgoCD deploys automatically
- Manual `kubectl` changes → ArgoCD reverts them back to Git state
- Delete files from Git → ArgoCD removes resources from cluster

## Making Changes

### Option 1: GitOps Workflow (Recommended)

1. Update Helm chart files in `helm/resume-showcase/`
2. Commit and push to Git
3. ArgoCD automatically detects and syncs changes (within ~3 minutes)

```bash
# Example: Update image tag
vim helm/resume-showcase/values.yaml
git add helm/resume-showcase/values.yaml
git commit -m "Update websocket image to v1.2.0"
git push

# Watch ArgoCD sync the change
argocd app get resume-showcase --watch
```

### Option 2: Manual Sync Trigger

Force an immediate sync without waiting for auto-sync:

```bash
# Using ArgoCD CLI
argocd app sync resume-showcase

# Using kubectl
kubectl patch application resume-showcase -n argocd \
  --type merge \
  -p '{"operation":{"initiatedBy":{"username":"manual"},"sync":{"revision":"HEAD"}}}'
```

### Option 3: Local Development (Bypass ArgoCD)

For rapid iteration during development, you can temporarily use Helm directly:

```bash
# Deploy directly with Helm (bypasses ArgoCD)
helm upgrade --install resume-showcase ./helm/resume-showcase \
  --namespace resume-showcase

# ArgoCD will detect drift and revert to Git state on next sync
# To prevent this, pause auto-sync temporarily (see below)
```

## Managing the Application

### Check Application Status

```bash
# Using kubectl
kubectl get application resume-showcase -n argocd -o yaml

# Using ArgoCD CLI (more readable)
argocd app get resume-showcase

# Check sync status
argocd app list | grep resume-showcase
```

### View Application Logs

```bash
# Get all application resources
kubectl get all -n resume-showcase

# Check StatefulSet logs
kubectl logs -f statefulset/session-provisioner -n resume-showcase
kubectl logs -f statefulset/websocket-server -n resume-showcase

# Check specific pod
kubectl logs -f websocket-server-0 -n resume-showcase
```

### Pause Auto-Sync (for Development)

Temporarily disable auto-sync to make manual changes:

```bash
# Disable auto-sync
argocd app set resume-showcase --sync-policy none

# Make your manual changes with Helm/kubectl
helm upgrade --install resume-showcase ./helm/resume-showcase --namespace resume-showcase

# Re-enable auto-sync when done
argocd app set resume-showcase --sync-policy automated \
  --auto-prune --self-heal
```

### Refresh Application (Force Sync Check)

Trigger ArgoCD to check Git for changes immediately:

```bash
argocd app get resume-showcase --refresh
```

### Rollback to Previous Version

```bash
# List deployment history
argocd app history resume-showcase

# Rollback to specific revision
argocd app rollback resume-showcase <REVISION_ID>
```

## Customizing Values

### Method 1: Update values.yaml in Git (Recommended)

Edit `helm/resume-showcase/values.yaml` and commit:

```bash
vim helm/resume-showcase/values.yaml
git add helm/resume-showcase/values.yaml
git commit -m "Update configuration"
git push
```

### Method 2: Use Helm Parameters in Application

Edit `argocd/application.yaml` to override specific values:

```yaml
spec:
  source:
    helm:
      values: |
        websocketServer:
          replicaCount: 5
        sessionProvisioner:
          warmPoolSize: 4
```

Apply the updated application:

```bash
kubectl apply -f argocd/application.yaml
```

### Method 3: Use External Values File

Create a separate values file and reference it:

```yaml
spec:
  source:
    helm:
      valueFiles:
        - values.yaml
        - values-production.yaml
```

## Troubleshooting

### Application Not Syncing

```bash
# Check application status
argocd app get resume-showcase

# Check for sync errors
kubectl describe application resume-showcase -n argocd

# Check ArgoCD application controller logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller
```

### Sync Failures

```bash
# View detailed sync status
argocd app get resume-showcase

# Get last sync result
kubectl get application resume-showcase -n argocd -o jsonpath='{.status.operationState}'

# Force refresh and retry
argocd app get resume-showcase --hard-refresh
argocd app sync resume-showcase --force
```

### Out-of-Sync State

If the application shows as "OutOfSync":

```bash
# Check what resources differ
argocd app diff resume-showcase

# Sync to fix
argocd app sync resume-showcase
```

### Delete and Recreate Application

```bash
# Delete application (keeps resources by default)
kubectl delete -f argocd/application.yaml

# Delete application AND all deployed resources
argocd app delete resume-showcase --cascade

# Recreate
kubectl apply -f argocd/appproject.yaml
kubectl apply -f argocd/application.yaml
```

## Building and Pushing Images

ArgoCD manages the deployment, but you still need to build and push images to the registry:

```bash
# Build images
docker build -t registry.k3s.local.christianmoore.me:8443/resume-showcase-websocket:latest ./backend
docker build -f backend/Dockerfile.provisioner \
  -t registry.k3s.local.christianmoore.me:8443/resume-showcase-provisioner:latest ./backend

# Push to registry
docker push registry.k3s.local.christianmoore.me:8443/resume-showcase-websocket:latest
docker push registry.k3s.local.christianmoore.me:8443/resume-showcase-provisioner:latest

# ArgoCD will detect the Helm chart hasn't changed, so no auto-sync
# To trigger restart after image push:
kubectl rollout restart statefulset/websocket-server -n resume-showcase
kubectl rollout restart statefulset/session-provisioner -n resume-showcase

# Or update image tag in values.yaml and commit to Git
```

## Uninstallation

### Remove Application Only (Keep Resources)

```bash
kubectl delete -f argocd/application.yaml
# Resources in resume-showcase namespace remain running
```

### Remove Application and Resources

```bash
# Using ArgoCD CLI (cascade delete)
argocd app delete resume-showcase --cascade

# Or using kubectl with finalizer removal
kubectl patch application resume-showcase -n argocd \
  --type json -p='[{"op": "remove", "path": "/metadata/finalizers"}]'
kubectl delete -f argocd/application.yaml
kubectl delete namespace resume-showcase
```

### Remove AppProject

```bash
kubectl delete -f argocd/appproject.yaml
```

## Accessing ArgoCD UI

If you want to view the application in the ArgoCD web UI:

```bash
# Port-forward to ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# Open browser to https://localhost:8080
# Login with username: admin, password: <from above>
```

## Best Practices

1. **Always commit changes to Git** - Don't make manual cluster changes
2. **Use semantic versioning** for image tags instead of `latest` in production
3. **Test changes locally** with Helm before committing
4. **Use separate branches** for development (e.g., `dev` branch syncs to dev cluster)
5. **Pin ArgoCD sync to specific Git tags** for production releases
6. **Monitor ArgoCD notifications** for sync failures
7. **Use AppProject roles** for team access control

## Integration with CI/CD

You can integrate image builds into GitHub Actions and use ArgoCD for deployment:

```yaml
# .github/workflows/build.yml (example)
- name: Build and Push Images
  run: |
    docker build -t registry.k3s.local.christianmoore.me:8443/resume-showcase-websocket:${{ github.sha }} ./backend
    docker push registry.k3s.local.christianmoore.me:8443/resume-showcase-websocket:${{ github.sha }}

- name: Update Helm Values
  run: |
    sed -i "s/tag: .*/tag: ${{ github.sha }}/" helm/resume-showcase/values.yaml
    git commit -am "Update image tag to ${{ github.sha }}"
    git push

# ArgoCD will automatically sync the new image tag
```

## Additional Resources

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [ArgoCD Best Practices](https://argo-cd.readthedocs.io/en/stable/user-guide/best_practices/)
- [Helm Chart Development](https://helm.sh/docs/chart_template_guide/)
