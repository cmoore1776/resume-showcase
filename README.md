# Resume Showcase - Cloud-Native Infrastructure Demo

Interactive cloud-native infrastructure demonstration showcasing real-time latency monitoring with per-session Kubernetes pod provisioning on AWS EKS.

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
├── k8s/                             # Kubernetes manifests for EKS deployment
│   ├── namespace.yaml               # Kubernetes namespace definition
│   ├── deployment.yaml              # WebSocket server deployment
│   ├── service.yaml                 # Kubernetes services
│   ├── provisioner-deployment.yaml  # Session provisioner deployment
│   ├── provisioner-rbac.yaml        # RBAC for session provisioner
│   ├── target-group-binding.yaml    # ALB target group integration
│   ├── ingress.yaml                 # ALB ingress configuration
│   └── aws-lb-controller-*.yaml     # AWS Load Balancer Controller configs
├── terraform/                       # Infrastructure as Code for AWS resources
│   ├── main.tf                      # Root Terraform configuration
│   ├── variables.tf                 # Input variables
│   ├── outputs.tf                   # Output values
│   └── modules/                     # Terraform modules
│       ├── vpc/                     # VPC with public/private subnets
│       ├── eks/                     # EKS cluster configuration
│       ├── alb/                     # Application Load Balancer
│       ├── ecr/                     # Container registry
│       ├── acm/                     # SSL/TLS certificates
│       ├── github-oidc/             # GitHub Actions OIDC provider
│       └── cloudfront/              # CloudFront CDN (if applicable)
├── scripts/                         # Utility scripts
│   ├── setup-git-hooks.sh           # Install pre-commit hooks
│   └── create-provisioner-ecr.sh    # ECR repository setup
├── .github/workflows/               # CI/CD automation
│   ├── deploy.yml                   # Infrastructure + backend deployment
│   ├── pages.yml                    # Frontend deployment to GitHub Pages
│   ├── build.yml                    # Build validation on PRs
│   ├── lint.yml                     # Code quality checks
│   └── security.yml                 # Security scanning
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

## Generative AI Integration

See [CLAUDE.md](./CLAUDE.md) for detailed architecture and development guidelines.
