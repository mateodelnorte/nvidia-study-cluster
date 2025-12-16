import { useQuery } from "@tanstack/react-query";
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

export interface MetricsState {
	status: ClusterStatus;
	loading: boolean;
	error: string | null;
	isConnected: boolean;
	lastFetchTime: Date | null;
	failureCount: number;
	refresh: () => Promise<void>;
	refreshInterval: number;
	isFetching: boolean;
}

async function fetchMetrics(apiEndpoint: string): Promise<ClusterStatus> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);

	try {
		const response = await fetch(apiEndpoint, {
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

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
					jobs: [],
				}
			: null;

		return {
			nodes,
			slurm,
			lastUpdated: new Date(data.lastUpdated),
		};
	} catch (err) {
		clearTimeout(timeoutId);
		if (err instanceof Error && err.name === "AbortError") {
			throw new Error("Request timed out");
		}
		throw err;
	}
}

export function useMetrics(config: MetricsConfig = {}): MetricsState {
	const { apiEndpoint = "/api/metrics/current", refreshInterval = 5000 } = config;

	const {
		data,
		error,
		isLoading,
		isFetching,
		isSuccess,
		dataUpdatedAt,
		failureCount,
		refetch,
	} = useQuery({
		queryKey: ["metrics", apiEndpoint],
		queryFn: () => fetchMetrics(apiEndpoint),
		refetchInterval: refreshInterval,
		// After 3 retries with backoff, stop retrying until next interval
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
		// Keep stale data visible while refetching
		staleTime: refreshInterval - 1000,
		// Don't garbage collect cached data quickly
		gcTime: 5 * 60 * 1000, // 5 minutes
	});

	const status: ClusterStatus = data ?? {
		nodes: [],
		slurm: null,
		lastUpdated: new Date(),
	};

	return {
		status,
		loading: isLoading,
		error: error instanceof Error ? error.message : error ? String(error) : null,
		isConnected: isSuccess && !error,
		lastFetchTime: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
		failureCount,
		refresh: async () => {
			await refetch();
		},
		refreshInterval,
		isFetching,
	};
}
