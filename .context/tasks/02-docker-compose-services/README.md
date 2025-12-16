---
title: "02: Observability Stack - Split Architecture"
created: 2025-12-14
modified: 2025-12-15
status: completed
priority: high
owner: mattwwalters
assignee: claude-agent
tags: [docker, compose, observability, dcgm, prometheus, grafana, architecture, runpod-template]
dependencies: [01-terraform-runpod-setup]
---

## Overview

This task sets up the observability stack for GPU Watchdog using a **split architecture** that places services where they belong:

- **RunPod Pods (GPU):** DCGM metrics export only
- **Local/Cloud (Non-GPU):** Prometheus, Grafana, Backend API, Frontend

**Architecture Decision:** During implementation research, we discovered that RunPod does not support Docker Compose inside pods (pods are already Docker containers). Rather than fighting the platform with complex workarounds, we adopted a split architecture that is more cost-effective and follows production best practices.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LOCAL DEVELOPMENT (Docker Compose)                         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Frontend   │  │  Backend    │  │  Grafana    │         │
│  │  (React)    │  │  (Express)  │  │  Dashboard  │         │
│  │   :3000     │  │   :8080     │  │   :3001     │         │
│  └─────────────┘  └─────────────┘  └──────┬──────┘         │
│                                           │                 │
│                                    ┌──────▼──────┐         │
│                                    │ Prometheus  │         │
│                                    │   :9090     │         │
│                                    └──────┬──────┘         │
└───────────────────────────────────────────┼─────────────────┘
                                            │ scrapes :9400
                                            │
┌───────────────────────────────────────────┼─────────────────┐
│  RUNPOD POD (GPU Compute)                 │                 │
│                                    ┌──────▼──────┐         │
│                                    │DCGM Exporter│         │
│                                    │   :9400     │         │
│                                    └─────────────┘         │
│                                           │                 │
│  ═══════════════════════════════════════════════════════   │
│                    NVIDIA A100 80GB GPU                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  GPU Workloads (PyTorch training/inference)          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Why Split Architecture?

| Factor | All-on-RunPod | Split Architecture |
|--------|---------------|-------------------|
| **Cost** | ~$2.78/hr for services that don't need GPU | ~$1.39/hr (GPU only) + free local |
| **Platform Fit** | Fighting RunPod (no Docker Compose) | Using RunPod for its strength (GPU) |
| **Production Realism** | Unusual pattern | Standard practice |
| **Development Speed** | Slow (rebuild container for changes) | Fast (local hot reload) |
| **Interview Story** | "I made it work" | "I adapted to platform constraints" |

## Goals

- [x] Create local `docker-compose.yml` for Prometheus + Grafana
- [x] Create DCGM setup script for RunPod pods
- [x] Configure Prometheus to scrape remote DCGM endpoint
- [x] Configure Grafana with NVIDIA GPU dashboard
- [x] Add placeholder services for backend API and frontend
- [x] Add Makefile targets for local services and remote DCGM
- [x] Test end-to-end: local Prometheus scraping RunPod DCGM metrics
- [x] Document SSH tunnel approach for secure metrics access
- [x] Create custom RunPod template with auto-starting metrics server

## Implementation Phases

### Phase 1: Directory Structure

```
nvidia-study-cluster/
├── docker/
│   ├── docker-compose.yml          # Local services (Prometheus, Grafana)
│   ├── prometheus/
│   │   └── prometheus.yml          # Prometheus config
│   └── grafana/
│       └── provisioning/
│           ├── datasources/
│           │   └── prometheus.yml  # Auto-configure Prometheus
│           └── dashboards/
│               ├── dashboard.yml   # Dashboard provisioner
│               └── nvidia-gpu.json # Pre-built GPU dashboard
├── scripts/
│   ├── setup-dcgm.sh               # Install DCGM on RunPod pod
│   └── tunnel-metrics.sh           # SSH tunnel for secure scraping
└── Makefile                        # Updated with new targets
```

### Phase 2: Local Docker Compose

#### docker/docker-compose.yml

```yaml
version: "3.8"

services:
  # ---------------------------------------------------------------------------
  # Metrics Storage: Prometheus
  # ---------------------------------------------------------------------------
  prometheus:
    image: prom/prometheus:v2.48.0
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=7d'
      - '--web.enable-lifecycle'
    extra_hosts:
      - "runpod:host-gateway"  # Allows container to reach host's SSH tunnel

  # ---------------------------------------------------------------------------
  # Visualization: Grafana
  # ---------------------------------------------------------------------------
  grafana:
    image: grafana/grafana:10.2.2
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=gpuwatchdog
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus

  # ---------------------------------------------------------------------------
  # Backend API (placeholder - Task 04)
  # ---------------------------------------------------------------------------
  backend:
    image: node:22-alpine
    container_name: backend
    restart: unless-stopped
    ports:
      - "8080:8080"
    working_dir: /app
    volumes:
      - ../backend:/app:ro
    command: ["sh", "-c", "echo 'Backend placeholder - Task 04' && sleep infinity"]

  # ---------------------------------------------------------------------------
  # Frontend (placeholder - Task 05)
  # ---------------------------------------------------------------------------
  frontend:
    image: node:22-alpine
    container_name: frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    working_dir: /app
    volumes:
      - ../frontend:/app:ro
    command: ["sh", "-c", "echo 'Frontend placeholder - Task 05' && sleep infinity"]

volumes:
  prometheus_data:
  grafana_data:
```

### Phase 3: Prometheus Configuration

#### docker/prometheus/prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # DCGM Exporter on RunPod (via SSH tunnel to localhost:9400)
  - job_name: 'dcgm-exporter'
    static_configs:
      - targets: ['host.docker.internal:9400']
        labels:
          instance: 'runpod-head'
          environment: 'gpu-cluster'

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### Phase 4: DCGM Setup Script for RunPod

#### scripts/setup-dcgm.sh

```bash
#!/bin/bash
set -euo pipefail

# Setup DCGM Exporter on RunPod pod
# Usage: ssh into pod, then run this script

echo "=== Installing DCGM Exporter on RunPod ==="

# Check for NVIDIA GPU
if ! nvidia-smi &>/dev/null; then
    echo "ERROR: nvidia-smi not found. Is this a GPU pod?"
    exit 1
fi

# Install DCGM
echo "Installing NVIDIA DCGM..."
apt-get update
apt-get install -y datacenter-gpu-manager

# Start DCGM service
echo "Starting DCGM service..."
nv-hostengine -d

# Download and run dcgm-exporter
echo "Installing dcgm-exporter..."
DCGM_EXPORTER_VERSION="3.3.5-3.4.1"
wget -q "https://github.com/NVIDIA/dcgm-exporter/releases/download/v${DCGM_EXPORTER_VERSION}/dcgm-exporter-${DCGM_EXPORTER_VERSION}-linux-amd64.tar.gz" -O /tmp/dcgm-exporter.tar.gz
tar -xzf /tmp/dcgm-exporter.tar.gz -C /usr/local/bin --strip-components=1
rm /tmp/dcgm-exporter.tar.gz

# Start dcgm-exporter in background
echo "Starting dcgm-exporter on port 9400..."
nohup dcgm-exporter --address :9400 > /workspace/dcgm-exporter.log 2>&1 &

# Verify
sleep 2
if curl -s http://localhost:9400/metrics | grep -q "DCGM_FI"; then
    echo ""
    echo "=== SUCCESS ==="
    echo "DCGM Exporter running on port 9400"
    echo "Metrics available at: http://localhost:9400/metrics"
else
    echo "ERROR: DCGM Exporter failed to start"
    cat /workspace/dcgm-exporter.log
    exit 1
fi
```

### Phase 5: SSH Tunnel for Metrics

#### scripts/tunnel-metrics.sh

```bash
#!/bin/bash
set -euo pipefail

# Create SSH tunnel to forward RunPod DCGM metrics to localhost
# Usage: ./scripts/tunnel-metrics.sh <pod-ip> <ssh-port>

POD_IP="${1:-}"
SSH_PORT="${2:-22}"

if [[ -z "$POD_IP" ]]; then
    echo "Usage: $0 <pod-ip> [ssh-port]"
    echo "  Example: $0 216.249.100.66 20092"
    exit 1
fi

echo "Creating SSH tunnel: localhost:9400 -> ${POD_IP}:9400"
echo "Press Ctrl+C to stop"

ssh -N -L 9400:localhost:9400 \
    -o StrictHostKeyChecking=no \
    -p "${SSH_PORT}" \
    "root@${POD_IP}"
```

### Phase 6: Makefile Targets

Add to root Makefile:

```makefile
# -----------------------------------------------------------------------------
# Local Services (Observability Stack)
# -----------------------------------------------------------------------------
services-up:
	@echo "Starting local observability stack..."
	cd docker && docker compose up -d
	@echo ""
	@echo "Services running:"
	@echo "  Grafana:    http://localhost:3001 (admin/gpuwatchdog)"
	@echo "  Prometheus: http://localhost:9090"

services-down:
	@echo "Stopping local services..."
	cd docker && docker compose down

services-logs:
	cd docker && docker compose logs -f

services-status:
	@cd docker && docker compose ps

# -----------------------------------------------------------------------------
# Remote GPU Metrics
# -----------------------------------------------------------------------------
gpu-tunnel:
	@echo "Creating SSH tunnel for DCGM metrics..."
	@echo "Run this in a separate terminal, then use 'make services-up'"
	@IP=$$(cd terraform && terraform output -raw head_node_public_ip 2>/dev/null) && \
		[ -n "$$IP" ] && ./scripts/tunnel-metrics.sh "$$IP" || \
		echo "Error: No cluster deployed. Deploy with 'make infra-apply' first"

gpu-setup-dcgm:
	@echo "Installing DCGM Exporter on RunPod head node..."
	@IP=$$(cd terraform && terraform output -raw head_node_public_ip 2>/dev/null) && \
		[ -n "$$IP" ] && ssh -o StrictHostKeyChecking=no root@$$IP 'bash -s' < scripts/setup-dcgm.sh || \
		echo "Error: No cluster deployed"
```

## Success Criteria

- [x] `make services-up` starts Prometheus + Grafana locally
- [x] `make gpu-setup-dcgm` installs DCGM exporter on RunPod pod (deprecated - now baked into template)
- [x] `make gpu-tunnel` creates SSH tunnel for metrics
- [x] Prometheus successfully scrapes DCGM metrics via tunnel
- [x] Grafana displays GPU dashboard with live data
- [x] All services accessible at documented ports
- [x] Custom RunPod template auto-starts metrics on pod boot

## Interview Talking Points

This task demonstrates:

1. **Platform-Aware Architecture**: "I discovered RunPod doesn't support Docker Compose in pods, so I redesigned for a split architecture - GPU workloads on RunPod, observability locally. This is more cost-effective and follows production patterns."

2. **Cost Optimization**: "By running Prometheus and Grafana locally instead of on $1.39/hr GPU pods, I reduced costs while keeping the same functionality."

3. **Security Consideration**: "Rather than exposing DCGM metrics publicly, I use SSH tunnels to securely forward metrics to my local Prometheus instance."

4. **Adaptability**: "The original plan assumed Docker Compose support. When I discovered the platform constraint, I pivoted quickly to a better architecture rather than fighting the platform."

## DCGM Metrics Reference

Key metrics exposed by DCGM Exporter:

| Metric | Description |
|--------|-------------|
| `DCGM_FI_DEV_GPU_UTIL` | GPU utilization % |
| `DCGM_FI_DEV_MEM_COPY_UTIL` | Memory controller utilization % |
| `DCGM_FI_DEV_FB_USED` | Framebuffer memory used (MB) |
| `DCGM_FI_DEV_FB_FREE` | Framebuffer memory free (MB) |
| `DCGM_FI_DEV_GPU_TEMP` | GPU temperature (C) |
| `DCGM_FI_DEV_POWER_USAGE` | Power usage (W) |
| `DCGM_FI_DEV_SM_CLOCK` | SM clock frequency (MHz) |
| `DCGM_FI_DEV_MEM_CLOCK` | Memory clock frequency (MHz) |

## Related Documents

- [Task 01 README](../01-terraform-runpod-setup/README.md) - Infrastructure setup
- [systemPatterns.md](../../immutable/systemPatterns.md) - Architecture patterns
- [techContext.md](../../extensible/techContext.md) - Technology stack

## Research Findings (2025-12-15)

### RunPod Limitations Discovered
- **Docker Compose not supported** - Pods are already Docker containers
- **No Docker-in-Docker** - Cannot run nested containers
- **SSH via proxy** - Connection is `ssh root@<ip> -p <port>`, not standard port 22

### Architecture Decision Record
- **Decision:** Split architecture - GPU on RunPod, services local
- **Context:** RunPod designed for GPU compute, not general services
- **Consequences:** Lower cost, better platform fit, more realistic production pattern

## Final Implementation (Completed 2025-12-15)

### Custom RunPod Template
Instead of manually running `setup-dcgm.sh` on each pod, we created a custom Docker template that auto-starts the metrics server:

- **Docker Image:** `mateodelnorte/gpu-watchdog-pod:latest`
- **Base Image:** `runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04`
- **Auto-start:** `/pre_start.sh` hook starts Python metrics server on boot
- **Metrics:** Available at `http://pod:9400/metrics` immediately on pod startup

### Files Created
```
docker/runpod-template/
├── Dockerfile              # Custom RunPod image with metrics baked in
├── dcgm-metrics-server.py  # Python HTTP server exposing nvidia-smi metrics
├── start-metrics.sh        # Startup script (/pre_start.sh hook)
└── README.md               # Template documentation
```

### Makefile Targets Added
- `make template-build DOCKER_USERNAME=xxx` - Build custom RunPod image
- `make template-push DOCKER_USERNAME=xxx` - Push to Docker Hub

### E2E Verification Results
| Component | Status |
|-----------|--------|
| Custom template auto-start | ✅ `/pre_start.sh` executes on boot |
| GPU metrics on pod | ✅ A100-SXM4-80GB metrics exposed |
| SSH tunnel | ✅ localhost:9400 → pod:9400 |
| Prometheus scraping | ✅ dcgm-exporter target: up |
| Grafana dashboard | ✅ Live GPU data displayed |

## Sources

- [RunPod Pods Overview](https://docs.runpod.io/pods/overview) - Platform limitations
- [NVIDIA DCGM Exporter](https://github.com/NVIDIA/dcgm-exporter)
- [Grafana NVIDIA Dashboard](https://grafana.com/grafana/dashboards/12239)
- [DCMonitoring for RunPod](https://github.com/jjziets/DCMontoring)
