# GPU Watchdog - RunPod Pod Template

Custom RunPod pod template with Slurm workload manager and GPU metrics exporter.

## Features

- Based on `runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04`
- **Slurm Workload Manager** with configless mode for automatic multi-node clusters
- **GPU Metrics Exporter** (nvidia-smi based, Prometheus format)
- **Prometheus Slurm Exporter** for cluster metrics
- Auto-configures on pod boot via environment variables

## Quick Start

### Environment Variables

Set these in Terraform or RunPod console:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ROLE` | Yes | `head` or `worker` |
| `HEAD_NODE_IP` | Workers only | Internal IP of head node |
| `CLUSTER_NAME` | No | Cluster name (default: `gpu-watchdog`) |
| `WORKER_NODES` | No | Pre-define workers: `hostname1:ip1,hostname2:ip2` |

### Multi-Node Cluster Setup

1. **Head node** starts first with `NODE_ROLE=head`
2. **Workers** start with `NODE_ROLE=worker` and `HEAD_NODE_IP=<head-internal-ip>`
3. Workers use Slurm's **configless mode** to fetch config automatically

### Terraform Example

```hcl
resource "runpod_pod" "head_node" {
  env = {
    NODE_ROLE    = "head"
    CLUSTER_NAME = "gpu-watchdog"
  }
}

resource "runpod_pod" "worker_node" {
  env = {
    NODE_ROLE    = "worker"
    HEAD_NODE_IP = "172.21.0.3"  # Set after head is created
  }
}
```

## Endpoints

| Port | Service | Description |
|------|---------|-------------|
| 9400 | GPU Metrics | Prometheus metrics (`/metrics`) |
| 9341 | Slurm Metrics | Cluster stats (head only) |
| 6817 | slurmctld | Slurm controller (head only) |
| 6818 | slurmd | Slurm daemon (all nodes) |

## GPU Metrics

```
DCGM_FI_DEV_GPU_UTIL      - GPU utilization (%)
DCGM_FI_DEV_MEM_COPY_UTIL - Memory utilization (%)
DCGM_FI_DEV_FB_USED       - Framebuffer used (MiB)
DCGM_FI_DEV_FB_FREE       - Framebuffer free (MiB)
DCGM_FI_DEV_GPU_TEMP      - GPU temperature (C)
DCGM_FI_DEV_POWER_USAGE   - Power usage (W)
DCGM_FI_DEV_SM_CLOCK      - SM clock (MHz)
DCGM_FI_DEV_MEM_CLOCK     - Memory clock (MHz)
```

## Build & Deploy

```bash
# Build for linux/amd64 (required for RunPod)
make template-build DOCKER_USERNAME=yourusername

# Push to Docker Hub
make template-push DOCKER_USERNAME=yourusername
```

## How It Works

### Slurm Dynamic Node Registration (v22.05+)

The template uses Slurm 23.11's dynamic node registration feature:

1. **Head node** generates `slurm.conf` with `MaxNodeCount=100` and `Nodes=ALL` partition
2. **Workers** run `slurmd -Z --conf-server=<head>:6817 --conf "NodeName=... CPUs=... RealMemory=..."`
3. Workers **self-register** with the controller - no manual config updates needed
4. As workers boot, they automatically appear in `sinfo` output

### Munge Authentication

All pods from the same Docker image share a pre-baked munge key, enabling inter-node authentication without additional setup.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  HEAD NODE (NODE_ROLE=head)                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │  slurmctld  │ │   slurmd    │ │  gpu-metrics.py │   │
│  │   :6817     │ │   :6818     │ │     :9400       │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
│                                  ┌─────────────────┐   │
│                                  │ slurm-exporter  │   │
│                                  │     :9341       │   │
│                                  └─────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                    configless
                          │
┌─────────────────────────▼───────────────────────────────┐
│  WORKER NODE (NODE_ROLE=worker)                        │
│  ┌─────────────┐ ┌─────────────────┐                   │
│  │   slurmd    │ │  gpu-metrics.py │                   │
│  │   :6818     │ │     :9400       │                   │
│  └─────────────┘ └─────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

## Testing

```bash
# SSH to head node
ssh root@<pod-ip> -p <port>

# Check cluster status
sinfo -N -l

# Submit a test job
sbatch --wrap="nvidia-smi && hostname"

# Check GPU metrics
curl http://localhost:9400/metrics

# Check Slurm metrics (head only)
curl http://localhost:9341/metrics
```

## Sources

- [Slurm Configless Mode](https://slurm.schedmd.com/configless_slurm.html)
- [Prometheus Slurm Exporter](https://github.com/vpenso/prometheus-slurm-exporter)
