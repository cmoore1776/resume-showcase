# Resume Showcase - Auto-Recovering Latency Test

Interactive demo showcasing real-time latency monitoring with per-session Kubernetes pod provisioning.

**Live Demo**: [cmoore1776.github.io/resume-showcase](https://cmoore1776.github.io/resume-showcase/)

## Architecture Overview

This project demonstrates advanced Kubernetes orchestration patterns with a warm pod pool system:

- **Latency Monitoring**: Real-time WebSocket ping/pong latency visualization in the browser
- **Session Provisioner**: HTTP service that maintains a pool of 4 warm pods ready for instant session assignment
- **Dynamic Pod Assignment**: Sub-second session startup by assigning pre-warmed pods from the pool
- **Auto-Replenishment**: Background process automatically maintains the warm pod pool
- **Self-Healing Infrastructure**: Pods automatically recreate on failure, demonstrating Kubernetes resilience

### Request Flow

1. User visits frontend (GitHub Pages)
2. Frontend requests session from provisioner (`POST /session`)
3. Provisioner assigns a warm pod from pool (instant) or creates new pod on-demand
4. Frontend establishes WebSocket connection to assigned pod
5. Real-time latency monitoring begins via ping/pong messages
6. Pod pool automatically replenishes in background

## Project Structure

```
.
├── frontend/                        # React + Vite web application (deployed to GitHub Pages)
│   ├── src/                         # Source code (React components, WebSocket client)
│   ├── package.json                 # Frontend dependencies
│   └── vite.config.ts               # Vite build configuration
├── backend/                         # Python WebSocket server and session provisioner
│   ├── server.py                    # WebSocket server for latency monitoring
│   ├── session_provisioner.py       # Pod pool manager and session API
│   ├── requirements.txt             # Python dependencies
│   ├── Dockerfile                   # WebSocket server container
│   └── Dockerfile.provisioner       # Session provisioner container
├── helm/                            # Helm charts for k3s deployment
│   └── resume-showcase/             # Main Helm chart
│       ├── Chart.yaml               # Chart metadata
│       ├── values.yaml              # Default configuration values
│       └── templates/               # Kubernetes resource templates
│           ├── namespace.yaml       # Namespace
│           ├── websocket-*.yaml     # WebSocket server resources
│           ├── provisioner-*.yaml   # Session provisioner resources
│           └── ingress.yaml         # Traefik ingress configuration
├── k8s/                             # Raw Kubernetes manifests (legacy EKS deployment)
├── terraform/                       # Terraform IaC for AWS EKS (legacy)
├── scripts/                         # Utility scripts
├── .github/workflows/               # CI/CD automation
│   ├── deploy-k3s.yml               # k3s deployment (current)
│   ├── deploy.yml                   # AWS EKS deployment (legacy)
│   ├── pages.yml                    # Frontend deployment to GitHub Pages
│   ├── build.yml                    # Build validation on PRs
│   ├── lint.yml                     # Code quality checks
│   └── security.yml                 # Security scanning
├── K3S_DEPLOYMENT.md                # k3s deployment guide
├── CLAUDE.md                        # Development guidelines for Claude Code
├── RESUME.md                        # Resume content
└── README.md                        # This file
```

## Features

- **Warm Pod Pool**: 4 pre-provisioned pods for instant session startup
- **Real-time Latency Monitoring**: WebSocket-based ping/pong latency visualization
- **Per-Session Isolation**: Each browser session gets a dedicated Kubernetes pod
- **Self-Healing Demo**: Users can terminate their pod and observe automatic replacement
- **Cloud-Native Architecture**: Demonstrates EKS, auto-scaling, warm pool patterns, and resilience
- **Optimized Deployment**: Docker layer caching for 50-70% faster builds

## Tech Stack

### Frontend

- **Framework**: React 19 + Vite 7
- **Language**: JavaScript with JSDoc type annotations (TypeScript 5.8)
- **Styling**: Tailwind CSS 3.4 + ShadCN components
- **Package Manager**: pnpm 9.0
- **Hosting**: GitHub Pages
- **Charting**: Recharts 3.2 for real-time latency graphs

### Backend

- **Runtime**: Python 3.11
- **WebSocket Server**: aiohttp 3.9 + websockets 12.0
- **Session Provisioner**: aiohttp HTTP API + Kubernetes Python client 28.1
- **Container Platform**: Docker (multi-stage builds, ARM64)
- **Orchestration**: Kubernetes Jobs with warm pod pool

### Infrastructure

**Current (k3s)**:
- **Container Orchestration**: k3s (lightweight Kubernetes)
- **Infrastructure as Code**: Helm 3 charts
- **Networking**: Traefik ingress controller (built-in with k3s)
- **CI/CD**: GitHub Actions
- **Container Registry**: Docker Hub or local registry
- **TLS**: cert-manager with Let's Encrypt
- **Monitoring**: Prometheus + Grafana (optional)

**Legacy (AWS EKS)**:
- **Cloud Provider**: AWS
- **Container Orchestration**: Amazon EKS (Kubernetes 1.34)
- **Infrastructure as Code**: Terraform 1.0+
- **Networking**: Application Load Balancer, VPC
- **Container Registry**: Amazon ECR

## Local Development

### Backend (WebSocket Server)

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python server.py
```

### Session Provisioner (Local Testing)

```bash
cd backend
python session_provisioner.py
# Requires kubectl configured with EKS cluster access
```

### Frontend (Local Testing)

```bash
cd frontend
pnpm install
pnpm dev
```

### Docker Build

```bash
# WebSocket server
cd backend
docker build -t websocket-server:latest .
docker run -p 8080:8080 websocket-server:latest

# Session provisioner
docker build -f Dockerfile.provisioner -t session-provisioner:latest .
docker run -p 8081:8081 session-provisioner:latest
```

## Deployment

### Option 1: k3s On-Premise (Recommended)

See **[K3S_DEPLOYMENT.md](./K3S_DEPLOYMENT.md)** for comprehensive deployment guide.

**Quick Start**:

```bash
# 1. Install k3s on your server
curl -sfL https://get.k3s.io | sh -

# 2. Build and push images to Docker Hub
docker login
docker build -t your-username/resume-showcase-websocket:latest ./backend
docker build -f ./backend/Dockerfile.provisioner -t your-username/resume-showcase-provisioner:latest ./backend
docker push your-username/resume-showcase-websocket:latest
docker push your-username/resume-showcase-provisioner:latest

# 3. Configure Helm values
cp helm/resume-showcase/values.yaml helm/my-values.yaml
# Edit helm/my-values.yaml with your settings

# 4. Deploy with Helm
helm install resume-showcase ./helm/resume-showcase \
  --values helm/my-values.yaml \
  --create-namespace

# 5. Verify deployment
kubectl get all -n resume-showcase
kubectl get ingress -n resume-showcase
```

**Benefits**:
- Run on your own hardware (no cloud costs)
- Simple Helm-based deployment
- Built-in Traefik ingress with k3s
- Easy to customize and maintain
- Fast local development cycle

### Option 2: AWS EKS (Legacy)

**Note**: The AWS EKS deployment is legacy and uses Terraform + raw Kubernetes manifests.

```bash
# Deploy infrastructure
cd terraform
terraform init
terraform apply

# Build and push images to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
cd backend
docker buildx build --platform linux/arm64 -t <account>.dkr.ecr.us-east-1.amazonaws.com/websocket-server:latest --push .
docker buildx build --platform linux/arm64 -f Dockerfile.provisioner -t <account>.dkr.ecr.us-east-1.amazonaws.com/session-provisioner:latest --push .

# Deploy to Kubernetes
aws eks update-kubeconfig --name christianmoore-me-prod --region us-east-1
kubectl apply -f k8s/
```

### CI/CD

GitHub Actions workflows automate builds and deployments:

- **`.github/workflows/deploy-k3s.yml`**: Builds images and pushes to Docker Hub
- **`.github/workflows/deploy.yml`**: Legacy AWS EKS deployment
- **`.github/workflows/pages.yml`**: Frontend deployment to GitHub Pages
- **`.github/workflows/build.yml`**: PR build validation

## Monitoring

- **Pod Pool Status**: Check warm pod availability via provisioner logs
- **Session Metrics**: Track session creation time and pod assignment
- **Latency Monitoring**: Frontend displays real-time WebSocket latency
- **Kubernetes Health**: Liveness/readiness probes ensure pod health

## Generative AI Integration

See [CLAUDE.md](./CLAUDE.md) for detailed architecture and development guidelines.
