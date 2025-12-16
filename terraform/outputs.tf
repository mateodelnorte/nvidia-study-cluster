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
