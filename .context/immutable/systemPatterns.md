# System Patterns

This project will adhere to the following architectural patterns:

1.  **Infrastructure as Code (IaC):** All cloud infrastructure (the RunPod GPU pods) will be provisioned declaratively using **Terraform**. This ensures repeatability and demonstrates core SRE principles.

2.  **Split Architecture Model:** We implement a cost-effective architecture that places workloads where they belong:
    *   **GPU Compute Plane (RunPod Pods):** GPU-intensive workloads and DCGM metrics export only. RunPod is optimized for GPU compute, not general services.
    *   **Service Plane (Local Docker Compose):** Observability stack (Prometheus, Grafana), Backend API, and Frontend. These don't require GPU and run locally or on standard cloud infrastructure.

    **Rationale:** RunPod does not support Docker Compose inside pods (pods are already Docker containers). Rather than fighting the platform, we use each tool for its strengths.

3.  **Workload Orchestration:**
    *   **Service Plane:** Local Docker Compose manages Prometheus, Grafana, and application services
    *   **Compute Plane:** Slurm manages ephemeral GPU workloads via `sbatch` job submissions on RunPod

4.  **Observability Stack:** A standard, industry-recognized observability stack:
    *   **Metrics Collection:** NVIDIA DCGM Exporter (runs on GPU pods)
    *   **Metrics Transport:** SSH tunnel from local to RunPod (secure, no public exposure)
    *   **Metrics Storage:** Prometheus (runs locally)
    *   **Visualization:** Grafana (runs locally)

5.  **Security Pattern:** GPU metrics are not exposed publicly. Instead, an SSH tunnel forwards metrics from RunPod pods to the local Prometheus instance, keeping the attack surface minimal.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  LOCAL / CLOUD VM                                           │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Frontend   │  │  Backend    │  │  Grafana    │         │
│  │  (React)    │  │  (Express)  │  │  Dashboard  │         │
│  └─────────────┘  └─────────────┘  └──────┬──────┘         │
│                                           │                 │
│                                    ┌──────▼──────┐         │
│                                    │ Prometheus  │         │
│                                    └──────┬──────┘         │
│                                           │ SSH tunnel     │
└───────────────────────────────────────────┼─────────────────┘
                                            │
┌───────────────────────────────────────────┼─────────────────┐
│  RUNPOD POD (GPU)                         │                 │
│                                    ┌──────▼──────┐         │
│                                    │DCGM Exporter│         │
│                                    │   :9400     │         │
│                                    └─────────────┘         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Slurm-managed GPU Workloads                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│                         A100 GPU                            │
└─────────────────────────────────────────────────────────────┘
```

## Decision Record

| Date | Decision | Context |
|------|----------|---------|
| 2025-12-14 | Use Terraform for RunPod provisioning | IaC best practice, reproducible infrastructure |
| 2025-12-15 | Split architecture (GPU on RunPod, services local) | RunPod doesn't support Docker Compose; cost optimization |
| 2025-12-15 | SSH tunnel for metrics transport | Security - no public exposure of metrics endpoints |
