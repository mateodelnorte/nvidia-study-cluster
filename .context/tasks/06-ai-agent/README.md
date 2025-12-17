---
title: "06: AI Diagnostic Agent"
created: 2025-12-16
modified: 2025-12-17
status: done
priority: medium
owner: mattwwalters
assignee: claude-agent
tags: [ai, agent, llm, diagnostics, tool-calling, nemotron, nvidia]
dependencies: [04-backend-api, 05-frontend]
---

## Overview

Build an AI-powered diagnostic assistant running **NVIDIA's Nemotron-3-Nano-30B** locally on the A100 GPUs. The agent uses tool calling to query cluster metrics and provide operational insights.

## Goals

- [x] Deploy Nemotron-3-Nano-30B via vLLM on head pod
- [x] Create model-agnostic agent service (OpenAI-compatible API)
- [x] Define tools for querying metrics, alerts, and cluster status
- [x] Implement agentic loop with tool execution
- [x] Add `/api/agent/chat` endpoint to backend
- [x] Create chat UI component in frontend
- [x] Test end-to-end with real cluster data

## Key Design Decision: Run NVIDIA's Model Locally

Instead of using a cloud API (OpenAI, etc.), we deploy **NVIDIA Nemotron-3-Nano-30B** on our A100s:

| Aspect | Details |
|--------|---------|
| **Model** | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16` |
| **Architecture** | Hybrid MoE (31.6B total, 3.2B active per forward pass) |
| **VRAM needed** | ~60GB BF16 (A100-80GB has headroom) |
| **Tool calling** | Native support via `qwen3_coder` parser |
| **Inference** | vLLM 0.12.0+ with OpenAI-compatible API |
| **Context** | Up to 256K tokens (1M possible) |

**Why this matters for NVIDIA interview:**
- Shows we can deploy NVIDIA's own models
- Demonstrates understanding of vLLM/TensorRT-LLM ecosystem
- No vendor lock-in to cloud APIs
- Model runs on same A100s we're monitoring

Sources:
- [Nemotron-3-Nano HuggingFace](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16)
- [vLLM Nemotron Recipe](https://docs.vllm.ai/projects/recipes/en/latest/NVIDIA/Nemotron-3-Nano-30B-A3B.html)
- [NVIDIA Blog](https://developer.nvidia.com/blog/inside-nvidia-nemotron-3-techniques-tools-and-data-that-make-it-efficient-and-accurate/)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL (Docker Compose)                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Frontend - ChatPanel                                        ││
│  │  POST /api/agent/chat ───────────────────────────────────┐  ││
│  └──────────────────────────────────────────────────────────┼──┘│
│                                                              │   │
│  ┌───────────────────────────────────────────────────────────┼──┐│
│  │  Backend - Agent Service                                  │  ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  ││
│  │  │ Tool Defs   │  │ Agentic     │  │ Tool        │       │  ││
│  │  │ (JSON)      │  │ Loop        │  │ Executors   │       │  ││
│  │  └─────────────┘  └──────┬──────┘  └──────┬──────┘       │  ││
│  │                          │                │               │  ││
│  │                          ▼                ▼               │  ││
│  │              LLM API call (vLLM)    Backend APIs          │  ││
│  │              via RunPod proxy       /api/*                │  ││
│  └──────────────────────────┼────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  RUNPOD - HEAD POD (A100 80GB)                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  vLLM Server (:8000)                                         ││
│  │  ├── Model: nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16      ││
│  │  ├── OpenAI-compatible API: /v1/chat/completions            ││
│  │  └── Tool calling: --enable-auto-tool-choice                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  (GPU Metrics, Slurm Controller also running)                   │
└─────────────────────────────────────────────────────────────────┘
```

## Tool Definitions

| Tool | Description | Backend Endpoint |
|------|-------------|------------------|
| `get_cluster_status` | Overall health, node count, issues | `GET /api/cluster/status` |
| `get_current_metrics` | Latest GPU & Slurm metrics | `GET /api/metrics/current` |
| `get_node_details` | Detailed metrics for one node | `GET /api/metrics/gpu/:nodeId` |
| `get_gpu_history` | Time-series GPU metrics | `GET /api/metrics/history/gpu` |
| `get_alerts` | Configured alert rules | `GET /api/alerts` |
| `get_alert_history` | Fired alert events | `GET /api/alerts/events/history` |
| `get_slurm_status` | Job queue and node states | `GET /api/metrics/slurm` |

## Implementation Plan

### Phase 1: vLLM Setup on Head Pod

Update `docker/runpod-template/start.sh` to optionally start vLLM:

```bash
# Install vLLM (if not in image)
pip install vllm>=0.12.0

# Download reasoning parser
wget https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16/raw/main/nano_v3_reasoning_parser.py

# Start vLLM server
vllm serve nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16 \
  --max-num-seqs 4 \
  --tensor-parallel-size 1 \
  --max-model-len 32768 \
  --port 8000 \
  --trust-remote-code \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --reasoning-parser-plugin nano_v3_reasoning_parser.py \
  --reasoning-parser nano_v3
```

### Phase 2: Agent Service

```typescript
// backend/src/services/agent.ts
- OpenAI-compatible tool definitions
- Tool executors calling /api/* endpoints
- Agentic loop: query → LLM → tool calls → results → LLM → response
- Config: LLM endpoint points to head pod vLLM server
```

### Phase 3: Backend Route

```typescript
// backend/src/routes/agent.ts
POST /api/agent/chat
  Body: { message: string, history?: ChatMessage[] }
  Response: { response: string, toolCalls: ToolCall[] }
```

### Phase 4: Frontend UI

```typescript
// frontend/src/components/agent/ChatPanel.tsx
- Chat message list with markdown rendering
- Input with send button
- Loading state during agent execution
- Show tool calls for transparency (collapsible)
```

## Configuration

```bash
# Environment variables for agent
LLM_BASE_URL=https://<head-pod-id>-8000.proxy.runpod.net/v1
LLM_API_KEY=not-needed-for-vllm  # vLLM doesn't require auth by default
LLM_MODEL=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16
BACKEND_BASE_URL=http://localhost:8080
```

## Example Interactions

**User:** "How is the cluster doing?"

**Agent thinks:** Let me check the cluster status and current metrics.
- Calls `get_cluster_status`
- Calls `get_current_metrics`

**Agent responds:** "The cluster is healthy with 2 nodes online. Both A100-SXM4-80GB GPUs are currently idle at 0% utilization. Slurm shows 512 CPUs available across 2 nodes with no jobs in the queue. Temperature is 45°C on both GPUs - well within safe operating range."

---

**User:** "Is node-0 running hot?"

**Agent thinks:** I need to check node-0's current and historical temperature.
- Calls `get_node_details` with `nodeId: "node-0"`
- Calls `get_gpu_history` with `nodeId: "node-0", duration: 60`

**Agent responds:** "Node-0's GPU is currently at 47°C, which is normal for an idle A100. Looking at the last hour of data, temperature has been stable between 45-48°C. The A100-SXM4-80GB throttles at 83°C, so you have plenty of thermal headroom. No concerns here."

## Success Criteria

- [x] vLLM runs Nemotron-3 on head pod without OOM
- [x] Agent responds to natural language queries
- [x] Tool calls execute successfully against backend
- [x] Responses include specific metrics from tools
- [x] Chat UI is functional in dashboard
- [x] Latency is acceptable (< 30s for complex queries)

## Implementation Notes (2025-12-17)

### Deployment Challenges Resolved

1. **RunPod Image Caching**: RunPod cached old Docker images even with `:latest` tag. Solution: Use explicit version tags (`v4.2.0`)

2. **Disk Space for Model**: Model download failed with 20GB container disk. Solution: Increased `volume_gb` to 100GB and set `HF_HOME=/workspace/.cache/huggingface` to use persistent volume

3. **Port Conflict**: Log server on port 8001 conflicted with RunPod's nginx proxy. Solution: Changed to port 8002

4. **Backend Connectivity**: Backend couldn't reach vLLM on pod. Solution: Added `LLM_BASE_URL` env var in docker-compose.yml pointing to RunPod proxy URL

### Key Configuration

```bash
# terraform/variables.tf
volume_gb = 100  # For ~60GB model + cache
container_image = "mateodelnorte/gpu-watchdog-pod:v4.2.0"

# terraform/main.tf (head node env)
ENABLE_VLLM = "true"
HF_TOKEN = var.hf_token
HF_HOME = "/workspace/.cache/huggingface"

# docker/docker-compose.yml (backend env)
LLM_BASE_URL = "https://${HEAD_POD_ID}-8000.proxy.runpod.net/v1"
```

### Verified Working

- Model loads in ~5 minutes (60GB GPU memory used)
- Agent responds to cluster queries with real metrics
- Markdown tables render correctly in chat UI
- Tool calls visible in collapsible panel

## Interview Talking Points

1. **NVIDIA Model Stack:** "I deployed NVIDIA's Nemotron-3-Nano-30B locally on A100s using vLLM. This shows I'm familiar with NVIDIA's model ecosystem and can work with their inference stack."

2. **Efficient Architecture:** "Nemotron-3-Nano uses a Mixture-of-Experts architecture - 31B total parameters but only 3.2B active per forward pass. This makes it practical to run on a single A100 while maintaining strong reasoning capabilities."

3. **Tool Calling:** "The agent uses native function calling to query the monitoring APIs. I implemented a simple agentic loop rather than using heavy frameworks - showing I understand the fundamentals."

4. **Model-Agnostic Design:** "The agent code uses the OpenAI-compatible API format, so it works with vLLM, TensorRT-LLM, or any compatible endpoint. Easy to swap models or providers."

5. **Operational AI:** "This demonstrates AI-assisted operations - using LLMs to help operators understand complex GPU clusters, not replace them."

## Files

```
docker/runpod-template/
└── start.sh              # Add vLLM startup

backend/src/
├── services/
│   └── agent.ts          # Agent implementation
├── routes/
│   └── agent.ts          # API endpoint
└── config.ts             # Add LLM config

frontend/src/
└── components/
    └── agent/
        └── ChatPanel.tsx # Chat UI
```

## Related Documents

- [Task 04 README](../04-backend-api/README.md) - Backend API (provides tools)
- [Task 05 README](../05-frontend/README.md) - Frontend (chat UI location)
- [activeContext.md](../../overridable/activeContext.md) - Project status
