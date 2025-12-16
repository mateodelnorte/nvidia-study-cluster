import { useCallback, useEffect, useRef, useState } from "react";
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
	consecutiveErrors: number;
	refresh: () => Promise<void>;
	retry: () => Promise<void>;
	refreshInterval: number;
}

export function useMetrics(config: MetricsConfig = {}): MetricsState {
	const { apiEndpoint = "/api/metrics/current", refreshInterval = 5000 } = config;

	const [status, setStatus] = useState<ClusterStatus>({
		nodes: [],
		slurm: null,
		lastUpdated: new Date(),
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
	const [consecutiveErrors, setConsecutiveErrors] = useState(0);

	const retryTimeoutRef = useRef<number | null>(null);
	const intervalRef = useRef<number | null>(null);

	// Calculate backoff delay with exponential backoff (max 30s)
	const getBackoffDelay = useCallback(
		(errorCount: number) => {
			const baseDelay = refreshInterval;
			const backoffDelay = Math.min(baseDelay * 2 ** errorCount, 30000);
			return backoffDelay;
		},
		[refreshInterval],
	);

	const fetchMetrics = useCallback(
		async (isRetry = false) => {
			try {
				if (!isRetry) {
					setLoading(true);
				}

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

				setStatus({
					nodes,
					slurm,
					lastUpdated: new Date(data.lastUpdated),
				});
				setError(null);
				setIsConnected(true);
				setLastFetchTime(new Date());
				setConsecutiveErrors(0);
			} catch (err) {
				const errorMessage =
					err instanceof Error
						? err.name === "AbortError"
							? "Request timed out"
							: err.message
						: "Failed to fetch metrics";

				setError(errorMessage);
				setIsConnected(false);
				setConsecutiveErrors((prev) => prev + 1);
			} finally {
				setLoading(false);
			}
		},
		[apiEndpoint],
	);

	// Manual retry with immediate fetch
	const retry = useCallback(async () => {
		// Clear any pending backoff
		if (retryTimeoutRef.current) {
			clearTimeout(retryTimeoutRef.current);
			retryTimeoutRef.current = null;
		}
		setConsecutiveErrors(0);
		await fetchMetrics(true);
	}, [fetchMetrics]);

	// Set up polling with exponential backoff on errors
	useEffect(() => {
		// Initial fetch
		fetchMetrics();

		const scheduleNext = () => {
			const delay =
				consecutiveErrors > 0
					? getBackoffDelay(consecutiveErrors)
					: refreshInterval;

			intervalRef.current = window.setTimeout(() => {
				fetchMetrics().then(scheduleNext);
			}, delay);
		};

		// Start polling after initial fetch
		const initialTimeout = window.setTimeout(scheduleNext, refreshInterval);

		return () => {
			clearTimeout(initialTimeout);
			if (intervalRef.current) {
				clearTimeout(intervalRef.current);
			}
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current);
			}
		};
	}, [fetchMetrics, refreshInterval, consecutiveErrors, getBackoffDelay]);

	return {
		status,
		loading,
		error,
		isConnected,
		lastFetchTime,
		consecutiveErrors,
		refresh: fetchMetrics,
		retry,
		refreshInterval,
	};
}
