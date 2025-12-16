# GPU Watchdog - RunPod Pod Template

Custom RunPod pod template with the official NVIDIA DCGM Exporter for Prometheus.

## Features

- Based on `runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04`
- Includes official NVIDIA DCGM Exporter (built from source)
- Auto-starts metrics server on pod boot
- Compatible with Prometheus scraping

## Metrics Exposed

The official DCGM Exporter provides comprehensive GPU metrics including:

| Metric | Description |
|--------|-------------|
| `DCGM_FI_DEV_GPU_UTIL` | GPU utilization (%) |
| `DCGM_FI_DEV_MEM_COPY_UTIL` | Memory utilization (%) |
| `DCGM_FI_DEV_FB_USED` | Framebuffer used (MiB) |
| `DCGM_FI_DEV_FB_FREE` | Framebuffer free (MiB) |
| `DCGM_FI_DEV_GPU_TEMP` | GPU temperature (C) |
| `DCGM_FI_DEV_POWER_USAGE` | Power usage (W) |
| `DCGM_FI_DEV_SM_CLOCK` | SM clock (MHz) |
| `DCGM_FI_DEV_MEM_CLOCK` | Memory clock (MHz) |
| `DCGM_FI_DEV_PCIE_TX_THROUGHPUT` | PCIe TX throughput (KB/s) |
| `DCGM_FI_DEV_PCIE_RX_THROUGHPUT` | PCIe RX throughput (KB/s) |
| `DCGM_FI_DEV_NVLINK_BANDWIDTH_*` | NVLink bandwidth metrics |
| `DCGM_FI_DEV_XID_ERRORS` | XID error count |
| `DCGM_FI_DEV_ECC_*` | ECC error metrics |

See [DCGM Field Identifiers](https://docs.nvidia.com/datacenter/dcgm/latest/dcgm-api/dcgm-api-field-ids.html) for complete list.

## Build & Push

```bash
# Build for linux/amd64 (required for RunPod)
make template-build DOCKER_USERNAME=yourusername

# Push to Docker Hub
make template-push DOCKER_USERNAME=yourusername
```

## Create RunPod Template

1. Go to [RunPod Console](https://runpod.io/console/user/templates)
2. Click "New Template"
3. Configure:
   - **Template Name**: `gpu-watchdog`
   - **Docker Image**: `<your-username>/gpu-watchdog-pod:latest`
   - **Exposed HTTP Ports**: `9400`
   - **Exposed TCP Ports**: `22`
4. Save template

## Use Template

When creating a new pod, select your `gpu-watchdog` template. The DCGM Exporter will start automatically.

Access metrics at: `http://<pod-ip>:9400/metrics`

## Local Testing

```bash
# SSH to pod
ssh root@<pod-ip> -p <port>

# Check metrics
curl http://localhost:9400/metrics

# Check logs
cat /workspace/logs/dcgm-exporter.log

# Check DCGM status
dcgmi discovery -l
```

## Architecture

```
┌─────────────────────────────────────────────┐
│  RunPod Pod                                 │
│                                             │
│  ┌─────────────────┐  ┌─────────────────┐  │
│  │  nv-hostengine  │──│  dcgm-exporter  │  │
│  │  (DCGM daemon)  │  │    :9400        │  │
│  └────────┬────────┘  └────────┬────────┘  │
│           │                    │           │
│           ▼                    ▼           │
│  ┌─────────────────────────────────────┐   │
│  │         NVIDIA GPU Driver           │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Sources

- [NVIDIA DCGM Exporter](https://github.com/NVIDIA/dcgm-exporter)
- [DCGM Documentation](https://docs.nvidia.com/datacenter/dcgm/latest/)
- [Grafana NVIDIA Dashboard](https://grafana.com/grafana/dashboards/12239)
