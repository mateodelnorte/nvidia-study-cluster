# Technology Context

This project uses the following technologies:

## Infrastructure

| Technology | Purpose | Notes |
|------------|---------|-------|
| **RunPod** | GPU cloud provider | On-demand A100/H100 GPUs, Terraform integration |
| **Terraform** | Infrastructure as Code | Provisions and manages RunPod pods |
| **Docker** | Containerization | Custom pod template, local services |
| **Docker Compose** | Service orchestration | Local dev environment |

## Compute

| Technology | Purpose | Notes |
|------------|---------|-------|
| **Slurm 23.11** | Workload manager | Built from source, configless mode |
| **Munge** | Cluster authentication | Shared key baked into Docker image |
| **NVIDIA A100-SXM4-80GB** | GPU compute | Primary GPU target |

## Backend

| Technology | Purpose | Notes |
|------------|---------|-------|
| **Node.js 22** | Runtime | ES modules, TypeScript |
| **Express.js** | HTTP framework | REST API |
| **SQLite** | Database | Metrics history, alerts |
| **Drizzle ORM** | Database access | Type-safe queries |
| **Pino** | Logging | Structured JSON logs |

## Frontend

| Technology | Purpose | Notes |
|------------|---------|-------|
| **React 19** | UI framework | Functional components, hooks |
| **Vite** | Build tool | Fast HMR, ES modules |
| **TypeScript** | Type safety | Strict mode |
| **TanStack Query** | Data fetching | Caching, retries, backoff |
| **Radix UI** | Components | Accessible, themeable |
| **Tailwind CSS** | Styling | Utility-first |
| **Recharts** | Charts | Time-series visualization |
| **react-markdown** | Markdown rendering | GFM support for AI chat |

## AI Agent

| Technology | Purpose | Notes |
|------------|---------|-------|
| **vLLM 0.12.0** | LLM inference server | OpenAI-compatible API |
| **Nemotron-3-Nano-30B** | Language model | NVIDIA's MoE model, ~60GB VRAM |
| **Tool Calling** | Agent capabilities | `qwen3_coder` parser |

**Design Decision:** We use vLLM with NVIDIA's model instead of LangChain.js for simplicity. The agent implements a straightforward agentic loop without framework dependencies, making the code easier to understand and maintain.

## Observability

| Technology | Purpose | Notes |
|------------|---------|-------|
| **nvidia-smi** | GPU metrics | Custom Python exporter |
| **prometheus-slurm-exporter** | Slurm metrics | Job queue, node states |
| **Prometheus** | Metrics storage | Local, 7-day retention |
| **Grafana** | Dashboards | Pre-configured |

## Development Tools

| Technology | Purpose | Notes |
|------------|---------|-------|
| **asdf** | Version management | Node.js, Terraform versions |
| **pnpm** | Package manager | Fast, efficient |
| **Biome** | Linting/formatting | Replaces ESLint + Prettier |
| **Vitest** | Testing | Vite-native test runner |

## Key Ports

| Port | Service | Location |
|------|---------|----------|
| 3000 | Gateway (Nginx) | Local |
| 3001 | Grafana | Local |
| 8080 | Backend API | Local |
| 9090 | Prometheus | Local |
| 8000 | vLLM API | RunPod head |
| 8002 | vLLM logs server | RunPod head |
| 9400 | GPU metrics | RunPod all |
| 9341 | Slurm exporter | RunPod head |
