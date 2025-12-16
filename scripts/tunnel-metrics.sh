#!/bin/bash
set -euo pipefail

# =============================================================================
# SSH Tunnel for DCGM Metrics
# =============================================================================
# Creates an SSH tunnel to forward DCGM exporter metrics from RunPod to localhost.
# This allows the local Prometheus instance to scrape GPU metrics.
#
# Usage: ./scripts/tunnel-metrics.sh <pod-ip> <ssh-port>
#
# Example: ./scripts/tunnel-metrics.sh 216.249.100.66 20092
#
# The tunnel forwards:
#   localhost:9400 -> runpod:9400 (DCGM Exporter metrics)
# =============================================================================

if [ $# -lt 2 ]; then
    echo "Usage: $0 <pod-ip> <ssh-port>"
    echo ""
    echo "Arguments:"
    echo "  pod-ip    - The public IP of the RunPod pod"
    echo "  ssh-port  - The SSH port (RunPod uses dynamic ports)"
    echo ""
    echo "Example:"
    echo "  $0 216.249.100.66 20092"
    echo ""
    echo "Find these values in the RunPod console or via:"
    echo "  terraform -chdir=terraform output head_node_ssh_command"
    exit 1
fi

POD_IP="$1"
SSH_PORT="$2"
LOCAL_PORT="${3:-9400}"
REMOTE_PORT="${4:-9400}"

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"

echo "=== DCGM Metrics SSH Tunnel ==="
echo ""
echo "Configuration:"
echo "  Pod IP:      ${POD_IP}"
echo "  SSH Port:    ${SSH_PORT}"
echo "  SSH Key:     ${SSH_KEY}"
echo "  Local Port:  ${LOCAL_PORT}"
echo "  Remote Port: ${REMOTE_PORT}"
echo ""

# Check if SSH key exists
if [ ! -f "${SSH_KEY}" ]; then
    echo "ERROR: SSH key not found at ${SSH_KEY}"
    echo "Set SSH_KEY environment variable to specify a different key."
    exit 1
fi

# Check if port is already in use
if lsof -i ":${LOCAL_PORT}" &>/dev/null; then
    echo "WARNING: Port ${LOCAL_PORT} is already in use."
    echo "This might mean the tunnel is already running."
    echo ""
    echo "To check: lsof -i :${LOCAL_PORT}"
    echo "To kill:  kill \$(lsof -t -i :${LOCAL_PORT})"
    echo ""
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Starting SSH tunnel..."
echo "  Forwarding localhost:${LOCAL_PORT} -> ${POD_IP}:${REMOTE_PORT}"
echo ""
echo "Press Ctrl+C to stop the tunnel."
echo ""

# Create the SSH tunnel
# -N = Don't execute remote command (tunnel only)
# -L = Local port forwarding
# -o StrictHostKeyChecking=no = Don't prompt for host key verification
# -o ServerAliveInterval=60 = Send keepalive every 60s
# -o ServerAliveCountMax=3 = Close connection after 3 missed keepalives
ssh -N \
    -L "${LOCAL_PORT}:localhost:${REMOTE_PORT}" \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o ServerAliveInterval=60 \
    -o ServerAliveCountMax=3 \
    -i "${SSH_KEY}" \
    -p "${SSH_PORT}" \
    "root@${POD_IP}"
