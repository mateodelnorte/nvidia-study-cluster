import { type Router, Router as createRouter } from "express";
import { getState } from "../services/metrics-collector.js";

const router: Router = createRouter();

// GET /api/cluster/status - Overall cluster health
router.get("/status", (_req, res) => {
	const state = getState();

	const totalGpus = state.nodes.reduce((sum, n) => sum + n.gpus.length, 0);
	const avgUtilization =
		totalGpus > 0
			? state.nodes.reduce(
					(sum, n) =>
						sum + n.gpus.reduce((gs, g) => gs + g.utilization, 0),
					0,
				) / totalGpus
			: 0;

	const avgTemperature =
		totalGpus > 0
			? state.nodes.reduce(
					(sum, n) =>
						sum + n.gpus.reduce((gs, g) => gs + g.temperatureC, 0),
					0,
				) / totalGpus
			: 0;

	const totalMemoryMB = state.nodes.reduce(
		(sum, n) => sum + n.gpus.reduce((gs, g) => gs + g.memoryTotalMB, 0),
		0,
	);

	const usedMemoryMB = state.nodes.reduce(
		(sum, n) => sum + n.gpus.reduce((gs, g) => gs + g.memoryUsedMB, 0),
		0,
	);

	res.json({
		healthy: state.nodes.length > 0,
		nodeCount: state.nodes.length,
		gpuCount: totalGpus,
		avgUtilization: Math.round(avgUtilization * 10) / 10,
		avgTemperature: Math.round(avgTemperature * 10) / 10,
		memoryUsedGB: Math.round((usedMemoryMB / 1024) * 10) / 10,
		memoryTotalGB: Math.round((totalMemoryMB / 1024) * 10) / 10,
		slurm: state.slurm
			? {
					cpusTotal: state.slurm.cpusTotal,
					cpusAlloc: state.slurm.cpusAlloc,
					cpusIdle: state.slurm.cpusIdle,
					nodesTotal: state.slurm.nodesTotal,
					jobsPending: state.slurm.queue.pending,
					jobsRunning: state.slurm.queue.running,
				}
			: null,
		lastUpdated: state.lastUpdated.toISOString(),
	});
});

// GET /api/cluster/nodes - List all nodes
router.get("/nodes", (_req, res) => {
	const state = getState();

	const nodes = state.nodes.map((node) => ({
		nodeId: node.nodeId,
		hostname: node.hostname,
		gpuCount: node.gpus.length,
		gpus: node.gpus.map((gpu) => ({
			index: gpu.gpu,
			name: gpu.gpuName,
			utilization: gpu.utilization,
			memoryUsedMB: gpu.memoryUsedMB,
			memoryTotalMB: gpu.memoryTotalMB,
			temperatureC: gpu.temperatureC,
			powerUsageW: gpu.powerUsageW,
		})),
		timestamp: node.timestamp.toISOString(),
	}));

	res.json(nodes);
});

export default router;
