import { useCallback, useEffect, useState } from "react";
import type { ClusterStatus, NodeMetrics, SlurmMetrics } from "../types/metrics";

interface MetricsConfig {
	apiEndpoint?: string;
	refreshInterval?: number;
}

interface ApiResponse {
	nodes: Array<{
		nodeId: string;
		hostname: string;
		gpus: Array<{
			gpu: string;
			gpuName: string;
			utilization: number;
			memoryUtilization: number;
			memoryUsedMB: number;
			memoryFreeMB: number;
			memoryTotalMB: number;
			temperatureC: number;
			powerUsageW: number;
			smClockMHz: number;
			memClockMHz: number;
		}>;
		timestamp: string;
	}>;
	slurm: {
		nodes: Array<{
			node: string;
			status: "idle" | "alloc" | "mix" | "down" | "drain";
			cpusAlloc: number;
			cpusIdle: number;
			cpusTotal: number;
			memAlloc: number;
			memTotal: number;
		}>;
		cpusTotal: number;
		cpusAlloc: number;
		cpusIdle: number;
		nodesTotal: number;
		nodesIdle: number;
		nodesAlloc: number;
		queue: {
			pending: number;
			running: number;
			completed: number;
			failed: number;
			cancelled: number;
		};
	} | null;
	lastUpdated: string;
}

export function useMetrics(config: MetricsConfig = {}) {
	const { apiEndpoint = "/api/metrics/current", refreshInterval = 5000 } = config;

	const [status, setStatus] = useState<ClusterStatus>({
		nodes: [],
		slurm: null,
		lastUpdated: new Date(),
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchMetrics = useCallback(async () => {
		try {
			const response = await fetch(apiEndpoint);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data: ApiResponse = await response.json();

			// Transform API response to ClusterStatus
			const nodes: NodeMetrics[] = data.nodes.map((node) => ({
				nodeId: node.nodeId,
				hostname: node.hostname,
				gpus: node.gpus,
				timestamp: new Date(node.timestamp),
			}));

			const slurm: SlurmMetrics | null = data.slurm
				? {
						...data.slurm,
						jobs: [], // Backend doesn't track jobs yet
					}
				: null;

			setStatus({
				nodes,
				slurm,
				lastUpdated: new Date(data.lastUpdated),
			});
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch metrics");
		} finally {
			setLoading(false);
		}
	}, [apiEndpoint]);

	useEffect(() => {
		fetchMetrics();
		const interval = setInterval(fetchMetrics, refreshInterval);
		return () => clearInterval(interval);
	}, [fetchMetrics, refreshInterval]);

	return { status, loading, error, refresh: fetchMetrics };
}
