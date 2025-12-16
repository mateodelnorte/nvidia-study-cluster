# Active Context

## Current Focus

**Task 03 & 05 IN PROGRESS** - Frontend dashboard working, Slurm metrics flowing

## Architecture

**Split Architecture (Finalized 2025-12-16):**

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL (Docker Compose)                                          │
│                                                                  │
│  ┌──────────────┐    ┌─────────────────────────────────────┐   │
│  │   Browser    │───▶│  Nginx Gateway (:3000)              │   │
│  └──────────────┘    │  ├── /metrics/* → RunPod proxies    │   │
│                      │  └── /* → Vite dev server           │   │
│                      └─────────────────────────────────────┘   │
│                                      │                          │
│  ┌─────────────┐  ┌─────────────┐   │   ┌─────────────┐        │
│  │ Prometheus  │  │  Grafana    │   │   │  Frontend   │        │
│  │   :9090     │  │   :3001     │   └──▶│  (React)    │        │
│  └─────────────┘  └─────────────┘       └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │
                    HTTPS proxy to RunPod
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│  RUNPOD PODS                │                                    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  HEAD NODE (vhn3um4zikj26g)                              │   │
│  │  ├── GPU Metrics Server (:9400)                          │   │
│  │  ├── Slurm Exporter (:9341)                              │   │
│  │  └── A100-SXM4-80GB GPU                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  WORKER NODE (k004g856rwxokd)                            │   │
│  │  ├── GPU Metrics Server (:9400)                          │   │
│  │  └── A100-SXM4-80GB GPU                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Recent Changes (2025-12-16)

### Frontend Implementation
- Created complete React + Vite + TypeScript dashboard
- Radix UI components with Tailwind CSS styling
- Real-time GPU metrics from both pods
- Slurm cluster status with job queue stats
- Nginx reverse proxy to solve CORS issues

### Key Technical Decisions
1. **Nginx over Vite proxy** - Cleaner separation, production-realistic
2. **Relative URL paths** - Frontend uses `/metrics/gpu/head/metrics` not full URLs
3. **Docker multi-stage** - Same Dockerfile for dev (hot reload) and prod

## Working Features

| Feature | Status | Notes |
|---------|--------|-------|
| GPU metrics (head) | ✅ | Utilization, memory, temp, power, clocks |
| GPU metrics (worker) | ✅ | Same metrics as head |
| Slurm CPU stats | ✅ | Total, allocated, idle |
| Slurm node status | ✅ | Node table with status badges |
| Job queue stats | ✅ | Running, pending, completed, failed |
| Auto-refresh | ✅ | 5-second polling interval |
| Hot reload | ✅ | Vite dev server in Docker |

## Key Files

### Frontend
- [frontend/src/App.tsx](../../frontend/src/App.tsx) - App entry point
- [frontend/src/components/Dashboard.tsx](../../frontend/src/components/Dashboard.tsx) - Main layout
- [frontend/src/hooks/use-metrics.ts](../../frontend/src/hooks/use-metrics.ts) - Data fetching
- [frontend/src/lib/parse-metrics.ts](../../frontend/src/lib/parse-metrics.ts) - Prometheus parser

### Infrastructure
- [docker/docker-compose.yml](../../docker/docker-compose.yml) - All local services
- [docker/nginx/metrics-proxy.conf](../../docker/nginx/metrics-proxy.conf) - Reverse proxy
- [terraform/main.tf](../../terraform/main.tf) - RunPod pod provisioning

## Environment Variables

Frontend uses these (set in docker-compose.yml):
```
VITE_GPU_ENDPOINTS=/metrics/gpu/head/metrics,/metrics/gpu/worker/metrics
VITE_SLURM_ENDPOINT=/metrics/slurm/metrics
```

Nginx proxies these paths to RunPod:
- `/metrics/gpu/head/metrics` → `https://vhn3um4zikj26g-9400.proxy.runpod.net/metrics`
- `/metrics/gpu/worker/metrics` → `https://k004g856rwxokd-9400.proxy.runpod.net/metrics`
- `/metrics/slurm/metrics` → `https://vhn3um4zikj26g-9341.proxy.runpod.net/metrics`

## Quick Start (Current Session)

```bash
# Services already running - access at:
# - Dashboard: http://localhost:3000
# - Grafana: http://localhost:3001 (admin/gpuwatchdog)
# - Prometheus: http://localhost:9090

# Check status
cd docker && docker compose ps

# View logs
cd docker && docker compose logs -f frontend

# Restart after code changes (usually auto-reloads)
cd docker && docker compose restart frontend
```

## Next Actions

1. **Option A:** Complete Task 03 - Configure multi-node Slurm (worker → head)
2. **Option B:** Start Task 04 - Backend API for historical data, alerts
3. **Option C:** Polish Task 05 - Add more dashboard features

## Known Limitations

1. **Slurm single-node only** - Each pod runs independent Slurm, not a cluster
2. **No data persistence** - Metrics lost on refresh (need backend for history)
3. **Hardcoded RunPod URLs** - nginx config has pod IDs baked in
