import type {
	GpuMetrics,
	SlurmMetrics,
	SlurmNodeStatus,
	SlurmQueueStats,
} from "../models/metrics.js";

/**
 * Parse Prometheus-format GPU metrics from the exporter
 */
export function parseGpuMetrics(text: string): GpuMetrics[] {
	const gpuMap = new Map<string, Partial<GpuMetrics>>();

	for (const line of text.split("\n")) {
		if (line.startsWith("#") || !line.trim()) continue;

		// Parse metric line: METRIC_NAME{labels} value
		const match = line.match(/^(\w+)\{([^}]+)\}\s+(.+)$/);
		if (!match) continue;

		const [, metricName, labelsStr, valueStr] = match;
		const value = Number.parseFloat(valueStr);

		// Parse labels
		const labels: Record<string, string> = {};
		for (const pair of labelsStr.split(",")) {
			const [key, val] = pair.split("=");
			labels[key] = val?.replace(/"/g, "") ?? "";
		}

		const gpuId = labels.gpu ?? "0";
		if (!gpuMap.has(gpuId)) {
			gpuMap.set(gpuId, {
				gpu: gpuId,
				gpuName: labels.gpu_name ?? "Unknown",
			});
		}

		const gpu = gpuMap.get(gpuId)!;

		switch (metricName) {
			case "DCGM_FI_DEV_GPU_UTIL":
				gpu.utilization = value;
				break;
			case "DCGM_FI_DEV_MEM_COPY_UTIL":
				gpu.memoryUtilization = value;
				break;
			case "DCGM_FI_DEV_FB_USED":
				gpu.memoryUsedMB = value;
				break;
			case "DCGM_FI_DEV_FB_FREE":
				gpu.memoryFreeMB = value;
				break;
			case "DCGM_FI_DEV_FB_TOTAL":
				gpu.memoryTotalMB = value;
				break;
			case "DCGM_FI_DEV_GPU_TEMP":
				gpu.temperatureC = value;
				break;
			case "DCGM_FI_DEV_POWER_USAGE":
				gpu.powerUsageW = value;
				break;
			case "DCGM_FI_DEV_SM_CLOCK":
				gpu.smClockMHz = value;
				break;
			case "DCGM_FI_DEV_MEM_CLOCK":
				gpu.memClockMHz = value;
				break;
		}
	}

	return Array.from(gpuMap.values()).map((gpu) => ({
		gpu: gpu.gpu ?? "0",
		gpuName: gpu.gpuName ?? "Unknown",
		utilization: gpu.utilization ?? 0,
		memoryUtilization: gpu.memoryUtilization ?? 0,
		memoryUsedMB: gpu.memoryUsedMB ?? 0,
		memoryFreeMB: gpu.memoryFreeMB ?? 0,
		memoryTotalMB: gpu.memoryTotalMB ?? 0,
		temperatureC: gpu.temperatureC ?? 0,
		powerUsageW: gpu.powerUsageW ?? 0,
		smClockMHz: gpu.smClockMHz ?? 0,
		memClockMHz: gpu.memClockMHz ?? 0,
	}));
}

/**
 * Parse Prometheus-format Slurm metrics from the exporter
 */
export function parseSlurmMetrics(text: string): SlurmMetrics {
	const queue: SlurmQueueStats = {
		pending: 0,
		running: 0,
		completed: 0,
		failed: 0,
		cancelled: 0,
	};

	const metrics: SlurmMetrics = {
		nodes: [],
		cpusTotal: 0,
		cpusAlloc: 0,
		cpusIdle: 0,
		nodesTotal: 0,
		nodesIdle: 0,
		nodesAlloc: 0,
		queue,
	};

	const nodeMap = new Map<string, Partial<SlurmNodeStatus>>();

	for (const line of text.split("\n")) {
		if (line.startsWith("#") || !line.trim()) continue;

		// Parse simple metrics (no labels)
		const simpleMatch = line.match(/^(\w+)\s+(\d+\.?\d*)$/);
		if (simpleMatch) {
			const [, name, value] = simpleMatch;
			const num = Number.parseFloat(value);

			switch (name) {
				case "slurm_cpus_total":
					metrics.cpusTotal = num;
					break;
				case "slurm_cpus_alloc":
					metrics.cpusAlloc = num;
					break;
				case "slurm_cpus_idle":
					metrics.cpusIdle = num;
					break;
				case "slurm_nodes_idle":
					metrics.nodesIdle = num;
					break;
				case "slurm_nodes_alloc":
					metrics.nodesAlloc = num;
					break;
				case "slurm_queue_pending":
					queue.pending = num;
					break;
				case "slurm_queue_running":
					queue.running = num;
					break;
				case "slurm_queue_completed":
					queue.completed = num;
					break;
				case "slurm_queue_failed":
					queue.failed = num;
					break;
				case "slurm_queue_cancelled":
					queue.cancelled = num;
					break;
			}
			continue;
		}

		// Parse metrics with labels
		const labelMatch = line.match(/^(\w+)\{([^}]+)\}\s+(.+)$/);
		if (!labelMatch) continue;

		const [, metricName, labelsStr, valueStr] = labelMatch;
		const value = Number.parseFloat(valueStr);

		const labels: Record<string, string> = {};
		for (const pair of labelsStr.split(",")) {
			const [key, val] = pair.split("=");
			labels[key] = val?.replace(/"/g, "") ?? "";
		}

		const nodeId = labels.node;
		if (nodeId && metricName.startsWith("slurm_node_")) {
			if (!nodeMap.has(nodeId)) {
				nodeMap.set(nodeId, {
					node: nodeId,
					status: (labels.status as SlurmNodeStatus["status"]) ?? "idle",
				});
			}

			const node = nodeMap.get(nodeId)!;

			switch (metricName) {
				case "slurm_node_cpu_alloc":
					node.cpusAlloc = value;
					break;
				case "slurm_node_cpu_idle":
					node.cpusIdle = value;
					break;
				case "slurm_node_cpu_total":
					node.cpusTotal = value;
					break;
				case "slurm_node_mem_alloc":
					node.memAlloc = value;
					break;
				case "slurm_node_mem_total":
					node.memTotal = value;
					break;
			}
		}
	}

	metrics.nodes = Array.from(nodeMap.values()).map((n) => ({
		node: n.node ?? "",
		status: n.status ?? "idle",
		cpusAlloc: n.cpusAlloc ?? 0,
		cpusIdle: n.cpusIdle ?? 0,
		cpusTotal: n.cpusTotal ?? 0,
		memAlloc: n.memAlloc ?? 0,
		memTotal: n.memTotal ?? 0,
	}));

	metrics.nodesTotal = metrics.nodes.length;

	return metrics;
}
