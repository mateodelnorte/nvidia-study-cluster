# =============================================================================
# GPU Watchdog - RunPod Pod Template with Slurm + GPU Metrics + vLLM
# =============================================================================
# Extends stock RunPod PyTorch image with:
# - Slurm workload manager
# - GPU metrics exporter (nvidia-smi based)
# - Munge authentication
# - vLLM for serving NVIDIA Nemotron-3 (optional, enabled via ENABLE_VLLM=true)
#
# Build:
#   docker build --platform linux/amd64 -t <username>/gpu-watchdog-pod:latest .
# =============================================================================

FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

LABEL maintainer="GPU Watchdog Project"
LABEL description="RunPod pod template with Slurm, GPU metrics, and vLLM"
LABEL version="4.0.0"

# Install build dependencies for Slurm from source
RUN apt-get update && apt-get install -y --no-install-recommends \
    munge \
    libmunge-dev \
    libmunge2 \
    golang-go \
    git \
    curl \
    build-essential \
    wget \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Build and install Slurm 23.11 from source for dynamic node support
ARG SLURM_VERSION=23.11.10
RUN wget -q https://download.schedmd.com/slurm/slurm-${SLURM_VERSION}.tar.bz2 && \
    tar xjf slurm-${SLURM_VERSION}.tar.bz2 && \
    cd slurm-${SLURM_VERSION} && \
    ./configure --prefix=/usr --sysconfdir=/etc/slurm --with-munge && \
    make -j$(nproc) && \
    make install && \
    cd .. && rm -rf slurm-${SLURM_VERSION} slurm-${SLURM_VERSION}.tar.bz2

# Pre-generate munge key (same key for all nodes from this image)
# All pods built from this image share the same munge key for authentication
RUN dd if=/dev/urandom bs=1 count=1024 2>/dev/null | base64 | head -c 1024 > /etc/munge/munge.key.default && \
    chmod 400 /etc/munge/munge.key.default

# Build prometheus-slurm-exporter
RUN git clone --depth 1 https://github.com/vpenso/prometheus-slurm-exporter.git /tmp/slurm-exporter && \
    cd /tmp/slurm-exporter && \
    go build -o /usr/local/bin/prometheus-slurm-exporter && \
    rm -rf /tmp/slurm-exporter /root/go

# =============================================================================
# vLLM for serving Nemotron-3
# =============================================================================
# Install vLLM with CUDA support
RUN pip install --no-cache-dir vllm>=0.12.0 huggingface_hub

# Download the Nemotron reasoning parser (needed for tool calling)
RUN mkdir -p /workspace/vllm && \
    curl -sL https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16/raw/main/nano_v3_reasoning_parser.py \
    -o /workspace/vllm/nano_v3_reasoning_parser.py

# Create workspace directories
RUN mkdir -p /workspace/logs /workspace/scripts

# Copy GPU metrics server
COPY dcgm-metrics-server.py /workspace/scripts/gpu-metrics.py
RUN chmod +x /workspace/scripts/gpu-metrics.py

# Copy startup script
COPY start.sh /pre_start.sh
RUN chmod +x /pre_start.sh

WORKDIR /workspace

# Expose ports: GPU metrics, Slurm metrics, vLLM
EXPOSE 9400 9341 8000

# Don't override ENTRYPOINT or CMD - RunPod's base image handles startup
# /pre_start.sh is automatically executed before the pod becomes ready
