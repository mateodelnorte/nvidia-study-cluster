---
title: "01: Initial Project Setup & Terraform for RunPod Slurm Cluster"
created: 2025-12-14
modified: 2025-12-14
status: done
priority: high
owner: mattwwalters
assignee: claude-agent
tags: [infrastructure, setup, terraform, runpod, slurm]
dependencies: []
---

## Overview

This is the foundational task for the "GPU Watchdog" project. Its purpose is to:

1. Create the basic directory structure for source code
2. Establish tool version management via asdf
3. Write Terraform configuration to provision GPU pods on RunPod
4. Create a root Makefile for common operations

**Important Architectural Note:** RunPod Instant Clusters (multi-node Slurm) require manual setup via their web console and cannot be fully provisioned via Terraform. Our Terraform will provision individual GPU pods. For a true multi-node Slurm demo, we will:
- Use Terraform to provision 2 pods (head + worker)
- Run Slurm setup scripts post-provisioning
- Document the manual Instant Cluster alternative for interview discussion

## Goals

- [x] Define complete implementation specification (this document)
- [x] Create `.gitignore` with security-focused exclusions
- [x] Update `.tool-versions` with all required runtime versions
- [x] Write Terraform configuration for RunPod GPU pods (VERIFIED WORKING)
- [x] Validate with `terraform init` and `terraform plan`
- [x] Create root `Makefile` with infrastructure and development commands
- [x] **FULL LIFECYCLE VERIFIED**: `make infra-apply` → `make infra-refresh` → `make infra-destroy`

## Cost Estimate

| Configuration | GPU | $/hr | 2-Pod Cluster | 10 hrs/week |
|--------------|-----|------|---------------|-------------|
| **Learning (recommended)** | A100 80GB PCIe | ~$1.49 | ~$2.98/hr | ~$30/week |
| Demo-ready | H100 PCIe | ~$2.49 | ~$4.98/hr | ~$50/week |
| Budget | RTX 4090 | ~$0.69 | ~$1.38/hr | ~$14/week |

**Recommendation:** A100 80GB - matches NVIDIA's actual infrastructure, excellent for interview talking points.

## Implementation Phases

### Phase 1: Directory Scaffolding

Create the following structure:

```
nvidia-study-cluster/
├── .context/                 # (exists)
├── .env                      # (exists) - API keys, NOT committed
├── .gitignore                # (done) Security exclusions
├── .tool-versions            # (done) asdf version pinning
├── Makefile                  # Root commands
├── README.md                 # Project overview
├── backend/                  # Node.js/Express API
│   └── .gitkeep
├── frontend/                 # React dashboard
│   └── .gitkeep
├── agent/                    # LangChain.js AI agent
│   └── .gitkeep
├── scripts/                  # Slurm setup, utilities
│   └── .gitkeep
└── terraform/                # (done) Infrastructure as Code
    ├── main.tf
    ├── variables.tf
    ├── outputs.tf
    ├── terraform.tfvars.example
    └── .terraform.lock.hcl   # (generated)
```

### Phase 2: Security & Version Management

#### .gitignore (COMPLETED)

```gitignore
# Environment & Secrets
.env
.env.*
!.env.example
*.pem
*.key
credentials.json

# Terraform
terraform/.terraform/
terraform/*.tfstate
terraform/*.tfstate.*
terraform/*.tfvars
!terraform/*.tfvars.example
terraform/crash.log
terraform/.terraform.lock.hcl

# Node.js
node_modules/
dist/
build/
*.log
.npm

# Python
__pycache__/
*.py[cod]
*$py.class
.venv/
venv/
*.egg-info/

# IDE
.idea/
.vscode/
*.swp
*.swo
.DS_Store

# Build artifacts
*.local
```

#### .tool-versions (COMPLETED)

```
terraform 1.9.1
nodejs 22.21.1
python 3.11.14
pnpm 9.15.1
```

### Phase 3: Terraform Configuration (VERIFIED WORKING)

All Terraform files have been created and validated. `terraform plan` successfully shows 2 pods to create.

#### terraform/main.tf

```hcl
terraform {
  required_version = ">= 1.9.0"

  required_providers {
    runpod = {
      source  = "decentralized-infrastructure/runpod"
      version = "~> 1.0"
    }
  }
}

provider "runpod" {
  # Uses RUNPOD_API_KEY environment variable
}

# -----------------------------------------------------------------------------
# GPU Pod: Head Node (Slurm Controller + Services)
# -----------------------------------------------------------------------------
resource "runpod_pod" "head_node" {
  name       = "${var.cluster_name}-head"
  image_name = var.container_image

  gpu_type_ids = var.gpu_type_ids
  gpu_count    = var.gpu_count

  cloud_type        = var.cloud_type
  data_center_ids   = var.data_center_ids
  support_public_ip = true

  volume_in_gb         = var.volume_gb
  container_disk_in_gb = var.container_disk_gb

  ports = var.exposed_ports

  # Environment variables (map of string - VERIFIED SCHEMA)
  env = {
    NODE_ROLE    = "head"
    CLUSTER_NAME = var.cluster_name
    PUBLIC_KEY   = var.ssh_public_key
  }
}

# -----------------------------------------------------------------------------
# GPU Pod: Worker Node(s) (Slurm Agent + GPU Workloads)
# -----------------------------------------------------------------------------
resource "runpod_pod" "worker_node" {
  count = var.worker_count

  name       = "${var.cluster_name}-worker-${count.index}"
  image_name = var.container_image

  gpu_type_ids = var.gpu_type_ids
  gpu_count    = var.gpu_count

  cloud_type        = var.cloud_type
  data_center_ids   = var.data_center_ids
  support_public_ip = true

  volume_in_gb         = var.volume_gb
  container_disk_in_gb = var.container_disk_gb

  ports = var.exposed_ports

  # Environment variables (map of string - VERIFIED SCHEMA)
  env = {
    NODE_ROLE    = "worker"
    CLUSTER_NAME = var.cluster_name
    WORKER_INDEX = tostring(count.index)
    PUBLIC_KEY   = var.ssh_public_key
  }

  depends_on = [runpod_pod.head_node]
}
```

#### terraform/variables.tf

```hcl
# -----------------------------------------------------------------------------
# Cluster Configuration
# -----------------------------------------------------------------------------
variable "cluster_name" {
  description = "Name prefix for all cluster resources"
  type        = string
  default     = "gpu-watchdog"
}

variable "worker_count" {
  description = "Number of worker nodes (in addition to head node)"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# GPU Configuration
# -----------------------------------------------------------------------------
variable "gpu_type_ids" {
  description = "List of acceptable GPU types (in order of preference). Use exact IDs from RunPod API."
  type        = list(string)
  default     = ["NVIDIA A100 80GB PCIe", "NVIDIA A100-SXM4-80GB"]
  # VERIFIED GPU IDs from RunPod API:
  # - "NVIDIA GeForce RTX 4090"     # Budget: ~$0.69/hr, 24GB
  # - "NVIDIA A100 80GB PCIe"       # Recommended: ~$1.49/hr, 80GB
  # - "NVIDIA A100-SXM4-80GB"       # ~$1.49/hr, 80GB
  # - "NVIDIA H100 PCIe"            # Premium: ~$2.49/hr, 80GB
  # - "NVIDIA H100 80GB HBM3"       # H100 SXM: ~$2.99/hr, 80GB
}

variable "gpu_count" {
  description = "Number of GPUs per node"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# Cloud Configuration
# -----------------------------------------------------------------------------
variable "cloud_type" {
  description = "RunPod cloud type: COMMUNITY or SECURE"
  type        = string
  default     = "COMMUNITY"

  validation {
    condition     = contains(["COMMUNITY", "SECURE"], var.cloud_type)
    error_message = "cloud_type must be either COMMUNITY or SECURE"
  }
}

variable "data_center_ids" {
  description = "Preferred data center locations (US locations for lower latency)"
  type        = list(string)
  default     = ["US-TX-3", "US-KS-2", "US-CA-1", "US-GA-1"]
  # VERIFIED US data centers from RunPod API:
  # US-CA-1, US-CA-2, US-TX-1 through US-TX-5, US-KS-1 through US-KS-3,
  # US-GA-1, US-GA-2, US-OR-1, US-OR-2, US-NC-1, US-NC-2, US-IL-1, etc.
}

# -----------------------------------------------------------------------------
# Storage Configuration
# -----------------------------------------------------------------------------
variable "volume_gb" {
  description = "Persistent volume size in GB (survives pod restarts)"
  type        = number
  default     = 50
}

variable "container_disk_gb" {
  description = "Container disk size in GB (wiped on pod restart)"
  type        = number
  default     = 20
}

# -----------------------------------------------------------------------------
# Container Configuration
# -----------------------------------------------------------------------------
variable "container_image" {
  description = "Docker image for pods (must have CUDA support)"
  type        = string
  default     = "runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04"
}

variable "exposed_ports" {
  description = "Ports to expose on pods (format: port/protocol)"
  type        = list(string)
  default = [
    "22/tcp",    # SSH
    "8080/http", # Backend API
    "3000/http", # Frontend
    "9090/http", # Prometheus
    "3001/http", # Grafana
    "9400/http", # DCGM Exporter
  ]
}

# -----------------------------------------------------------------------------
# SSH Configuration
# -----------------------------------------------------------------------------
variable "ssh_public_key" {
  description = "SSH public key for node access (optional)"
  type        = string
  default     = ""
  sensitive   = true
}
```

#### terraform/outputs.tf

```hcl
# -----------------------------------------------------------------------------
# Head Node Outputs
# -----------------------------------------------------------------------------
output "head_node_id" {
  description = "RunPod Pod ID for head node"
  value       = runpod_pod.head_node.id
}

output "head_node_public_ip" {
  description = "Public IP of head node"
  value       = runpod_pod.head_node.public_ip
}

output "head_node_cost_per_hr" {
  description = "Cost per hour for head node"
  value       = runpod_pod.head_node.cost_per_hr
}

# -----------------------------------------------------------------------------
# Worker Node Outputs
# -----------------------------------------------------------------------------
output "worker_node_ids" {
  description = "RunPod Pod IDs for worker nodes"
  value       = runpod_pod.worker_node[*].id
}

output "worker_node_ips" {
  description = "Public IPs of worker nodes"
  value       = runpod_pod.worker_node[*].public_ip
}

# -----------------------------------------------------------------------------
# Cluster Summary
# -----------------------------------------------------------------------------
output "cluster_info" {
  description = "Summary of cluster deployment"
  value = {
    cluster_name    = var.cluster_name
    head_node_ip    = runpod_pod.head_node.public_ip
    worker_node_ips = runpod_pod.worker_node[*].public_ip
    gpu_type        = var.gpu_type_ids[0]
    gpus_per_node   = var.gpu_count
    total_gpus      = (1 + var.worker_count) * var.gpu_count
    total_nodes     = 1 + var.worker_count
  }
}

output "ssh_commands" {
  description = "SSH commands to connect to nodes"
  value = {
    head   = "ssh root@${runpod_pod.head_node.public_ip}"
    workers = [for ip in runpod_pod.worker_node[*].public_ip : "ssh root@${ip}"]
  }
}

output "estimated_hourly_cost" {
  description = "Estimated total hourly cost for the cluster"
  value       = runpod_pod.head_node.cost_per_hr + sum(runpod_pod.worker_node[*].cost_per_hr)
}
```

#### terraform/terraform.tfvars.example

```hcl
# GPU Watchdog - Terraform Variables
# Copy this file to terraform.tfvars and customize
#
# Usage:
#   cp terraform.tfvars.example terraform.tfvars
#   # Edit terraform.tfvars with your preferences
#   terraform plan

cluster_name = "gpu-watchdog"
worker_count = 1

# -----------------------------------------------------------------------------
# GPU Selection (uncomment ONE option)
# -----------------------------------------------------------------------------

# Budget Option (~$0.69/hr per node, ~$1.38/hr for 2-node cluster)
# gpu_type_ids = ["NVIDIA GeForce RTX 4090"]

# Recommended Option (~$1.49/hr per node, ~$2.98/hr for 2-node cluster)
# Matches NVIDIA's actual A100 infrastructure - great for interview talking points
gpu_type_ids = ["NVIDIA A100 80GB PCIe", "NVIDIA A100-SXM4-80GB"]

# Premium Option (~$2.49/hr per node, ~$4.98/hr for 2-node cluster)
# gpu_type_ids = ["NVIDIA H100 PCIe", "NVIDIA H100 80GB HBM3"]

# -----------------------------------------------------------------------------
# Resource Configuration
# -----------------------------------------------------------------------------

gpu_count         = 1
cloud_type        = "COMMUNITY"
volume_gb         = 50
container_disk_gb = 20

# Prefer US data centers for lower latency
data_center_ids = ["US-TX-3", "US-KS-2", "US-CA-1"]

# -----------------------------------------------------------------------------
# Optional: SSH Access
# -----------------------------------------------------------------------------

# Uncomment and add your public key for SSH access
# ssh_public_key = "ssh-rsa AAAA... your-email@example.com"
```

### Phase 4: Makefile

#### Makefile (root)

```makefile
.PHONY: help infra-init infra-plan infra-apply infra-destroy infra-output \
        cluster-status cluster-ssh dev-setup dev-backend dev-frontend clean

# Default target
help:
	@echo "GPU Watchdog - NVIDIA Interview Prep Project"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make infra-init     - Initialize Terraform"
	@echo "  make infra-plan     - Preview infrastructure changes"
	@echo "  make infra-apply    - Provision RunPod cluster"
	@echo "  make infra-destroy  - Tear down cluster (saves money!)"
	@echo "  make infra-output   - Show cluster connection info"
	@echo ""
	@echo "Cluster Operations:"
	@echo "  make cluster-status - Show current cluster state"
	@echo "  make cluster-ssh    - SSH to head node"
	@echo ""
	@echo "Development:"
	@echo "  make dev-setup      - Install all dependencies"
	@echo "  make dev-backend    - Start backend dev server"
	@echo "  make dev-frontend   - Start frontend dev server"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean          - Remove build artifacts"
	@echo "  make cost-estimate  - Show estimated hourly costs"

# -----------------------------------------------------------------------------
# Infrastructure Commands
# -----------------------------------------------------------------------------
infra-init:
	@echo "Initializing Terraform..."
	cd terraform && terraform init

infra-plan:
	@echo "Planning infrastructure changes..."
	cd terraform && terraform plan

infra-apply:
	@echo "Provisioning RunPod cluster..."
	@echo "WARNING: This will incur costs (~$$2.98/hr for A100). Press Ctrl+C to cancel."
	@sleep 3
	cd terraform && terraform apply

infra-destroy:
	@echo "Destroying RunPod cluster..."
	cd terraform && terraform destroy

infra-output:
	@cd terraform && terraform output

# -----------------------------------------------------------------------------
# Cluster Operations
# -----------------------------------------------------------------------------
cluster-status:
	@echo "Cluster Status:"
	@cd terraform && terraform output -json cluster_info 2>/dev/null | jq . || echo "No cluster deployed"

cluster-ssh:
	@echo "Connecting to head node..."
	@IP=$$(cd terraform && terraform output -raw head_node_public_ip 2>/dev/null) && \
		[ -n "$$IP" ] && ssh -o StrictHostKeyChecking=no root@$$IP || \
		echo "Error: No cluster deployed or head node IP not available"

# -----------------------------------------------------------------------------
# Development Commands
# -----------------------------------------------------------------------------
dev-setup:
	@echo "Installing tool versions via asdf..."
	asdf install
	@echo "Installing backend dependencies..."
	cd backend && pnpm install || echo "backend/package.json not yet created"
	@echo "Installing frontend dependencies..."
	cd frontend && pnpm install || echo "frontend/package.json not yet created"
	@echo "Setting up Python environment..."
	cd agent && python -m venv .venv && .venv/bin/pip install -r requirements.txt 2>/dev/null || echo "agent/requirements.txt not yet created"

dev-backend:
	cd backend && pnpm dev

dev-frontend:
	cd frontend && pnpm dev

# -----------------------------------------------------------------------------
# Utilities
# -----------------------------------------------------------------------------
clean:
	rm -rf backend/node_modules backend/dist
	rm -rf frontend/node_modules frontend/dist
	rm -rf agent/.venv agent/__pycache__
	rm -rf terraform/.terraform

cost-estimate:
	@echo "Estimated Costs (per hour, 2-node cluster):"
	@echo "  RTX 4090:  ~$$1.38/hr  (~$$14/week at 10hrs)"
	@echo "  A100 80GB: ~$$2.98/hr  (~$$30/week at 10hrs)"
	@echo "  H100:      ~$$4.98/hr  (~$$50/week at 10hrs)"
	@echo ""
	@echo "Remember: make infra-destroy when not in use!"
```

### Phase 5: Validation (COMPLETED)

The following validations have passed:

```bash
# 1. Terraform initialized successfully
$ terraform init
Terraform has been successfully initialized!

# 2. Terraform configuration is valid
$ terraform validate
Success! The configuration is valid.

# 3. Terraform plan shows correct resources
$ terraform plan
Plan: 2 to add, 0 to change, 0 to destroy.
  - runpod_pod.head_node (gpu-watchdog-head)
  - runpod_pod.worker_node[0] (gpu-watchdog-worker-0)
```

## Success Criteria

- [x] `.gitignore` excludes sensitive files
- [x] `.tool-versions` specifies all required runtimes
- [x] `terraform init` completes without errors
- [x] `terraform plan` shows 2 pods to be created (1 head + 1 worker)
- [x] `terraform validate` passes
- [x] `make help` displays all available commands
- [x] No secrets are committed to git
- [x] **`make infra-apply` successfully provisions 2 A100 pods (~$2.78/hr total)**
- [x] **`make infra-refresh` retrieves pod IPs**
- [x] **`make infra-destroy` successfully tears down cluster**

## Verification Evidence

**Provider Schema Verified:**
- `env` attribute is `map(string)` (not list of objects)
- `public_ip` is a valid computed output
- `cost_per_hr` is available for cost tracking

**GPU Type IDs Verified (from RunPod API):**
- `"NVIDIA A100 80GB PCIe"` - 80GB, Community + Secure
- `"NVIDIA A100-SXM4-80GB"` - 80GB, Community + Secure
- `"NVIDIA GeForce RTX 4090"` - 24GB, Community + Secure
- `"NVIDIA H100 PCIe"` - 80GB, Community + Secure
- `"NVIDIA H100 80GB HBM3"` - 80GB (SXM), Community + Secure

**Data Center IDs Verified (from RunPod API):**
- US: US-CA-1/2, US-TX-1-5, US-KS-1-3, US-GA-1/2, US-OR-1/2, US-NC-1/2, etc.
- EU: EU-SE-1/2, EU-NL-1, EU-FR-1, EUR-IS-1-3, EUR-NO-1, etc.
- Other: CA-MTL-1-4, AP-JP-1, SEA-SG-1, OC-AU-1

## Interview Talking Points

This task demonstrates:

1. **Infrastructure as Code**: "I used Terraform to declaratively provision GPU infrastructure, ensuring repeatability and version control of infrastructure state."

2. **Cost Awareness**: "I parameterized the configuration to allow easy switching between GPU tiers for development vs. demo, showing cost-conscious engineering."

3. **Security Practices**: "Sensitive credentials are managed via environment variables and excluded from version control via .gitignore."

4. **Developer Experience**: "I created a Makefile to reduce cognitive load - any engineer can run `make help` and immediately understand available operations."

5. **Slurm Knowledge**: "While Terraform provisions the base infrastructure, I understand that production Slurm clusters require additional orchestration - which I've planned for post-provisioning setup."

6. **API-First Validation**: "Before writing configuration, I queried the RunPod GraphQL API to verify exact GPU type IDs and data center codes, ensuring the configuration would work on first apply."

## Related Documents

- [projectBrief.md](../../immutable/projectBrief.md) - Project goals
- [systemPatterns.md](../../immutable/systemPatterns.md) - Architecture patterns
- [techContext.md](../../extensible/techContext.md) - Technology stack

## Completion Notes

**Task completed 2025-12-14**

Full infrastructure lifecycle verified:
1. `make infra-apply` - Provisioned 2 A100 80GB pods (head + worker) at ~$2.78/hr total
2. `make infra-refresh` - Successfully retrieved public IPs for both nodes
3. `make infra-destroy` - Successfully destroyed both pods

Key learnings:
- RunPod REST API data center IDs differ from GraphQL API (US-CA-1 not valid for REST, use US-CA-2)
- Terraform provider source is `decentralized-infrastructure/runpod` (not `runpod/runpod`)
- Makefile requires `include .env` + `export` to load environment variables for subprocesses

## Next Steps

Continue to Task 02: Docker Compose service stack deployment (DCGM Exporter, Prometheus, Grafana)
Then Task 03: Slurm setup scripts for cluster orchestration

## Sources

- [RunPod Terraform Provider](https://registry.terraform.io/providers/decentralized-infrastructure/runpod/latest/docs)
- [RunPod GPU Types](https://docs.runpod.io/references/gpu-types)
- [RunPod Slurm Documentation](https://docs.runpod.io/instant-clusters/slurm)
- [RunPod Pricing Guide](https://flexprice.io/blog/runprod-pricing-guide-with-gpu-costs)
