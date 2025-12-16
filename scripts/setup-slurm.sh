#!/bin/bash
set -euo pipefail

# =============================================================================
# Declarative Slurm Setup for Multi-Node GPU Cluster
# =============================================================================
# This script configures Slurm based on environment variables:
#   - NODE_ROLE: "head" or "worker"
#   - CLUSTER_NAME: Name for the Slurm cluster
#   - HEAD_ADDR: IP address of head node (required for workers)
#   - HEAD_HOSTNAME: Hostname of head node (required for workers)
#
# Node discovery is automatic via /etc/slurm/nodes.d/ directory
# =============================================================================

CLUSTER_NAME="${CLUSTER_NAME:-gpu-cluster}"
NODE_ROLE="${NODE_ROLE:-}"
HEAD_ADDR="${HEAD_ADDR:-}"
HEAD_HOSTNAME="${HEAD_HOSTNAME:-}"
SLURM_CONF_DIR="/etc/slurm"
NODES_DIR="${SLURM_CONF_DIR}/nodes.d"

echo "=== Slurm Setup ==="
echo "  Cluster: ${CLUSTER_NAME}"
echo "  Role: ${NODE_ROLE:-auto-detect}"

# -----------------------------------------------------------------------------
# Auto-detect node role if not set
# -----------------------------------------------------------------------------
if [ -z "$NODE_ROLE" ]; then
    if systemctl is-active slurmctld &>/dev/null || pgrep -x slurmctld &>/dev/null; then
        NODE_ROLE="head"
    else
        NODE_ROLE="worker"
    fi
    echo "  Auto-detected role: ${NODE_ROLE}"
fi

MY_HOSTNAME=$(hostname)
MY_IP=$(hostname -I | awk '{print $1}')
MY_CPUS=$(nproc)
MY_MEMORY=$(free -m | awk '/Mem:/ {print int($2 * 0.95)}')

echo "  Hostname: ${MY_HOSTNAME}"
echo "  IP: ${MY_IP}"
echo "  CPUs: ${MY_CPUS}"
echo "  Memory: ${MY_MEMORY}MB"

# Check for GPU
GPU_COUNT=0
if command -v nvidia-smi &>/dev/null; then
    GPU_COUNT=$(nvidia-smi -L 2>/dev/null | wc -l)
fi
echo "  GPUs: ${GPU_COUNT}"

# -----------------------------------------------------------------------------
# Install Slurm if needed
# -----------------------------------------------------------------------------
install_slurm() {
    if command -v slurmctld &>/dev/null && command -v slurmd &>/dev/null; then
        echo "[Slurm] Already installed"
        return 0
    fi

    echo "[Slurm] Installing..."
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        slurm-wlm slurm-wlm-basic-plugins munge

    # Generate munge key if it doesn't exist
    if [ ! -f /etc/munge/munge.key ]; then
        echo "[Munge] Generating key..."
        create-munge-key -f
    fi

    echo "[Slurm] Installed successfully"
}

# -----------------------------------------------------------------------------
# Create base slurm.conf
# -----------------------------------------------------------------------------
create_base_config() {
    local head_hostname="$1"
    local head_addr="$2"

    mkdir -p "$SLURM_CONF_DIR" "$NODES_DIR"
    mkdir -p /var/spool/slurmctld /var/spool/slurmd /run/slurm

    cat > "${SLURM_CONF_DIR}/slurm.conf" << EOF
# =============================================================================
# Slurm Configuration - Auto-generated
# Cluster: ${CLUSTER_NAME}
# Generated: $(date -Iseconds)
# =============================================================================

ClusterName=${CLUSTER_NAME}
SlurmctldHost=${head_hostname}(${head_addr})

# Process tracking
MpiDefault=none
ProctrackType=proctrack/linuxproc
ReturnToService=2

# Paths
SlurmctldPidFile=/run/slurm/slurmctld.pid
SlurmdPidFile=/run/slurm/slurmd.pid
SlurmdSpoolDir=/var/spool/slurmd
StateSaveLocation=/var/spool/slurmctld
SlurmUser=root

# Networking
SlurmctldPort=6817
SlurmdPort=6818
SwitchType=switch/none

# Scheduling
SchedulerType=sched/backfill
SelectType=select/cons_tres
SelectTypeParameters=CR_Core

# Accounting (disabled)
AccountingStorageType=accounting_storage/none
JobCompType=jobcomp/none
JobAcctGatherType=jobacct_gather/none

# Logging
SlurmctldDebug=info
SlurmdDebug=info

# Task plugin
TaskPlugin=task/none

# Include node definitions from nodes.d/
include ${NODES_DIR}/*.conf

# GPU Resource (GRES) configuration
GresTypes=gpu

# Partition - includes all nodes automatically
PartitionName=gpu Nodes=ALL Default=YES MaxTime=INFINITE State=UP
EOF

    echo "[Config] Created base slurm.conf"
}

# -----------------------------------------------------------------------------
# Register this node
# -----------------------------------------------------------------------------
register_node() {
    local node_file="${NODES_DIR}/${MY_HOSTNAME}.conf"

    # Build GRES string for GPUs
    local gres_str=""
    if [ "$GPU_COUNT" -gt 0 ]; then
        gres_str="Gres=gpu:${GPU_COUNT}"
    fi

    cat > "$node_file" << EOF
# Node: ${MY_HOSTNAME}
# Registered: $(date -Iseconds)
NodeName=${MY_HOSTNAME} NodeAddr=${MY_IP} CPUs=${MY_CPUS} RealMemory=${MY_MEMORY} ${gres_str} State=UNKNOWN
EOF

    echo "[Node] Registered ${MY_HOSTNAME} -> ${node_file}"

    # Create GRES config for GPUs
    if [ "$GPU_COUNT" -gt 0 ]; then
        cat > "${SLURM_CONF_DIR}/gres.conf" << EOF
# GPU GRES Configuration
# Auto-generated for ${MY_HOSTNAME}
Name=gpu Count=${GPU_COUNT}
EOF
        echo "[GRES] Configured ${GPU_COUNT} GPU(s)"
    fi
}

# -----------------------------------------------------------------------------
# Sync configuration from head node
# -----------------------------------------------------------------------------
sync_from_head() {
    if [ -z "$HEAD_ADDR" ] || [ -z "$HEAD_HOSTNAME" ]; then
        echo "[Error] HEAD_ADDR and HEAD_HOSTNAME required for workers"
        exit 1
    fi

    echo "[Sync] Fetching config from head node ${HEAD_ADDR}..."

    # Copy slurm.conf from head
    scp -o StrictHostKeyChecking=no "root@${HEAD_ADDR}:${SLURM_CONF_DIR}/slurm.conf" "${SLURM_CONF_DIR}/"

    # Copy munge key
    scp -o StrictHostKeyChecking=no "root@${HEAD_ADDR}:/etc/munge/munge.key" "/etc/munge/"
    chown munge:munge /etc/munge/munge.key
    chmod 400 /etc/munge/munge.key

    # Copy all node definitions
    mkdir -p "$NODES_DIR"
    scp -o StrictHostKeyChecking=no "root@${HEAD_ADDR}:${NODES_DIR}/*.conf" "${NODES_DIR}/" 2>/dev/null || true

    echo "[Sync] Configuration synchronized"
}

# -----------------------------------------------------------------------------
# Start services
# -----------------------------------------------------------------------------
start_services() {
    echo "[Services] Starting Munge..."
    pkill -9 munged 2>/dev/null || true
    sleep 1
    munged --force

    if [ "$NODE_ROLE" = "head" ]; then
        echo "[Services] Starting Slurm Controller (slurmctld)..."
        pkill -9 slurmctld 2>/dev/null || true
        sleep 1
        slurmctld

        # Also start slurmd on head if it has CPUs/GPUs
        echo "[Services] Starting Slurm Daemon (slurmd) on head..."
        pkill -9 slurmd 2>/dev/null || true
        sleep 1
        slurmd
    else
        echo "[Services] Starting Slurm Daemon (slurmd)..."
        pkill -9 slurmd 2>/dev/null || true
        sleep 1
        slurmd
    fi
}

# -----------------------------------------------------------------------------
# Main logic
# -----------------------------------------------------------------------------
install_slurm

if [ "$NODE_ROLE" = "head" ]; then
    echo ""
    echo "=== Configuring HEAD node ==="
    create_base_config "$MY_HOSTNAME" "$MY_IP"
    register_node
    start_services

    echo ""
    echo "=== Head Node Ready ==="
    echo "  Run on workers: HEAD_ADDR=${MY_IP} HEAD_HOSTNAME=${MY_HOSTNAME} NODE_ROLE=worker ./setup-slurm.sh"

else
    echo ""
    echo "=== Configuring WORKER node ==="

    if [ -z "$HEAD_ADDR" ]; then
        echo "[Error] HEAD_ADDR environment variable required"
        echo "Usage: HEAD_ADDR=x.x.x.x HEAD_HOSTNAME=hostname NODE_ROLE=worker ./setup-slurm.sh"
        exit 1
    fi

    # First register this node on the head
    echo "[Worker] Registering node on head..."

    # Create local node file
    mkdir -p "$NODES_DIR"
    local_node_file="${NODES_DIR}/${MY_HOSTNAME}.conf"
    gres_str=""
    if [ "$GPU_COUNT" -gt 0 ]; then
        gres_str="Gres=gpu:${GPU_COUNT}"
    fi

    cat > "$local_node_file" << EOF
NodeName=${MY_HOSTNAME} NodeAddr=${MY_IP} CPUs=${MY_CPUS} RealMemory=${MY_MEMORY} ${gres_str} State=UNKNOWN
EOF

    # Copy node file to head
    scp -o StrictHostKeyChecking=no "$local_node_file" "root@${HEAD_ADDR}:${NODES_DIR}/"

    # Tell head to reconfigure
    ssh -o StrictHostKeyChecking=no "root@${HEAD_ADDR}" "scontrol reconfigure" || true

    # Now sync full config from head
    sync_from_head

    # Create local gres.conf if we have GPUs
    if [ "$GPU_COUNT" -gt 0 ]; then
        cat > "${SLURM_CONF_DIR}/gres.conf" << EOF
Name=gpu Count=${GPU_COUNT}
EOF
    fi

    start_services

    echo ""
    echo "=== Worker Node Ready ==="
fi

# Verify
sleep 2
echo ""
echo "=== Cluster Status ==="
sinfo -N -l 2>/dev/null || echo "(sinfo not available - run on head node)"
