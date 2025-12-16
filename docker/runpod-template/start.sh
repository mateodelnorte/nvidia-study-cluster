#!/bin/bash
# GPU Watchdog - Pre-start script for RunPod pods
# Starts GPU metrics exporter and configures Slurm

# Don't exit on errors - we want to continue even if some parts fail
set +e

LOG_DIR="/workspace/logs"
mkdir -p "$LOG_DIR"

# =============================================================================
# GPU Metrics Exporter
# =============================================================================
echo "Starting GPU metrics exporter on port 9400..."
nohup python3 /workspace/scripts/gpu-metrics.py > "$LOG_DIR/gpu-metrics.log" 2>&1 &
sleep 3

if curl -s http://localhost:9400/metrics | grep -q "DCGM"; then
    echo "GPU metrics exporter started successfully"
else
    echo "WARNING: GPU metrics exporter may not be running"
    cat "$LOG_DIR/gpu-metrics.log" 2>/dev/null || true
fi

# =============================================================================
# Slurm Configuration (single-node mode)
# =============================================================================
HOSTNAME=$(hostname)
IP=$(hostname -I | awk '{print $1}')
CPUS=$(nproc)

echo "Configuring Slurm for node: $HOSTNAME ($IP) with $CPUS CPUs"

# Create slurm directories
mkdir -p /var/spool/slurmctld /var/spool/slurmd /var/log/slurm /run/slurm
chown -R root:root /var/spool/slurmctld /var/spool/slurmd /var/log/slurm

# Generate slurm.conf
cat > /etc/slurm/slurm.conf << EOF
ClusterName=gpu-watchdog
SlurmctldHost=$HOSTNAME($IP)
MpiDefault=none
ProctrackType=proctrack/linuxproc
ReturnToService=2
SlurmctldPidFile=/run/slurm/slurmctld.pid
SlurmctldPort=6817
SlurmdPidFile=/run/slurm/slurmd.pid
SlurmdPort=6818
SlurmdSpoolDir=/var/spool/slurmd
SlurmUser=root
StateSaveLocation=/var/spool/slurmctld
SwitchType=switch/none
TaskPlugin=task/none
SchedulerType=sched/backfill
SelectType=select/cons_tres
SelectTypeParameters=CR_Core
AccountingStorageType=accounting_storage/none
JobCompType=jobcomp/none
JobAcctGatherType=jobacct_gather/none
SlurmctldDebug=info
SlurmdDebug=info
# Node configuration
NodeName=$HOSTNAME NodeAddr=$IP CPUs=$CPUS RealMemory=64000 State=UNKNOWN
# Partition
PartitionName=gpu Nodes=$HOSTNAME Default=YES MaxTime=INFINITE State=UP
EOF

# Configure munge (key must be at least 32 bytes)
echo "Configuring munge..."
mkdir -p /var/log/munge /var/lib/munge /run/munge
dd if=/dev/urandom bs=1 count=1024 2>/dev/null | base64 | head -c 1024 > /etc/munge/munge.key
chmod 400 /etc/munge/munge.key
chown -R munge:munge /etc/munge /var/log/munge /var/lib/munge /run/munge

# Start munge
echo "Starting munge..."
runuser -u munge -- /usr/sbin/munged --force 2>&1 || echo "Munge start warning (may be ok)"
sleep 1

# Only start slurmctld on head node
if [ "$NODE_ROLE" = "head" ]; then
    echo "Starting slurmctld (head node)..."
    /usr/sbin/slurmctld > "$LOG_DIR/slurmctld.log" 2>&1 &
    sleep 2
fi

# Start slurmd on all nodes
echo "Starting slurmd..."
/usr/sbin/slurmd > "$LOG_DIR/slurmd.log" 2>&1 &
sleep 2

# Verify Slurm
echo "Slurm status:"
sinfo 2>&1 || echo "Slurm not fully ready yet (this is ok on worker nodes)"

# =============================================================================
# Prometheus Slurm Exporter (only on head node)
# =============================================================================
if [ "$NODE_ROLE" = "head" ]; then
    echo "Starting prometheus-slurm-exporter on port 9341..."
    nohup /usr/local/bin/prometheus-slurm-exporter --listen-address=:9341 > "$LOG_DIR/slurm-exporter.log" 2>&1 &
    sleep 2
    if curl -s http://localhost:9341/metrics | grep -q "slurm_"; then
        echo "Slurm exporter started successfully"
    else
        echo "WARNING: Slurm exporter may not be running"
    fi
fi

echo "Pre-start complete"
