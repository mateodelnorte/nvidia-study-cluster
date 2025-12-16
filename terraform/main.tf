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

  # Environment variables (map of string, not list of objects)
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

  # Environment variables (map of string, not list of objects)
  env = {
    NODE_ROLE    = "worker"
    CLUSTER_NAME = var.cluster_name
    WORKER_INDEX = tostring(count.index)
    PUBLIC_KEY   = var.ssh_public_key
  }

  depends_on = [runpod_pod.head_node]
}
