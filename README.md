# GPU Watchdog

A full-stack GPU cluster monitoring and diagnostic platform demonstrating HPC cluster UI design patterns and deployment of core GPU computing technologies.

## Purpose

This project serves as a learning exercise and technology demonstration for:

- **HPC Cluster UI Design** - Real-time monitoring dashboards, metrics visualization, and AI-assisted diagnostics for GPU workloads
- **GPU Infrastructure** - Deployment and management of multi-node GPU clusters with Slurm workload manager
- **Modern Full-Stack Development** - TypeScript backend/frontend, React with real-time data, and AI agent integration
- **Infrastructure as Code** - Terraform-managed cloud GPU resources with automated provisioning

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Local Development                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Frontend  │  │   Backend   │  │  Prometheus │  │       Grafana       │ │
│  │  (React)    │  │  (Node.js)  │  │             │  │                     │ │
│  │  Port 3000  │  │  Port 8080  │  │  Port 9090  │  │     Port 3001       │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                     │           │
│         └────────────────┼────────────────┼─────────────────────┘           │
│                          │                │                                 │
│                    ┌─────┴────────────────┴─────┐                           │
│                    │     Docker Compose         │                           │
│                    │     (Nginx Gateway)        │                           │
│                    └─────────────┬──────────────┘                           │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
                          RunPod Proxy URLs
                                   │
┌──────────────────────────────────┼──────────────────────────────────────────┐
│                           RunPod GPU Cloud                                  │
│                                  │                                          │
│  ┌───────────────────────────────┴───────────────────────────────────────┐  │
│  │                         Head Node (A100 80GB)                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │    Slurm    │  │     GPU     │  │    Slurm    │  │    vLLM      │  │  │
│  │  │  Controller │  │   Metrics   │  │   Exporter  │  │  (Nemotron)  │  │  │
│  │  │             │  │   :9400     │  │    :9341    │  │    :8000     │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       Worker Node(s) (A100 80GB)                      │  │
│  │  ┌─────────────┐  ┌─────────────┐                                     │  │
│  │  │    Slurm    │  │     GPU     │                                     │  │
│  │  │    Agent    │  │   Metrics   │                                     │  │
│  │  │             │  │    :9400    │                                     │  │
│  │  └─────────────┘  └─────────────┘                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                    Managed by Terraform (terraform/)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### Frontend (`frontend/`)
- **React 19** with TypeScript and Vite
- **Radix UI** component library with Tailwind CSS
- **Real-time dashboards** - GPU metrics, Slurm job queue, cluster health
- **AI Chat Panel** - Interactive diagnostic assistant with markdown rendering
- **Recharts** for time-series visualization

### Backend (`backend/`)
- **Node.js** with TypeScript (ES modules)
- **SQLite** with Drizzle ORM for metrics history
- **Prometheus scraping** for GPU and Slurm metrics
- **AI Agent service** - Agentic loop with tool calling via vLLM

### Infrastructure (`terraform/`)
- **Terraform** provisioning for RunPod GPU pods
- **Dynamic scaling** - Head node + configurable worker count
- **GPU selection** - A100/H100 with automatic fallback

### GPU Pod Template (`docker/runpod-template/`)
- **Custom Docker image** extending RunPod's PyTorch base
- **Slurm** workload manager (built from source for dynamic node support)
- **Munge** authentication for cluster security
- **vLLM** serving NVIDIA Nemotron-3-Nano-30B for AI diagnostics
- **GPU metrics exporter** (nvidia-smi based)

### Local Services (`docker/`)
- **Docker Compose** orchestration for local development
- **Prometheus** for metrics aggregation
- **Grafana** for advanced visualization
- **Nginx gateway** for unified API routing

## Design Decisions

This project intentionally makes pragmatic choices to expedite development while still demonstrating relevant patterns:

### Docker Compose over Kubernetes
- **Rationale**: Faster iteration for a demonstration project. Kubernetes would add operational complexity without proportional benefit for a 2-node cluster.
- **Trade-off**: Less realistic for production HPC environments, but the monitoring patterns and UI design transfer directly.

### Single Dockerfile for Multiple Roles
- **Rationale**: The `docker/runpod-template/Dockerfile` serves both head and worker nodes, with role determined by environment variables at runtime.
- **Trade-off**: Slightly larger images, but dramatically simpler CI/CD and image management.

### RunPod for GPU Infrastructure
- **Rationale**: On-demand A100/H100 GPUs without cloud provider complexity. Spin up in minutes, pay by the hour.
- **Trade-off**: Less control than dedicated hardware, but enables rapid experimentation with enterprise-grade GPUs.

### Terraform over Manual Provisioning
- **Rationale**: Reproducible infrastructure, easy teardown to save costs, and demonstrates IaC patterns relevant to HPC environments.

### SQLite over PostgreSQL/TimescaleDB
- **Rationale**: Zero-configuration persistence for metrics history. Adequate for demonstration scale.
- **Trade-off**: Not suitable for production time-series workloads, but the query patterns are transferable.

### vLLM with Local Model over Cloud APIs
- **Rationale**: Demonstrates running inference on the same GPU cluster being monitored. More realistic for HPC environments where data sovereignty matters.
- **Trade-off**: Requires ~60GB GPU memory for the model, limiting other workloads during AI assistant usage.

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 19, TypeScript, Vite | Modern SPA with hot reload |
| UI Components | Radix UI, Tailwind CSS | Accessible, themeable components |
| Charts | Recharts | Time-series visualization |
| Backend | Node.js, TypeScript | API server and metrics collection |
| Database | SQLite, Drizzle ORM | Metrics history storage |
| AI Agent | vLLM, Nemotron-3 | Local LLM for diagnostics |
| GPU Metrics | nvidia-smi, DCGM | Hardware telemetry |
| Workload Manager | Slurm 23.11 | Job scheduling and resource management |
| Monitoring | Prometheus, Grafana | Metrics aggregation and dashboards |
| Infrastructure | Terraform, RunPod | GPU pod provisioning |
| Containerization | Docker, Docker Compose | Service orchestration |

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Terraform >= 1.9
- Node.js 22+ (via asdf: `asdf install`)
- RunPod account with API key
- HuggingFace token (for Nemotron-3 model access)

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Add your credentials to .env:
# RUNPOD_API_KEY=your_runpod_api_key
# HF_TOKEN=your_huggingface_token
```

### Deploy

```bash
# Full deployment (infrastructure + services)
make deploy

# Or step-by-step:
make infra-init      # Initialize Terraform
make infra-apply     # Provision RunPod cluster (~$2.98/hr for 2x A100)
make services-up     # Start local services
```

### Access

- **Dashboard**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/gpuwatchdog)

### Teardown

```bash
# IMPORTANT: Tear down when not in use to avoid costs
make teardown
```

## Project Structure

```
nvidia-study-cluster/
├── .context/              # Project context and documentation
├── backend/               # Node.js API server
│   └── src/
│       ├── routes/        # API endpoints
│       ├── services/      # Business logic (metrics, alerts, agent)
│       └── lib/           # Shared utilities
├── frontend/              # React dashboard
│   └── src/
│       ├── components/    # UI components
│       ├── hooks/         # React hooks for data fetching
│       └── pages/         # Page components
├── docker/
│   ├── runpod-template/   # GPU pod Docker image
│   ├── prometheus/        # Prometheus configuration
│   ├── grafana/           # Grafana provisioning
│   └── nginx/             # Gateway configuration
├── terraform/             # Infrastructure as Code
├── scripts/               # Deployment and utility scripts
└── Makefile               # Project automation
```

## Features

### GPU Monitoring Dashboard
- Real-time GPU utilization, memory, temperature, and power metrics
- Per-node and per-GPU drill-down views
- Historical time-series charts with configurable duration

### Slurm Integration
- Job queue visualization (pending, running, completed)
- Node state monitoring (idle, allocated, down)
- CPU allocation tracking

### AI Diagnostic Assistant
- Natural language queries about cluster health
- Tool-calling agent that queries backend APIs
- Markdown-rendered responses with tables and formatting
- Powered by NVIDIA Nemotron-3 running locally via vLLM

### Alerting System
- Configurable threshold-based alerts
- Temperature, utilization, and memory monitoring
- Alert history and acknowledgment

## Cost Management

GPU compute is expensive. This project is designed for cost-conscious development:

```bash
# Estimated hourly costs (2-node cluster):
# RTX 4090:  ~$1.38/hr
# A100 80GB: ~$2.98/hr
# H100:      ~$4.98/hr

# Always tear down when not actively using
make teardown

# Check current costs
make cost-estimate
```

## Development

```bash
# Install dependencies
make dev-setup

# Run backend locally
make dev-backend

# Run frontend locally
make dev-frontend

# Run with Docker Compose (recommended)
make services-up
```

## License

This project is for educational and demonstration purposes.
