#!/bin/bash
set -euo pipefail

# =============================================================================
# Setup DCGM Exporter on RunPod Pod
# =============================================================================
# This script installs NVIDIA DCGM and dcgm-exporter on a RunPod GPU pod.
# Run this after provisioning your pod with: make gpu-setup-dcgm
#
# Prerequisites:
#   - RunPod pod with NVIDIA GPU
#   - SSH access to the pod
#
# The script will:
#   1. Verify GPU is available
#   2. Install NVIDIA DCGM via apt
#   3. Download and install dcgm-exporter binary
#   4. Start dcgm-exporter on port 9400
#   5. Verify metrics are available
# =============================================================================

echo "=== DCGM Exporter Setup for RunPod ==="
echo ""

# -----------------------------------------------------------------------------
# Step 1: Verify GPU availability
# -----------------------------------------------------------------------------
echo "[1/5] Checking for NVIDIA GPU..."
if ! nvidia-smi &>/dev/null; then
    echo "ERROR: nvidia-smi not found. Is this a GPU pod?"
    exit 1
fi

GPU_INFO=$(nvidia-smi --query-gpu=name,driver_version --format=csv,noheader | head -1)
echo "  Found: ${GPU_INFO}"

# -----------------------------------------------------------------------------
# Step 2: Install DCGM
# -----------------------------------------------------------------------------
echo ""
echo "[2/5] Installing NVIDIA DCGM..."

# Add NVIDIA package repository if needed
if ! apt-cache show datacenter-gpu-manager &>/dev/null; then
    echo "  Adding NVIDIA package repository..."
    apt-get update -qq
    apt-get install -y -qq software-properties-common

    # Try to install from existing repos first
    apt-get update -qq
fi

# Install DCGM
if ! dpkg -l datacenter-gpu-manager &>/dev/null; then
    apt-get update -qq
    apt-get install -y datacenter-gpu-manager || {
        echo "  Standard install failed, trying alternative method..."
        # Download and install directly if apt fails
        DCGM_DEB_URL="https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/datacenter-gpu-manager_3.3.6-1_amd64.deb"
        wget -q "${DCGM_DEB_URL}" -O /tmp/dcgm.deb
        dpkg -i /tmp/dcgm.deb || apt-get install -f -y
        rm /tmp/dcgm.deb
    }
    echo "  DCGM installed successfully"
else
    echo "  DCGM already installed"
fi

# -----------------------------------------------------------------------------
# Step 3: Start DCGM service
# -----------------------------------------------------------------------------
echo ""
echo "[3/5] Starting DCGM service..."

# Kill any existing nv-hostengine
pkill -f nv-hostengine 2>/dev/null || true
sleep 1

# Start nv-hostengine (DCGM daemon)
nv-hostengine -d 2>/dev/null || {
    echo "  nv-hostengine may already be running, continuing..."
}

# Verify DCGM is working
sleep 2
if dcgmi discovery -l &>/dev/null; then
    echo "  DCGM service running"
    dcgmi discovery -l | head -5
else
    echo "WARNING: DCGM discovery failed, but continuing..."
fi

# -----------------------------------------------------------------------------
# Step 4: Install and start dcgm-exporter
# -----------------------------------------------------------------------------
echo ""
echo "[4/5] Installing dcgm-exporter..."

# Kill any existing dcgm-exporter
pkill -f dcgm-exporter 2>/dev/null || true
sleep 1

# Check if dcgm-exporter already exists
if [ ! -f /usr/local/bin/dcgm-exporter ]; then
    DCGM_EXPORTER_VERSION="3.3.6-3.4.2"
    DOWNLOAD_URL="https://github.com/NVIDIA/dcgm-exporter/releases/download/v${DCGM_EXPORTER_VERSION}/dcgm-exporter-${DCGM_EXPORTER_VERSION}-linux-amd64.tar.gz"

    echo "  Downloading dcgm-exporter v${DCGM_EXPORTER_VERSION}..."
    wget -q "${DOWNLOAD_URL}" -O /tmp/dcgm-exporter.tar.gz || {
        # Try older version if latest fails
        DCGM_EXPORTER_VERSION="3.3.5-3.4.1"
        DOWNLOAD_URL="https://github.com/NVIDIA/dcgm-exporter/releases/download/v${DCGM_EXPORTER_VERSION}/dcgm-exporter-${DCGM_EXPORTER_VERSION}-linux-amd64.tar.gz"
        echo "  Trying older version v${DCGM_EXPORTER_VERSION}..."
        wget -q "${DOWNLOAD_URL}" -O /tmp/dcgm-exporter.tar.gz
    }

    echo "  Extracting..."
    mkdir -p /tmp/dcgm-exporter-extract
    tar -xzf /tmp/dcgm-exporter.tar.gz -C /tmp/dcgm-exporter-extract

    # Find and copy the binary
    find /tmp/dcgm-exporter-extract -name "dcgm-exporter" -type f -exec cp {} /usr/local/bin/ \;
    chmod +x /usr/local/bin/dcgm-exporter

    # Cleanup
    rm -rf /tmp/dcgm-exporter.tar.gz /tmp/dcgm-exporter-extract
    echo "  dcgm-exporter installed to /usr/local/bin/"
else
    echo "  dcgm-exporter already installed"
fi

# Start dcgm-exporter
echo "  Starting dcgm-exporter on port 9400..."
mkdir -p /workspace/logs
nohup /usr/local/bin/dcgm-exporter --address :9400 > /workspace/logs/dcgm-exporter.log 2>&1 &
EXPORTER_PID=$!
echo "  Started with PID: ${EXPORTER_PID}"

# -----------------------------------------------------------------------------
# Step 5: Verify metrics are available
# -----------------------------------------------------------------------------
echo ""
echo "[5/5] Verifying metrics endpoint..."
sleep 3

if curl -s http://localhost:9400/metrics | grep -q "DCGM_FI"; then
    METRIC_COUNT=$(curl -s http://localhost:9400/metrics | grep -c "^DCGM_" || echo "0")
    echo ""
    echo "=============================================="
    echo "SUCCESS: DCGM Exporter is running!"
    echo "=============================================="
    echo ""
    echo "  Metrics endpoint: http://localhost:9400/metrics"
    echo "  Metrics available: ${METRIC_COUNT} DCGM metrics"
    echo "  Log file: /workspace/logs/dcgm-exporter.log"
    echo ""
    echo "Sample metrics:"
    curl -s http://localhost:9400/metrics | grep "^DCGM_FI_DEV" | head -10
    echo ""
    echo "Next steps:"
    echo "  1. On your local machine, run: make gpu-tunnel"
    echo "  2. Then run: make services-up"
    echo "  3. Open Grafana at http://localhost:3001"
else
    echo ""
    echo "=============================================="
    echo "ERROR: DCGM Exporter failed to start"
    echo "=============================================="
    echo ""
    echo "Check the log file:"
    cat /workspace/logs/dcgm-exporter.log 2>/dev/null || echo "No log file found"
    exit 1
fi
