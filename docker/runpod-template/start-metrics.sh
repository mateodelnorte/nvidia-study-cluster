#!/bin/bash
# =============================================================================
# Start GPU Metrics Server
# =============================================================================
# This script starts the DCGM metrics exporter in the background.
# Called automatically when the RunPod container starts.
# =============================================================================

set -e

METRICS_SCRIPT="/workspace/scripts/dcgm-metrics-server.py"
LOG_FILE="/workspace/logs/metrics-server.log"
PID_FILE="/var/run/metrics-server.pid"

# Create log directory
mkdir -p /workspace/logs

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Metrics server already running (PID: $OLD_PID)"
        exit 0
    fi
    rm -f "$PID_FILE"
fi

# Start the metrics server
echo "Starting GPU metrics server..."
nohup python3 "$METRICS_SCRIPT" > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "Metrics server started (PID: $(cat $PID_FILE))"
echo "Metrics available at http://localhost:9400/metrics"
echo "Log file: $LOG_FILE"
