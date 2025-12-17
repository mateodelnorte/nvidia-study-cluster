#!/bin/bash
# =============================================================================
# GPU Watchdog - Slurm Configless Mode Setup
# =============================================================================
# Uses Slurm's built-in configless mode (v20.11+) for automatic cluster config.
#
# Environment variables (set via Terraform/deploy.sh):
#   NODE_ROLE:    "head" or "worker" (required)
#   HEAD_NODE_IP: Address of head node (required for workers)
#                 Use POD_ID.runpod.internal for cross-machine communication
#   CLUSTER_NAME: Name of the cluster (default: gpu-watchdog)
#   WORKER_NODES: Comma-separated "hostname:ip" pairs (optional, for head)
#
# How configless mode works:
#   1. Head node runs slurmctld with --enable-configless
#   2. Workers run slurmd with --conf-server=<head>:6817
#   3. Workers automatically fetch config from head on startup
#   4. No need for config file distribution or custom registration
# =============================================================================

set +e
LOG_DIR="/workspace/logs"
mkdir -p "$LOG_DIR"

NODE_ROLE="${NODE_ROLE:-head}"
CLUSTER_NAME="${CLUSTER_NAME:-gpu-watchdog}"
HEAD_NODE_IP="${HEAD_NODE_IP:-}"
WORKER_NODES="${WORKER_NODES:-}"

MY_HOSTNAME=$(hostname)
MY_IP=$(hostname -I | awk '{print $1}')
CPUS=$(nproc)
MEMORY=$(free -m | awk '/Mem:/ {print int($2 * 0.95)}')

log() { echo "[$(date '+%H:%M:%S')] $*"; }

log "=========================================="
log "GPU Watchdog - Slurm Configless Setup"
log "=========================================="
log "  Role:     $NODE_ROLE"
log "  Cluster:  $CLUSTER_NAME"
log "  Hostname: $MY_HOSTNAME"
log "  IP:       $MY_IP"
log "  CPUs:     $CPUS"
log "  Memory:   ${MEMORY}MB"
[ -n "$WORKER_NODES" ] && log "  Workers:  $WORKER_NODES"
log ""

# =============================================================================
# 1. GPU Metrics Exporter
# =============================================================================
log "[1/3] Starting GPU metrics exporter..."
nohup python3 /workspace/scripts/gpu-metrics.py > "$LOG_DIR/gpu-metrics.log" 2>&1 &
sleep 2
if curl -s http://localhost:9400/metrics | grep -q "DCGM"; then
    log "      OK - http://localhost:9400/metrics"
else
    log "      WARN - may not be running"
fi

# =============================================================================
# 2. Munge Authentication
# =============================================================================
log ""
log "[2/3] Setting up munge..."
mkdir -p /var/log/munge /var/lib/munge /run/munge /etc/munge

# Use pre-baked munge key (same in all pods from this image)
if [ -f /etc/munge/munge.key.default ]; then
    cp /etc/munge/munge.key.default /etc/munge/munge.key
else
    dd if=/dev/urandom bs=1 count=1024 2>/dev/null | base64 | head -c 1024 > /etc/munge/munge.key
fi
chmod 400 /etc/munge/munge.key
chown -R munge:munge /etc/munge /var/log/munge /var/lib/munge /run/munge

pkill -9 munged 2>/dev/null || true
sleep 1
runuser -u munge -- /usr/sbin/munged --force 2>&1 || true
log "      OK"

# =============================================================================
# 3. Slurm Setup
# =============================================================================
log ""
log "[3/3] Starting Slurm..."
mkdir -p /var/spool/slurmctld /var/spool/slurmd /var/log/slurm /run/slurm /etc/slurm

pkill -9 slurmctld slurmd 2>/dev/null || true
sleep 1

if [ "$NODE_ROLE" = "head" ]; then
    # =========================================================================
    # HEAD NODE: Generate config and start slurmctld
    # =========================================================================
    log "      Mode: Controller (head)"

    # Build node definitions
    NODE_DEFS="NodeName=${MY_HOSTNAME} NodeAddr=${MY_IP} CPUs=${CPUS} RealMemory=${MEMORY} State=UNKNOWN"
    ALL_NODES="${MY_HOSTNAME}"

    # Add worker nodes if pre-defined via WORKER_NODES env var
    if [ -n "$WORKER_NODES" ]; then
        IFS=',' read -ra WORKERS <<< "$WORKER_NODES"
        for worker in "${WORKERS[@]}"; do
            W_HOSTNAME=$(echo "$worker" | cut -d: -f1)
            W_IP=$(echo "$worker" | cut -d: -f2)
            W_CPUS=$(echo "$worker" | cut -d: -f3)
            W_MEM=$(echo "$worker" | cut -d: -f4)
            [ -z "$W_CPUS" ] && W_CPUS="256"
            [ -z "$W_MEM" ] && W_MEM="60000"
            NODE_DEFS="${NODE_DEFS}
NodeName=${W_HOSTNAME} NodeAddr=${W_IP} CPUs=${W_CPUS} RealMemory=${W_MEM} State=UNKNOWN"
            ALL_NODES="${ALL_NODES},${W_HOSTNAME}"
        done
    fi

    cat > /etc/slurm/slurm.conf << EOF
# Auto-generated Slurm config for ${CLUSTER_NAME}
ClusterName=${CLUSTER_NAME}
SlurmctldHost=${MY_HOSTNAME}(${MY_IP})

MpiDefault=none
ProctrackType=proctrack/linuxproc
ReturnToService=2
SlurmctldPidFile=/run/slurm/slurmctld.pid
SlurmdPidFile=/run/slurm/slurmd.pid
SlurmdSpoolDir=/var/spool/slurmd
StateSaveLocation=/var/spool/slurmctld
SlurmUser=root
SlurmctldPort=6817
SlurmdPort=6818
SwitchType=switch/none
SchedulerType=sched/backfill
SelectType=select/cons_tres
SelectTypeParameters=CR_Core
AccountingStorageType=accounting_storage/none
JobCompType=jobcomp/none
JobAcctGatherType=jobacct_gather/none
SlurmctldDebug=info
SlurmdDebug=info
TaskPlugin=task/none

# Enable configless mode - workers fetch config from controller
SlurmctldParameters=enable_configless

# Dynamic nodes - allow up to 100 workers to register
MaxNodeCount=100

# Node definitions
${NODE_DEFS}

# Partition - use ALL to include dynamic nodes
PartitionName=gpu Nodes=ALL Default=YES MaxTime=INFINITE State=UP
EOF

    log "      Starting slurmctld..."
    slurmctld > "$LOG_DIR/slurmctld.log" 2>&1 &
    sleep 2

    log "      Starting slurmd..."
    slurmd > "$LOG_DIR/slurmd.log" 2>&1 &
    sleep 2

    log "      Starting prometheus-slurm-exporter (port 9341)..."
    nohup /usr/local/bin/prometheus-slurm-exporter --listen-address=:9341 > "$LOG_DIR/slurm-exporter.log" 2>&1 &

else
    # =========================================================================
    # WORKER NODE: Use configless mode to fetch config from head
    # =========================================================================
    log "      Mode: Worker"

    if [ -z "$HEAD_NODE_IP" ]; then
        log "      WARN: HEAD_NODE_IP not set"
        log "      Slurm worker will not start. GPU metrics still available."
        log "      To enable Slurm, set HEAD_NODE_IP env var and run: bash /pre_start.sh"
    else
        # Wait for head to be ready
        log "      Waiting for head node ($HEAD_NODE_IP)..."
        for i in {1..30}; do
            if curl -s --connect-timeout 2 "http://${HEAD_NODE_IP}:9400/health" | grep -q "OK"; then
                log "      Head is ready"
                break
            fi
            sleep 5
        done

        # Start slurmd with -Z for dynamic self-registration (Slurm 22.05+)
        # The worker will automatically register itself with the controller
        # NodeName is automatically derived from hostname
        log "      Starting slurmd with dynamic registration (-Z)..."
        slurmd -Z --conf-server="${HEAD_NODE_IP}:6817" \
            --conf "CPUs=${CPUS} RealMemory=${MEMORY}" \
            > "$LOG_DIR/slurmd.log" 2>&1 &
        sleep 5

        # Verify registration
        log "      Verifying registration..."
    fi
fi

# =============================================================================
# Summary
# =============================================================================
log ""
log "=========================================="
log "Startup Complete"
log "=========================================="

if [ "$NODE_ROLE" = "head" ]; then
    sleep 2
    log ""
    log "Cluster status:"
    sinfo -N -l 2>&1 || log "(Slurm starting...)"

    log ""
    log "Endpoints:"
    log "  GPU Metrics:   http://${MY_IP}:9400/metrics"
    log "  Slurm Metrics: http://${MY_IP}:9341/metrics"
    log ""
    log "For workers, set: HEAD_NODE_IP=${MY_IP}"
else
    log ""
    log "Worker joined cluster. Run 'sinfo -N' on head to verify."
fi
