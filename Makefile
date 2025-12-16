.PHONY: help infra-init infra-plan infra-apply infra-destroy infra-output infra-refresh \
        cluster-status cluster-ssh cluster-exec cluster-verify cluster-head-ip \
        services-up services-down services-logs services-status \
        gpu-tunnel gpu-setup-dcgm gpu-metrics \
        template-build template-push \
        dev-setup dev-backend dev-frontend clean

# Load environment variables from .env file
include .env
export

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
	@echo "  make cluster-exec CMD=\"...\" - Run command on head node"
	@echo "  make cluster-verify - Verify pod environment for deployment"
	@echo ""
	@echo "Local Services (Docker Compose):"
	@echo "  make services-up    - Start Prometheus + Grafana"
	@echo "  make services-down  - Stop all local services"
	@echo "  make services-logs  - View service logs"
	@echo "  make services-status - Check service status"
	@echo ""
	@echo "GPU Monitoring:"
	@echo "  make gpu-setup-dcgm POD_IP=x.x.x.x SSH_PORT=xxxxx - Install DCGM on RunPod"
	@echo "  make gpu-tunnel POD_IP=x.x.x.x SSH_PORT=xxxxx     - Forward metrics to localhost"
	@echo "  make gpu-metrics    - Show current GPU metrics (requires tunnel)"
	@echo ""
	@echo "RunPod Template:"
	@echo "  make template-build DOCKER_USERNAME=xxx - Build custom RunPod image"
	@echo "  make template-push DOCKER_USERNAME=xxx  - Push image to Docker Hub"
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
	cd terraform && terraform apply -auto-approve

infra-destroy:
	@echo "Destroying RunPod cluster..."
	cd terraform && terraform destroy -auto-approve

infra-output:
	@cd terraform && terraform output

infra-refresh:
	@echo "Refreshing Terraform state..."
	cd terraform && terraform refresh

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

# Run arbitrary command on head node: make cluster-exec CMD="nvidia-smi"
cluster-exec:
	@IP=$$(cd terraform && terraform output -raw head_node_public_ip 2>/dev/null) && \
		[ -n "$$IP" ] && ssh -o StrictHostKeyChecking=no root@$$IP "$(CMD)" || \
		echo "Error: No cluster deployed. Usage: make cluster-exec CMD=\"your-command\""

# Verify pod environment for Docker Compose deployment
cluster-verify:
	@echo "=== RunPod Environment Verification ==="
	@IP=$$(cd terraform && terraform output -raw head_node_public_ip 2>/dev/null) && \
		[ -n "$$IP" ] && ssh -o StrictHostKeyChecking=no root@$$IP '\
			echo "--- Docker Version ---" && docker --version && \
			echo "" && echo "--- Docker Compose Version ---" && (docker compose version 2>/dev/null || echo "docker compose v2 NOT available") && \
			echo "" && echo "--- NVIDIA Runtime ---" && docker info 2>/dev/null | grep -E "(Runtimes|Default Runtime)" && \
			echo "" && echo "--- GPU Info ---" && nvidia-smi --query-gpu=driver_version,name,memory.total --format=csv,noheader && \
			echo "" && echo "--- Workspace ---" && ls -la /workspace && df -h /workspace && \
			echo "" && echo "--- DCGM Check ---" && (which dcgmi && dcgmi discovery -l 2>/dev/null || echo "DCGM not installed on host (will use container)")' || \
		echo "Error: No cluster deployed"

cluster-head-ip:
	@cd terraform && terraform output -raw head_node_public_ip 2>/dev/null || echo ""

# -----------------------------------------------------------------------------
# Local Services (Docker Compose)
# -----------------------------------------------------------------------------
services-up:
	@echo "Starting local services (Prometheus, Grafana)..."
	docker compose -f docker/docker-compose.yml up -d
	@echo ""
	@echo "Services started:"
	@echo "  Prometheus: http://localhost:9090"
	@echo "  Grafana:    http://localhost:3001 (admin/gpuwatchdog)"
	@echo ""
	@echo "Note: Start gpu-tunnel to forward metrics from RunPod"

services-down:
	@echo "Stopping local services..."
	docker compose -f docker/docker-compose.yml down

services-logs:
	docker compose -f docker/docker-compose.yml logs -f

services-status:
	@echo "=== Service Status ==="
	@docker compose -f docker/docker-compose.yml ps
	@echo ""
	@echo "=== Port Bindings ==="
	@docker compose -f docker/docker-compose.yml ps --format "table {{.Name}}\t{{.Ports}}"

# -----------------------------------------------------------------------------
# GPU Monitoring
# -----------------------------------------------------------------------------
# Setup DCGM on RunPod pod
# Usage: make gpu-setup-dcgm POD_IP=216.249.100.66 SSH_PORT=20092
gpu-setup-dcgm:
ifndef POD_IP
	$(error POD_IP is required. Usage: make gpu-setup-dcgm POD_IP=x.x.x.x SSH_PORT=xxxxx)
endif
ifndef SSH_PORT
	$(error SSH_PORT is required. Usage: make gpu-setup-dcgm POD_IP=x.x.x.x SSH_PORT=xxxxx)
endif
	@echo "Installing DCGM on RunPod pod..."
	ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
		-p $(SSH_PORT) root@$(POD_IP) 'bash -s' < scripts/setup-dcgm.sh

# Create SSH tunnel for metrics
# Usage: make gpu-tunnel POD_IP=216.249.100.66 SSH_PORT=20092
gpu-tunnel:
ifndef POD_IP
	$(error POD_IP is required. Usage: make gpu-tunnel POD_IP=x.x.x.x SSH_PORT=xxxxx)
endif
ifndef SSH_PORT
	$(error SSH_PORT is required. Usage: make gpu-tunnel POD_IP=x.x.x.x SSH_PORT=xxxxx)
endif
	@./scripts/tunnel-metrics.sh $(POD_IP) $(SSH_PORT)

# Quick check of GPU metrics (requires tunnel to be running)
gpu-metrics:
	@echo "=== GPU Metrics (via DCGM Exporter) ==="
	@curl -s http://localhost:9400/metrics 2>/dev/null | grep "^DCGM_FI_DEV" | head -20 || \
		echo "Error: Cannot reach metrics endpoint. Is the tunnel running? (make gpu-tunnel)"

# -----------------------------------------------------------------------------
# RunPod Template
# -----------------------------------------------------------------------------
# Build custom RunPod template with metrics exporter
# Usage: make template-build DOCKER_USERNAME=yourusername
template-build:
ifndef DOCKER_USERNAME
	$(error DOCKER_USERNAME is required. Usage: make template-build DOCKER_USERNAME=yourusername)
endif
	@echo "Building RunPod template image..."
	docker build --platform linux/amd64 \
		-t $(DOCKER_USERNAME)/gpu-watchdog-pod:latest \
		docker/runpod-template

# Push template to Docker Hub
# Usage: make template-push DOCKER_USERNAME=yourusername
template-push:
ifndef DOCKER_USERNAME
	$(error DOCKER_USERNAME is required. Usage: make template-push DOCKER_USERNAME=yourusername)
endif
	@echo "Pushing to Docker Hub..."
	docker push $(DOCKER_USERNAME)/gpu-watchdog-pod:latest
	@echo ""
	@echo "Image pushed: $(DOCKER_USERNAME)/gpu-watchdog-pod:latest"
	@echo ""
	@echo "Next: Create RunPod template at https://runpod.io/console/user/templates"
	@echo "  - Docker Image: $(DOCKER_USERNAME)/gpu-watchdog-pod:latest"
	@echo "  - Exposed HTTP Ports: 9400"

# -----------------------------------------------------------------------------
# Development Commands
# -----------------------------------------------------------------------------
dev-setup:
	@echo "Installing tool versions via asdf..."
	asdf install
	@echo "Installing backend dependencies..."
	cd backend && pnpm install || echo "backend/package.json not yet created"
	@echo "Installing frontend dependencies..."
	cd frontend && pnpm install
	@echo "Setting up Python environment..."
	cd agent && python -m venv .venv && .venv/bin/pip install -r requirements.txt 2>/dev/null || echo "agent/requirements.txt not yet created"

dev-backend:
	cd backend && pnpm dev

dev-frontend:
	cd frontend && pnpm dev

# Start frontend with Docker Compose (with hot reload)
dev-frontend-docker:
	docker compose -f docker/docker-compose.yml up frontend --build

# Run frontend tests
dev-frontend-test:
	cd frontend && pnpm test

# Run frontend linting
dev-frontend-lint:
	cd frontend && pnpm lint

# Build frontend for production
frontend-build:
	cd frontend && pnpm build

# Build frontend Docker image for production
frontend-build-docker:
	docker build --target production -t gpu-watchdog-ui:latest frontend/

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
