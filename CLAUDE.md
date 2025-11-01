# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive technical demonstration showcasing cloud-native infrastructure through a real-time latency monitoring application.

**Frontend**: React 19 + Vite web app (GitHub Pages) displaying WebSocket ping/pong latency graphs.

**Backend**: Kubernetes cluster (k3s on-premise or AWS EKS) with warm pod pool and per-session pod provisioning:
- **Session Provisioner StatefulSet**: HTTP service maintaining pool of 2 warm pods for instant assignment
- **WebSocket Server StatefulSet**: 3 replicas for load-balanced connections
- **Session Pods**: Dedicated Kubernetes Jobs created per browser session
- **Auto-replenishment**: Background process maintains warm pool automatically
- **Self-healing**: Users can terminate pods and watch automatic replacement

**Architecture**: Warm pod pooling + StatefulSets + dynamic Job orchestration demonstrates pod lifecycle management and cloud-native resilience patterns.

## Tech Stack

**Frontend**: React 19, Vite 7, JavaScript (JSDoc), Tailwind CSS 3.4, ShadCN, pnpm 9.0, Recharts 3.2
**Backend**: Python 3.11, aiohttp 3.9, websockets 12.0, Kubernetes Python client 28.1
**Infrastructure**: k3s/EKS, Helm 3, Traefik ingress, cert-manager, ArgoCD (GitOps), GitHub Actions

## Development Commands

### Frontend
```bash
pnpm install          # Install dependencies
pnpm dev              # Development server
pnpm build            # Production build (ALWAYS run before completing frontend work)
pnpm lint             # Linter
```

### Backend
```bash
# Build images for local k3s registry
docker build -t registry.k3s.local.christianmoore.me:8443/resume-showcase-websocket:latest ./backend
docker build -f backend/Dockerfile.provisioner -t registry.k3s.local.christianmoore.me:8443/resume-showcase-provisioner:latest ./backend
docker push registry.k3s.local.christianmoore.me:8443/resume-showcase-websocket:latest
docker push registry.k3s.local.christianmoore.me:8443/resume-showcase-provisioner:latest

# Python code quality (run before completing backend work)
ruff check backend/
ruff format backend/
```

### Infrastructure

**Helm Deployment**:
```bash
# Deploy/upgrade
helm upgrade --install resume-showcase ./helm/resume-showcase --namespace resume-showcase

# Check status
kubectl get all -n resume-showcase
kubectl get statefulsets -n resume-showcase
kubectl logs -f statefulset/session-provisioner -n resume-showcase
kubectl logs -f statefulset/websocket-server -n resume-showcase
```

**ArgoCD GitOps** (see ARGOCD_DEPLOYMENT.md):
```bash
# One-time setup
kubectl apply -f argocd/appproject.yaml
kubectl apply -f argocd/application.yaml

# Check sync status
kubectl get application resume-showcase -n argocd
```

## Code Style Guidelines

### JavaScript/JSDoc
- Use JSDoc annotations for type safety (no TypeScript)
- Use `.jsx` extension for JSX syntax, `.js` for plain JavaScript
- Document all function parameters and return types

### React
- Functional components with hooks
- ShadCN components where applicable
- Tailwind utility classes for styling

### Backend Services

**WebSocket Server** (`server.py`):
- Lightweight aiohttp server, port 8080
- Health check endpoint `/health` for Kubernetes probes
- Graceful shutdown handling

**Session Provisioner** (`session_provisioner.py`):
- HTTP API managing warm pod pool (2 pods)
- Creates Kubernetes Jobs for WebSocket sessions
- Endpoints: `POST /session`, `GET /health`
- Port 8081, requires RBAC for Jobs/Pods
- Resource limits hardcoded in `_create_job_manifest()`:
  - CPU: 10m request, 100m limit
  - Memory: 30Mi request, 256Mi limit

### Infrastructure

**Helm Chart** (`helm/resume-showcase/`):
- StatefulSets for session-provisioner (1 replica) and websocket-server (3 replicas)
- Headless services (clusterIP: None) for StatefulSet stable DNS
- Values in `values.yaml`:
  - `warmPoolSize: 2` - warm pod pool size
  - Resource requests/limits optimized for ~1m CPU, 15-73Mi memory usage
  - WebSocket: 10m/100m CPU, 30Mi/256Mi memory
  - Provisioner: 10m/100m CPU, 146Mi/512Mi memory
- Traefik ingress with cert-manager TLS
- RBAC for session provisioner

**Deployment Types**:
- **Helm** (manual): Direct Helm deployment to k3s cluster (see above)
- **ArgoCD** (GitOps): Automated sync from Git repo, self-healing (see ARGOCD_DEPLOYMENT.md)
- **AWS EKS** (legacy): Terraform + raw manifests in `terraform/` and `k8s/`

## Key Technical Components

### StatefulSet Architecture

Both main components use StatefulSets for:
- **Ordered deployment/scaling**: Pods created sequentially (websocket-server-0, -1, -2)
- **Stable network identities**: Predictable DNS names via headless services
- **Persistent pod names**: Enables reliable service discovery

### Warm Pod Pool Strategy

Session provisioner implements HTTP API-based warm pool:
1. **Initialization**: Creates 2 warm Job pods with `pool=warm, assigned=false` labels
2. **Session Request**: Assigns warm pod from pool (instant <1s startup)
3. **Label Update**: Marks assigned pod with `assigned=true` and `session-id`
4. **Replenishment**: Background task maintains pool size
5. **Fallback**: Creates on-demand pod if pool empty (~60s startup)

Benefits: Pre-provisioned speed + dynamic flexibility + simple HTTP API (no webhooks/operators).

### Resource Optimization

All pods use optimized limits based on actual usage:
- **Formula**: 10x current usage (request), 100m minimum (limit) for CPU; 2x usage (request), 4x rounded to 256Mi (limit) for memory
- **StatefulSets**: 10m/100m CPU, 30-146Mi/256-512Mi memory
- **Session Jobs**: 10m/100m CPU, 30Mi/256Mi memory
- **Savings**: 90% reduction in CPU requests while maintaining burst capacity

## Quality Assurance

**ALWAYS perform test builds before completing work:**

**Frontend**:
- Run `pnpm build` to verify JSDoc type checking and Vite build
- Fix all build errors, type errors, and linting issues
- Ensure all imports are correct and dependencies installed

**Backend**:
- Run `ruff check` and `ruff format` to verify Python code quality
- Ensure Kubernetes resource limits are updated in both:
  1. `helm/resume-showcase/values.yaml` (StatefulSets)
  2. `backend/session_provisioner.py` line 226-229 (Job pods)
- Test Docker builds succeed before pushing

**Infrastructure**:
- Run `helm lint helm/resume-showcase/` before deploying
- Run `helm template resume-showcase helm/resume-showcase/` to validate templates
- Verify StatefulSet rollouts complete: `kubectl rollout status statefulset/<name> -n resume-showcase`
