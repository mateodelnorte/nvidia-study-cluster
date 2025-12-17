---
title: "03: Slurm Cluster Setup"
created: 2025-12-15
modified: 2025-12-16
status: done
priority: high
owner: mattwwalters
assignee: claude-agent
tags: [slurm, cluster, gpu, scheduling, metrics]
dependencies: [01-terraform-runpod-setup, 02-docker-compose-services]
---

## Overview

Configure Slurm workload manager on the RunPod GPU cluster to enable job scheduling and demonstrate enterprise GPU cluster management patterns.

## Goals

- [x] Install Slurm in custom Docker image
- [x] Configure single-node Slurm on head node
- [x] Add prometheus-slurm-exporter for metrics
- [x] Expose Slurm metrics on port 9341
- [x] Display Slurm metrics in frontend dashboard
- [x] Configure multi-node Slurm (worker connects to head via global networking)
- [x] Test job submission across nodes
- [x] Document Slurm commands for demo

## Current Status

### Completed (2025-12-16)

**Multi-Node Slurm Cluster Working:**
- 2-node Slurm cluster with 512 total CPUs (256 per node)
- Head runs `slurmctld` (controller) + `slurmd`
- Worker runs `slurmd` with configless mode (`-Z --conf-server`)
- Worker connects to head via `POD_ID.runpod.internal` (global networking)
- `prometheus-slurm-exporter` exposing metrics at `:9341`
- Frontend displays all cluster metrics

**Metrics Available:**
```
slurm_cpus_total 512
slurm_cpus_idle 512
slurm_nodes_total 2
slurm_nodes_idle 2
slurm_queue_pending 0
slurm_queue_running 0
```

**Key Implementation Details:**
- Terraform enables `global_networking = true` for both pods
- deploy.sh passes head's pod ID to worker as `HEAD_NODE_IP`
- start.sh uses `slurmd -Z --conf-server=POD_ID.runpod.internal:6817`
- Munge key is pre-baked in Docker image (same for all pods)

## Architecture

### Current (Multi-Node with Global Networking)

```
HEAD POD                                    WORKER POD
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│ slurmctld (controller)          │◀──────│ slurmd (compute daemon)         │
│ slurmd (compute daemon)         │       │ GPU metrics server :9400        │
│ prometheus-slurm-exporter :9341 │       │                                 │
│ GPU metrics server :9400        │       │ Connects via:                   │
│                                 │       │ POD_ID.runpod.internal:6817     │
│ IP: 10.x.x.x (global network)   │       │ IP: 10.x.x.x (global network)   │
└─────────────────────────────────┘       └─────────────────────────────────┘
                    └────────────── 2-node cluster ──────────────┘
                          RunPod Global Networking (100 Mbps)
```

## Implementation Details

### Docker Image Components

The custom RunPod image (`docker/runpod-template/Dockerfile`) includes:

```dockerfile
# Slurm packages
RUN apt-get install -y slurm-wlm slurm-client munge

# Prometheus exporter
RUN go install github.com/vpenso/prometheus-slurm-exporter@latest

# Configuration
COPY slurm.conf /etc/slurm/slurm.conf
COPY start-slurm.sh /start-slurm.sh
```

### Slurm Configuration (`slurm.conf`)

```conf
ClusterName=gpu-watchdog
SlurmctldHost=localhost  # Change for multi-node
MpiDefault=none
ProctrackType=proctrack/linuxproc
ReturnToService=1
SlurmctldPidFile=/run/slurmctld.pid
SlurmdPidFile=/run/slurmd.pid
SlurmdSpoolDir=/var/spool/slurmd
StateSaveLocation=/var/spool/slurmctld
SwitchType=switch/none
TaskPlugin=task/none

# Scheduling
SchedulerType=sched/backfill
SelectType=select/cons_tres
SelectTypeParameters=CR_Core

# Logging
SlurmctldDebug=info
SlurmdDebug=info

# Node definitions
NodeName=localhost CPUs=256 State=UNKNOWN
PartitionName=gpu Nodes=ALL Default=YES MaxTime=INFINITE State=UP
```

### Start Script (`start-slurm.sh`)

```bash
#!/bin/bash
# Start Munge (authentication)
munged -f

# Start Slurm controller
slurmctld

# Start Slurm daemon
slurmd

# Start exporter
prometheus-slurm-exporter --listen-address=:9341 &
```

## Multi-Node Setup (TODO)

### Required Changes

1. **Networking:** Pods need to communicate
   - Option A: Use RunPod internal network
   - Option B: Use public IPs with firewall rules

2. **Configuration:**
   ```conf
   # Head node slurm.conf
   SlurmctldHost=<head-ip>
   NodeName=head CPUs=256 State=UNKNOWN
   NodeName=worker CPUs=256 State=UNKNOWN
   ```

3. **Munge Key:** Same key on all nodes for authentication

4. **Startup Order:**
   - Head starts first (slurmctld)
   - Workers start after (slurmd only)

### Verification Commands

```bash
# Check cluster status
sinfo

# Check node status
scontrol show nodes

# Submit test job
srun hostname

# Check queue
squeue
```

## Success Criteria

- [x] Slurm metrics visible in frontend
- [x] Node status displayed
- [x] Job queue stats shown
- [x] Multi-node cluster functional (2 nodes, 512 CPUs)
- [x] Jobs can be submitted and scheduled
- [x] Worker node appears in sinfo

## Interview Talking Points

1. **Workload Management:** "I configured Slurm, the same scheduler used by most TOP500 supercomputers, demonstrating familiarity with enterprise GPU cluster patterns."

2. **Observability:** "Integrated prometheus-slurm-exporter to expose scheduler metrics, enabling visibility into job queues and resource utilization."

3. **Architecture Trade-offs:** "In a real production environment, Slurm would manage job scheduling across hundreds of nodes. Here I demonstrate the same patterns at smaller scale."

4. **NVIDIA Integration:** "Slurm integrates with NVIDIA's GRES (Generic Resources) for GPU-aware scheduling, ensuring jobs get the GPU resources they need."

## Related Documents

- [Task 01 README](../01-terraform-runpod-setup/README.md) - Infrastructure
- [Task 02 README](../02-docker-compose-services/README.md) - Observability
- [progress.md](../../overridable/progress.md) - Overall status

## Sources

- [Slurm Documentation](https://slurm.schedmd.com/documentation.html)
- [prometheus-slurm-exporter](https://github.com/vpenso/prometheus-slurm-exporter)
- [Slurm GPU Scheduling](https://slurm.schedmd.com/gres.html)
