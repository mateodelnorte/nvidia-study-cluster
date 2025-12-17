# Active Context

## Current Focus

**All Core Features Complete** - Full stack GPU monitoring platform with AI diagnostic agent operational. Ready for demo/interview preparation.

## Architecture

**Split Architecture with AI Agent (2025-12-17):**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LOCAL (Docker Compose)                                                  │
│                                                                          │
│  ┌──────────────┐    ┌─────────────────────────────────────┐            │
│  │   Browser    │───▶│  Nginx Gateway (:3000)              │            │
│  └──────────────┘    │  ├── /api/* → Backend API           │            │
│                      │  └── /* → Frontend (Vite)           │            │
│                      └─────────────────────────────────────┘            │
│                                      │                                   │
│  ┌─────────────┐  ┌─────────────┐   │   ┌─────────────────────────────┐│
│  │ Prometheus  │  │  Grafana    │   │   │  Backend (:8080)            ││
│  │   :9090     │  │   :3001     │   │   │  ├── Metrics Collection     ││
│  └─────────────┘  └─────────────┘   │   │  ├── Alert Evaluation       ││
│                                      │   │  └── Agent Service ────────┼┼──┐
│                                      │   └────────────────────────────┘│  │
│                                      │                                   │  │
│                                      │   ┌─────────────────────────────┐│  │
│                                      └──▶│  Frontend (React)           ││  │
│                                          │  ├── Dashboard              ││  │
│                                          │  ├── Alerts UI              ││  │
│                                          │  └── AI Chat Panel          ││  │
│                                          └─────────────────────────────┘│  │
└──────────────────────────────────────────────────────────────────────────┘  │
                              │                                               │
              Backend polls RunPod via HTTPS proxy                            │
                              │                                               │
┌─────────────────────────────┼───────────────────────────────────────────────┼─┐
│  RUNPOD PODS (provisioned via Terraform)                                    │ │
│                             ▼                                               │ │
│  ┌────────────────────────────────────────────────────────────────────┐    │ │
│  │  HEAD NODE (A100-SXM4-80GB)                                        │    │ │
│  │  ├── GPU Metrics Server (:9400)                                    │    │ │
│  │  ├── Slurm Controller + Exporter (:9341)                           │    │ │
│  │  ├── vLLM Server (:8000) ◀─────────────────────────────────────────┼────┘ │
│  │  │   └── Nemotron-3-Nano-30B (~60GB VRAM)                          │      │
│  │  └── Log Server (:8002) - vLLM startup logs                        │      │
│  └────────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  WORKER NODE (A100-SXM4-80GB)                                      │     │
│  │  ├── GPU Metrics Server (:9400)                                    │     │
│  │  └── Slurm Agent (connects to head)                                │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Recent Changes (2025-12-17)

### AI Diagnostic Agent (Task 06)
- vLLM 0.12.0 serving NVIDIA Nemotron-3-Nano-30B-A3B-BF16
- OpenAI-compatible API with tool calling (`qwen3_coder` parser)
- Agentic loop: query → LLM → tool calls → backend APIs → response
- 7 tools for cluster diagnostics (status, metrics, alerts, history, Slurm)
- ChatPanel with markdown rendering (tables, code blocks, lists)
- vLLM logs viewer for monitoring model loading progress

### Infrastructure Updates
- Docker image `mateodelnorte/gpu-watchdog-pod:v4.2.0` with vLLM
- HuggingFace token integration for gated model downloads
- Persistent volume for model cache (100GB, HF_HOME=/workspace/.cache)
- Port 8002 for log server (8001 used by RunPod nginx)
- `LLM_BASE_URL` env var added to docker-compose.yml

### Documentation
- Created comprehensive README.md at project root
- Architecture diagrams, design decisions, quick start guide

## Working Features

| Feature | Status | Notes |
|---------|--------|-------|
| Zero-to-one deploy | ✅ | `make deploy` handles everything |
| Multi-node Slurm | ✅ | Global networking for cross-machine communication |
| GPU metrics | ✅ | Both nodes, all metrics (utilization, temp, memory, power) |
| Slurm metrics | ✅ | 512 CPUs, 2 nodes, job queue status |
| Historical data | ✅ | Backend stores in SQLite, charts in frontend |
| Alert rules | ✅ | Create, edit, delete alerts with threshold config |
| AI Chat | ✅ | Nemotron-3 via vLLM, tool calling, markdown rendering |
| Error handling | ✅ | TanStack Query with exponential backoff |
| Hot reload | ✅ | Vite in Docker with polling |

## Key Files

### AI Agent
- [backend/src/services/agent.ts](../../backend/src/services/agent.ts) - Agent implementation
- [backend/src/routes/agent.ts](../../backend/src/routes/agent.ts) - API endpoints
- [frontend/src/components/agent/ChatPanel.tsx](../../frontend/src/components/agent/ChatPanel.tsx) - Chat UI
- [frontend/src/hooks/use-agent.ts](../../frontend/src/hooks/use-agent.ts) - React Query hook
- [docker/runpod-template/start.sh](../../docker/runpod-template/start.sh) - vLLM startup

### Deployment
- [scripts/deploy.sh](../../scripts/deploy.sh) - Full orchestration script
- [Makefile](../../Makefile) - deploy, deploy-skip-infra, teardown targets
- [terraform/main.tf](../../terraform/main.tf) - RunPod provisioning with vLLM env vars

### Backend
- [backend/src/index.ts](../../backend/src/index.ts) - Express server
- [backend/src/services/metrics-collector.ts](../../backend/src/services/metrics-collector.ts) - RunPod polling
- [backend/src/services/alert-evaluator.ts](../../backend/src/services/alert-evaluator.ts) - Alert engine

### Frontend
- [frontend/src/hooks/use-metrics.ts](../../frontend/src/hooks/use-metrics.ts) - TanStack Query hook
- [frontend/src/components/Dashboard.tsx](../../frontend/src/components/Dashboard.tsx) - Main layout
- [frontend/src/index.css](../../frontend/src/index.css) - Markdown styles

## Quick Start

```bash
# Full deployment (provisions pods, sets up everything)
make deploy

# Services only (pods already exist)
make deploy-skip-infra

# Tear down everything (saves money!)
make teardown

# Access points:
# - Dashboard: http://localhost:3000
# - Grafana: http://localhost:3001 (admin/gpuwatchdog)
# - Prometheus: http://localhost:9090
# - Backend API: http://localhost:8080
```

## Interview Talking Points

1. **Full Stack:** React + Node.js + SQLite, real-time data fetching with TanStack Query
2. **GPU Infrastructure:** Terraform-managed RunPod pods, NVIDIA A100s, Slurm workload manager
3. **NVIDIA Model Stack:** Nemotron-3-Nano-30B via vLLM, demonstrating NVIDIA ecosystem familiarity
4. **Observability:** Prometheus metrics, Grafana dashboards, custom alerting engine
5. **AI Operations:** Tool-calling agent for cluster diagnostics, model-agnostic design

## Known Limitations

1. **Pod IDs change per deploy** - docker/.env auto-updated by deploy.sh
2. **No notification channels** - Alerts fire but don't send emails/Slack yet
3. **Global network bandwidth** - 100 Mbps between pods (sufficient for control plane)
4. **Model loading time** - ~5 minutes for Nemotron-3 to load on cold start
5. **Single conversation** - Chat history not persisted across page reloads

## Potential Enhancements

- Notification channels (Slack, email, PagerDuty)
- Job submission UI for Slurm
- Streaming LLM responses
- Conversation history persistence
- GPU stress testing workloads
