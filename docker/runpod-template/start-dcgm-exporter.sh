#!/bin/bash
# =============================================================================
# Start NVIDIA DCGM Exporter
# =============================================================================
# This script starts the official NVIDIA DCGM Exporter in the background.
# Called automatically when the RunPod container starts via /pre_start.sh hook.
# =============================================================================

set -e

LOG_FILE="/workspace/logs/dcgm-exporter.log"
PID_FILE="/var/run/dcgm-exporter.pid"

# Create log directory
mkdir -p /workspace/logs

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "DCGM Exporter already running (PID: $OLD_PID)"
        exit 0
    fi
    rm -f "$PID_FILE"
fi

# Start nv-hostengine (DCGM daemon) if not running
if ! pgrep -x "nv-hostengine" > /dev/null; then
    echo "Starting nv-hostengine..."
    nv-hostengine -d
    sleep 2
fi

# Start dcgm-exporter
echo "Starting DCGM Exporter on port 9400..."
nohup /usr/local/bin/dcgm-exporter \
    --address ":9400" \
    --collect-interval 5000 \
    -f /etc/dcgm-exporter/dcp-metrics-included.csv \
    > "$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"

# Wait and verify
sleep 3
if curl -s http://localhost:9400/metrics | grep -q "DCGM_FI"; then
    echo "DCGM Exporter started successfully (PID: $(cat $PID_FILE))"
    echo "Metrics available at http://localhost:9400/metrics"
    echo "Log file: $LOG_FILE"
else
    echo "WARNING: DCGM Exporter may not be running correctly"
    echo "Check log file: $LOG_FILE"
    cat "$LOG_FILE"
fi
