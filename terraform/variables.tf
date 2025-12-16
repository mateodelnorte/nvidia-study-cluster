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
  # Available options (verified from RunPod API):
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
  default     = ["US-TX-3", "US-KS-2", "US-GA-1", "US-CA-2"]
  # Valid US data centers (from RunPod REST API error response):
  # US-TX-1, US-TX-3, US-TX-4, US-KS-2, US-KS-3, US-GA-1, US-GA-2,
  # US-CA-2, US-NC-1, US-IL-1, US-DE-1, US-WA-1
  # Note: US-CA-1 is NOT valid for REST API (only GraphQL returns it)
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
  default     = "mateodelnorte/gpu-watchdog-pod:latest"
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
    "9400/http", # GPU Metrics Exporter
    "9341/http", # Slurm Exporter (head node only)
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
