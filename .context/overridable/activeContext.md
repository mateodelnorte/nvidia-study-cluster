# Active Context

## Current Focus

**Multi-Node Slurm Working** - Global networking enabled for reliable cross-machine pod communication. Full stack operational.

## Architecture

**Split Architecture (Finalized 2025-12-16):**

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL (Docker Compose)                                          │
│                                                                  │
│  ┌──────────────┐    ┌─────────────────────────────────────┐   │
│  │   Browser    │───▶│  Nginx Gateway (:3000)              │   │
│  └──────────────┘    │  ├── /api/* → Backend API           │   │
│                      │  └── /* → Frontend (Vite)           │   │
│                      └─────────────────────────────────────┘   │
│                                      │                          │
│  ┌─────────────┐  ┌─────────────┐   │   ┌─────────────┐        │
│  │ Prometheus  │  │  Grafana    │   │   │  Backend    │        │
│  │   :9090     │  │   :3001     │   │   │  :8080      │        │
│  └─────────────┘  └─────────────┘   │   └──────┬──────┘        │
│                                      │          │ polls         │
│                                      │          ▼               │
│                                      │   ┌─────────────┐        │
│                                      └──▶│  Frontend   │        │
│                                          │  (React)    │        │
│                                          └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │
              Backend polls RunPod via HTTPS proxy
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│  RUNPOD PODS (provisioned via Terraform)                         │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  HEAD NODE                                               │   │
│  │  ├── GPU Metrics Server (:9400)                          │   │
│  │  ├── Slurm Controller + Exporter (:9341)                 │   │
│  │  └── A100-SXM4-80GB GPU                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  WORKER NODE                                             │   │
│  │  ├── GPU Metrics Server (:9400)                          │   │
│  │  └── A100-SXM4-80GB GPU                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Recent Changes (2025-12-16)

### Global Networking for Cross-Machine Pods
- Enabled `global_networking = true` in Terraform for both head and worker
- Worker connects via `POD_ID.runpod.internal` DNS name (works across machines)
- Pods get 10.x.x.x IPs on RunPod's internal network (100 Mbps between pods)
- No longer relies on pods landing on same physical machine

### Deployment Orchestration
- Created `scripts/deploy.sh` for zero-to-one deployment
- `make deploy` provisions pods, sets up Slurm, starts services
- `make teardown` destroys everything cleanly
- deploy.sh now passes head pod ID (not internal IP) to workers

### TanStack Query Migration
- Frontend uses `@tanstack/react-query` for data fetching
- Exponential backoff on errors (1s → 2s → 4s, max 30s)
- Stale-while-revalidate caching
- No more infinite retry loops when backend is down

### Docker Compose Improvements
- Anonymous volume for node_modules (`- /app/node_modules`)
- CHOKIDAR_USEPOLLING for reliable HMR in Docker
- Cleaner separation of host source and container deps

## Working Features

| Feature | Status | Notes |
|---------|--------|-------|
| Zero-to-one deploy | ✅ | `make deploy` handles everything |
| Multi-node Slurm | ✅ | Global networking for cross-machine communication |
| GPU metrics | ✅ | Both nodes, all metrics |
| Slurm metrics | ✅ | 512 CPUs, 2 nodes, job queue |
| Historical data | ✅ | Backend stores in SQLite |
| Alert rules | ✅ | Create, edit, delete alerts |
| Error handling | ✅ | TanStack Query with backoff |
| Hot reload | ✅ | Vite in Docker with polling |

## Key Files

### Deployment
- [scripts/deploy.sh](../../scripts/deploy.sh) - Full orchestration script
- [scripts/setup-slurm.sh](../../scripts/setup-slurm.sh) - Slurm configless setup
- [Makefile](../../Makefile) - deploy, deploy-skip-infra, teardown targets

### Backend
- [backend/src/index.ts](../../backend/src/index.ts) - Express server
- [backend/src/services/metrics-collector.ts](../../backend/src/services/metrics-collector.ts) - RunPod polling
- [backend/src/services/alert-evaluator.ts](../../backend/src/services/alert-evaluator.ts) - Alert engine

### Frontend
- [frontend/src/hooks/use-metrics.ts](../../frontend/src/hooks/use-metrics.ts) - TanStack Query hook
- [frontend/src/components/Dashboard.tsx](../../frontend/src/components/Dashboard.tsx) - Main layout
- [frontend/src/components/alerts/AlertsPanel.tsx](../../frontend/src/components/alerts/AlertsPanel.tsx) - Alert UI

### Infrastructure
- [docker/docker-compose.yml](../../docker/docker-compose.yml) - All services
- [terraform/main.tf](../../terraform/main.tf) - RunPod provisioning

## Quick Start

```bash
# Full deployment (provisions pods, sets up everything)
make deploy

# Services only (pods already exist)
make deploy-skip-infra

# Tear down everything
make teardown

# Access points:
# - Dashboard: http://localhost:3000
# - Grafana: http://localhost:3001 (admin/gpuwatchdog)
# - Prometheus: http://localhost:9090
# - Backend API: http://localhost:8080
```

## Next Actions

1. **Task 06: AI Agent** - LangChain.js for diagnostic assistance
2. **Polish for demo** - Job submission UI, notification channels

## Known Limitations

1. **Pod IDs change per deploy** - docker/.env auto-updated by deploy.sh
2. **No notification channels** - Alerts fire but don't send emails/Slack yet
3. **Global network bandwidth** - 100 Mbps between pods (sufficient for control plane, may limit data transfer)
