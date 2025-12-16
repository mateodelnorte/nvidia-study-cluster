# =============================================================================
# GPU Watchdog - RunPod Pod Template with Slurm + GPU Metrics
# =============================================================================
# Extends stock RunPod PyTorch image with:
# - Slurm workload manager
# - GPU metrics exporter (nvidia-smi based)
# - Munge authentication
#
# Build:
#   docker build --platform linux/amd64 -t <username>/gpu-watchdog-pod:latest .
# =============================================================================

FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

LABEL maintainer="GPU Watchdog Project"
LABEL description="RunPod pod template with Slurm and GPU metrics"
LABEL version="3.0.0"

# Install Slurm, munge, golang (for slurm exporter), and utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    slurm-wlm \
    munge \
    golang-go \
    git \
    && rm -rf /var/lib/apt/lists/*

# Build prometheus-slurm-exporter
RUN git clone --depth 1 https://github.com/vpenso/prometheus-slurm-exporter.git /tmp/slurm-exporter && \
    cd /tmp/slurm-exporter && \
    go build -o /usr/local/bin/prometheus-slurm-exporter && \
    rm -rf /tmp/slurm-exporter /root/go

# Create workspace directories
RUN mkdir -p /workspace/logs /workspace/scripts

# Copy GPU metrics server
COPY dcgm-metrics-server.py /workspace/scripts/gpu-metrics.py
RUN chmod +x /workspace/scripts/gpu-metrics.py

# Copy startup script
COPY start.sh /pre_start.sh
RUN chmod +x /pre_start.sh

WORKDIR /workspace

# Expose metrics ports
EXPOSE 9400 9341

# Don't override ENTRYPOINT or CMD - RunPod's base image handles startup
# /pre_start.sh is automatically executed before the pod becomes ready
