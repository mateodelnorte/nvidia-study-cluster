---
title: "03: Slurm Cluster Setup"
created: 2025-12-15
modified: 2025-12-16
status: active
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
- [ ] Configure multi-node Slurm (worker connects to head)
- [ ] Test job submission across nodes
- [ ] Document Slurm commands for demo

## Current Status

### Completed (2025-12-16)

**Single-Node Slurm Working:**
- Slurm installed in `mateodelnorte/gpu-watchdog-pod:latest` Docker image
- `slurmctld` and `slurmd` running on head node
- `prometheus-slurm-exporter` exposing metrics at `:9341`
- Frontend displays:
  - Total/Allocated/Idle CPUs (256 vCPUs)
  - Node status table
  - Job queue stats (pending, running, completed, failed)

**Metrics Available:**
```
slurm_cpus_total 256
slurm_cpus_idle 256
slurm_cpus_alloc 0
slurm_nodes_idle 1
slurm_queue_pending 0
slurm_queue_running 0
```

### Remaining Work

**Multi-Node Configuration:**
Currently each pod runs its own independent Slurm. To have a true cluster:

1. Head node runs `slurmctld` (controller)
2. Worker nodes run `slurmd` (compute daemon) pointing to head
3. Shared configuration via `slurm.conf`
4. Network connectivity between pods (RunPod internal network or public IPs)

## Architecture

### Current (Single-Node)

```
HEAD POD                          WORKER POD
┌─────────────────────┐          ┌─────────────────────┐
│ slurmctld          │          │ slurmctld          │
│ slurmd             │          │ slurmd             │
│ slurm-exporter:9341│          │ (no exporter)      │
│                    │          │                    │
│ [1 node cluster]   │          │ [1 node cluster]   │
└─────────────────────┘          └─────────────────────┘
      Independent                      Independent
```

### Target (Multi-Node)

```
HEAD POD                          WORKER POD
┌─────────────────────┐          ┌─────────────────────┐
│ slurmctld ◄────────────────────┤ slurmd             │
│ slurmd             │          │                    │
│ slurm-exporter:9341│          │                    │
│                    │          │                    │
│ [controller]       │ network  │ [compute node]     │
└─────────────────────┘          └─────────────────────┘
              └──── 2-node cluster ────┘
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
- [ ] Multi-node cluster functional
- [ ] Jobs can be submitted and scheduled
- [ ] Worker node appears in sinfo

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
