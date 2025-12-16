import { config } from "../config.js";
import { gpuMetrics, slurmMetrics } from "../db/schema.js";
import { getDb } from "../lib/db.js";
import { createChildLogger } from "../lib/logger.js";
import {
	parseGpuMetrics,
	parseSlurmMetrics,
} from "../lib/prometheus-parser.js";
import type { NodeMetrics, SlurmMetrics } from "../models/metrics.js";

const log = createChildLogger("collector");

export interface CollectorState {
	nodes: NodeMetrics[];
	slurm: SlurmMetrics | null;
	lastUpdated: Date;
}

let state: CollectorState = {
	nodes: [],
	slurm: null,
	lastUpdated: new Date(),
};

let intervalId: NodeJS.Timeout | null = null;

export function getState(): CollectorState {
	return state;
}

async function fetchGpuMetrics(
	endpoint: string,
	index: number,
): Promise<NodeMetrics | null> {
	try {
		const response = await fetch(endpoint);
		if (!response.ok) {
			log.warn({ endpoint, status: response.status }, "GPU metrics fetch failed");
			return null;
		}

		const text = await response.text();
		const gpus = parseGpuMetrics(text);

		// Extract node name from endpoint path
		let hostname: string;
		try {
			const url = new URL(endpoint);
			const parts = url.pathname.split("/").filter(Boolean);
			hostname = parts[2] || `node-${index}`;
		} catch {
			hostname = `node-${index}`;
		}

		return {
			nodeId: `node-${index}`,
			hostname,
			gpus,
			timestamp: new Date(),
		};
	} catch (err) {
		log.error({ endpoint, err }, "Failed to fetch GPU metrics");
		return null;
	}
}

async function fetchSlurmMetrics(): Promise<SlurmMetrics | null> {
	if (!config.slurmEndpoint) return null;

	try {
		const response = await fetch(config.slurmEndpoint);
		if (!response.ok) {
			log.warn({ status: response.status }, "Slurm metrics fetch failed");
			return null;
		}

		const text = await response.text();
		return parseSlurmMetrics(text);
	} catch (err) {
		log.error({ err }, "Failed to fetch Slurm metrics");
		return null;
	}
}

async function collect(): Promise<void> {
	const timestamp = Date.now();

	// Fetch GPU metrics from all endpoints
	const nodePromises = config.gpuEndpoints.map((endpoint, index) =>
		fetchGpuMetrics(endpoint, index),
	);

	const [nodes, slurm] = await Promise.all([
		Promise.all(nodePromises),
		fetchSlurmMetrics(),
	]);

	const validNodes = nodes.filter((n): n is NodeMetrics => n !== null);

	// Update state
	state = {
		nodes: validNodes,
		slurm,
		lastUpdated: new Date(),
	};

	// Store in database
	const db = getDb();

	// Store GPU metrics
	for (const node of validNodes) {
		for (const gpu of node.gpus) {
			db.insert(gpuMetrics)
				.values({
					timestamp,
					nodeId: node.nodeId,
					gpuIndex: Number.parseInt(gpu.gpu, 10),
					utilization: gpu.utilization,
					memoryUsedMb: gpu.memoryUsedMB,
					memoryTotalMb: gpu.memoryTotalMB,
					temperatureC: gpu.temperatureC,
					powerUsageW: gpu.powerUsageW,
				})
				.run();
		}
	}

	// Store Slurm metrics
	if (slurm) {
		db.insert(slurmMetrics)
			.values({
				timestamp,
				cpusTotal: slurm.cpusTotal,
				cpusAlloc: slurm.cpusAlloc,
				cpusIdle: slurm.cpusIdle,
				nodesTotal: slurm.nodesTotal,
				nodesIdle: slurm.nodesIdle,
				nodesAlloc: slurm.nodesAlloc,
				queuePending: slurm.queue.pending,
				queueRunning: slurm.queue.running,
				queueCompleted: slurm.queue.completed,
				queueFailed: slurm.queue.failed,
			})
			.run();
	}

	log.debug(
		{ nodeCount: validNodes.length, hasSlurm: !!slurm },
		"Stored metrics",
	);
}

export function startCollector(): void {
	if (intervalId) return;

	log.info(
		{
			interval: config.collectInterval,
			gpuEndpoints: config.gpuEndpoints,
			slurmEndpoint: config.slurmEndpoint || null,
		},
		"Starting metrics collector",
	);

	// Initial collection
	collect().catch((err) => log.error({ err }, "Collection failed"));

	// Schedule periodic collection
	intervalId = setInterval(() => {
		collect().catch((err) => log.error({ err }, "Collection failed"));
	}, config.collectInterval);
}

export function stopCollector(): void {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = null;
		log.info("Stopped metrics collector");
	}
}
