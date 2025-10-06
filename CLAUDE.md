# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive technical demonstration website showcasing cloud-native infrastructure expertise through a real-time latency monitoring application.

### Application Architecture

**Frontend**: React-based web application (deployed to GitHub Pages) displaying a real-time latency graph showing WebSocket ping/pong latency to the backend.

**Backend**: AWS EKS cluster with warm pod pool and per-session pod provisioning:

- **Session Provisioner**: HTTP service maintaining a pool of 4 warm pods ready for instant assignment
- Each browser session gets a dedicated Kubernetes pod (assigned from pool or created on-demand)
- WebSocket server in each pod responds to client pings
- Background process automatically replenishes the warm pod pool
- Users can remotely terminate their pod and watch automatic pod replacement
- Demonstrates pod lifecycle management, auto-healing, and resilience

### Request Flow

1. Frontend requests session from provisioner (`POST /session`)
2. Provisioner assigns warm pod from pool (instant) or creates new pod on-demand
3. Frontend establishes WebSocket connection to assigned pod
4. Real-time latency monitoring via ping/pong messages
5. Pod pool automatically replenishes in background

This architecture showcases:

- Warm pod pooling for instant session startup
- Real-time WebSocket communication
- Dynamic Kubernetes pod orchestration with Jobs
- Self-healing infrastructure patterns
- Interactive cloud-native concepts

## Tech Stack

### Frontend

- **Framework**: React 19 + Vite 7 with JavaScript (JSDoc type annotations)
- **Styling**: Tailwind CSS 3.4 + ShadCN components
- **Package Manager**: pnpm 9.0
- **WebSocket Client**: Native WebSocket API
- **Charting**: Recharts 3.2 for real-time latency graphs
- **Analytics**: PostHog
- **Hosting**: GitHub Pages

### Backend

- **Runtime**: Python 3.11
- **WebSocket Server**: aiohttp 3.9 + websockets 12.0
- **Session Provisioner**: aiohttp HTTP API + Kubernetes Python client 28.1
- **Container Platform**: Docker (multi-stage builds, ARM64)
- **Orchestration**: Kubernetes Jobs with warm pod pool (4 pre-provisioned pods)

### Infrastructure

- **Cloud Provider**: AWS
- **Container Orchestration**: Amazon EKS (Kubernetes 1.34)
- **Infrastructure as Code**: Terraform 1.0+
- **Networking**: Application Load Balancer, VPC with public/private subnets, Security Groups
- **CI/CD**: GitHub Actions with OIDC authentication
- **Container Registry**: Amazon ECR with layer caching for faster builds
- **DNS**: Route53 with ACM certificates
- **Monitoring**: Datadog + Grafana (configured)

## Development Commands

### Frontend Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Run linter
pnpm lint

# Run tests
pnpm test
```

### Backend Development

```bash
# Build WebSocket server Docker image
docker build -t websocket-server:latest ./backend

# Build session provisioner Docker image
docker build -f ./backend/Dockerfile.provisioner -t session-provisioner:latest ./backend

# Run WebSocket server locally
docker run -p 8080:8080 websocket-server:latest

# Run session provisioner locally (requires kubectl access to EKS)
docker run -p 8081:8081 session-provisioner:latest

# Push to ECR (after AWS authentication)
docker buildx build --platform linux/arm64 -t <account>.dkr.ecr.<region>.amazonaws.com/websocket-server:latest --push ./backend
docker buildx build --platform linux/arm64 -f ./backend/Dockerfile.provisioner -t <account>.dkr.ecr.<region>.amazonaws.com/session-provisioner:latest --push ./backend
```

### Infrastructure Management

```bash
# Initialize Terraform
cd terraform && terraform init

# Plan infrastructure changes
terraform plan

# Apply infrastructure changes
terraform apply

# Destroy infrastructure
terraform destroy

# Deploy to EKS
kubectl apply -f k8s/

# Check pod status
kubectl get pods -n christianmoore

# View logs
kubectl logs -f <pod-name> -n christianmoore
```

## Code Style Guidelines

### JavaScript/JSDoc Typing

- Use JSDoc annotations for type safety instead of TypeScript
- Document all function parameters and return types
- Example:

  ```javascript
  /**
   * @param {string} name - User's full name
   * @param {number} age - User's age
   * @returns {Object} User profile object
   */
  function createUserProfile(name, age) { ... }
  ```

### React Components

- Prefer functional components with hooks
- Use ShadCN for UI components where applicable
- Style with Tailwind utility classes

### Backend Services

**WebSocket Server** (`server.py`):

- Lightweight aiohttp server responding to ping/pong messages
- Health check endpoint for Kubernetes liveness/readiness probes (`/health`)
- Graceful shutdown handling
- Runs on port 8080

**Session Provisioner** (`session_provisioner.py`):

- HTTP API service that manages warm pod pool
- Maintains 4 pre-provisioned pods ready for instant assignment
- Creates Kubernetes Jobs for WebSocket server pods
- Background task to replenish pool automatically
- Endpoints:
  - `POST /session` - Create/assign session pod
  - `GET /health` - Health check
- Runs on port 8081
- Requires RBAC permissions to create/manage Jobs and Pods

### Infrastructure as Code

- Terraform modules for EKS cluster, VPC, ALB, and supporting resources
- Kubernetes manifests for dynamic pod provisioning and auto-scaling
- Follow AWS best practices for security and cost optimization
- Implement pod-per-session orchestration controller or use admission webhooks

## Key Technical Components

### Pod Lifecycle Management

The application demonstrates Kubernetes self-healing by allowing users to:

1. Establish WebSocket connection to their dedicated pod
2. View real-time latency metrics via ping/pong
3. Trigger pod termination via UI button
4. Observe automatic pod recreation and WebSocket reconnection
5. See latency graph resume with new pod

### Pod Provisioning Strategy

**Implemented approach: Warm Pod Pool with HTTP API**

The session provisioner service implements a warm pod pool pattern:

1. **Initialization**: On startup, creates 4 warm Kubernetes Jobs (pods) labeled with `pool=warm, assigned=false`
2. **Session Request**: When `POST /session` is called, provisioner assigns an available warm pod from pool
3. **Instant Assignment**: Pod already running and ready, so session starts in <1 second
4. **Label Update**: Assigned pod is relabeled with `assigned=true` and specific `session-id`
5. **Background Replenishment**: Async task monitors pool and creates new warm pods to maintain pool size
6. **Fallback**: If pool is empty, creates pod on-demand (takes ~60 seconds)

This combines benefits of:

- Pre-provisioned pods (fast startup like StatefulSet)
- Dynamic creation (flexibility like serverless)
- Simple HTTP API (no complex admission webhooks or custom controllers)

### Monitoring & Observability

- Track pod creation/deletion events
- Monitor WebSocket connection metrics
- Measure pod startup time and replacement speed
- Dashboard showing active sessions and pod health

## Quality Assurance

**ALWAYS perform a test build before considering work complete:**

- For frontend work: Run `pnpm build` to verify JSDoc type checking and Vite build succeeds
- For backend work: Run `ruff check` and `ruff format` to verify Python code quality
- Fix all build errors, type errors, and linting issues before marking tasks complete
- Ensure all imports are correct and dependencies are installed
- Use `.jsx` extension for files containing JSX syntax, `.js` for plain JavaScript
- Use JSDoc comments for type annotations instead of TypeScript files
