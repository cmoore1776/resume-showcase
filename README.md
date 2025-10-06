# Resume Showcase - Cloud-Native Infrastructure Demo

Interactive cloud-native infrastructure demonstration showcasing real-time latency monitoring with per-session Kubernetes pod provisioning on AWS EKS.

**Live Demo**: [resume-showcase.christianmoore.me](https://resume-showcase.christianmoore.me)

## Architecture Overview

This project demonstrates advanced Kubernetes orchestration patterns with a warm pod pool system:

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
├── frontend/              # React + Vite web application (deployed to GitHub Pages)
├── backend/               # Python WebSocket server and session provisioner
│   ├── server.py         # WebSocket server for latency monitoring
│   ├── session_provisioner.py  # Pod pool manager and session API
│   ├── Dockerfile        # WebSocket server container
│   └── Dockerfile.provisioner  # Session provisioner container
├── k8s/                   # Kubernetes manifests for EKS deployment
│   ├── deployment.yaml   # WebSocket server deployment
│   ├── provisioner-deployment.yaml  # Session provisioner with RBAC
│   ├── target-group-binding.yaml    # ALB integration
│   └── service.yaml      # Kubernetes services
├── terraform/             # Infrastructure as Code for AWS resources
│   ├── main.tf           # Root Terraform configuration
│   └── modules/          # EKS, VPC, ALB, ACM, Route53, ECR modules
└── .github/workflows/     # CI/CD automation
    ├── deploy.yml        # Infrastructure + backend deployment pipeline
    └── pages.yml         # Frontend deployment to GitHub Pages
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

- **Cloud Provider**: AWS
- **Container Orchestration**: Amazon EKS (Kubernetes 1.34)
- **Infrastructure as Code**: Terraform 1.0+
- **Networking**: Application Load Balancer, VPC with public/private subnets
- **CI/CD**: GitHub Actions with OIDC authentication
- **Container Registry**: Amazon ECR
- **DNS**: Route53 with ACM certificates
- **Monitoring**: Datadog + Grafana

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

### Frontend

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

The project uses GitHub Actions for automated deployment:

1. **Infrastructure**: Terraform provisions EKS cluster, VPC, ALB, ECR, Route53
2. **Backend Images**: Multi-arch Docker builds pushed to ECR with layer caching
3. **Kubernetes Deployment**: Manifests applied to EKS, warm pod pool initialized
4. **Frontend**: Built and deployed to GitHub Pages

### Manual Deployment

```bash
# Deploy infrastructure
cd terraform
terraform init
terraform plan
terraform apply

# Build and push images
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
cd backend
docker buildx build --platform linux/arm64 -t <account>.dkr.ecr.us-east-1.amazonaws.com/websocket-server:latest --push .
docker buildx build --platform linux/arm64 -f Dockerfile.provisioner -t <account>.dkr.ecr.us-east-1.amazonaws.com/session-provisioner:latest --push .

# Deploy to Kubernetes
aws eks update-kubeconfig --name christianmoore-me-prod --region us-east-1
kubectl apply -f k8s/
```

## Monitoring

- **Pod Pool Status**: Check warm pod availability via provisioner logs
- **Session Metrics**: Track session creation time and pod assignment
- **Latency Monitoring**: Frontend displays real-time WebSocket latency
- **Kubernetes Health**: Liveness/readiness probes ensure pod health

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed architecture and development guidelines.
