import { useCallback, useEffect, useState } from "react";
import type { DataPoint } from "../components/charts/TimeSeriesChart";

// Backend response types
interface GpuHistoryItem {
	nodeId: string;
	gpuIndex: number;
	data: Array<{
		timestamp: number;
		utilization: number;
		memoryUsedMb: number;
		memoryTotalMb: number;
		temperatureC: number;
		powerUsageW: number;
	}>;
}

interface GpuHistoryResponse {
	range: { start: number; end: number };
	data: GpuHistoryItem[];
}

interface SlurmHistoryResponse {
	range: { start: number; end: number };
	data: {
		data: Array<{
			timestamp: number;
			cpusTotal: number;
			cpusAlloc: number;
			cpusIdle: number;
			nodesTotal: number;
			nodesIdle: number;
			nodesAlloc: number;
			queuePending: number;
			queueRunning: number;
			queueCompleted: number;
			queueFailed: number;
		}>;
	};
}

export interface GpuHistory {
	utilization: DataPoint[];
	memory: DataPoint[];
	temperature: DataPoint[];
	power: DataPoint[];
}

export interface SlurmHistory {
	cpusAlloc: DataPoint[];
	cpusIdle: DataPoint[];
	jobsRunning: DataPoint[];
	jobsPending: DataPoint[];
}

interface UseHistoryConfig {
	refreshInterval?: number;
	duration?: number; // in minutes
}

export function useGpuHistory(
	nodeId: string,
	gpu: string,
	config: UseHistoryConfig = {},
) {
	const { refreshInterval = 30000, duration = 60 } = config;
	const [history, setHistory] = useState<GpuHistory | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchHistory = useCallback(async () => {
		try {
			const response = await fetch(
				`/api/metrics/history/gpu?nodeId=${encodeURIComponent(nodeId)}&duration=${duration}`,
			);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const result: GpuHistoryResponse = await response.json();

			// Find the matching GPU data
			const gpuIndex = Number.parseInt(gpu, 10);
			const gpuData = result.data.find(
				(d) => d.nodeId === nodeId && d.gpuIndex === gpuIndex,
			);

			if (!gpuData || gpuData.data.length === 0) {
				setHistory({
					utilization: [],
					memory: [],
					temperature: [],
					power: [],
				});
				setError(null);
				setLoading(false);
				return;
			}

			// Sort by timestamp ascending for charts
			const sortedData = [...gpuData.data].sort((a, b) => a.timestamp - b.timestamp);

			const transformedHistory: GpuHistory = {
				utilization: sortedData.map((h) => ({
					timestamp: h.timestamp,
					value: h.utilization,
				})),
				memory: sortedData.map((h) => ({
					timestamp: h.timestamp,
					value: h.memoryUsedMb,
				})),
				temperature: sortedData.map((h) => ({
					timestamp: h.timestamp,
					value: h.temperatureC,
				})),
				power: sortedData.map((h) => ({
					timestamp: h.timestamp,
					value: h.powerUsageW,
				})),
			};

			setHistory(transformedHistory);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch history");
		} finally {
			setLoading(false);
		}
	}, [nodeId, gpu, duration]);

	useEffect(() => {
		fetchHistory();
		const interval = setInterval(fetchHistory, refreshInterval);
		return () => clearInterval(interval);
	}, [fetchHistory, refreshInterval]);

	return { history, loading, error, refresh: fetchHistory };
}

export function useSlurmHistory(config: UseHistoryConfig = {}) {
	const { refreshInterval = 30000, duration = 60 } = config;
	const [history, setHistory] = useState<SlurmHistory | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchHistory = useCallback(async () => {
		try {
			const response = await fetch(
				`/api/metrics/history/slurm?duration=${duration}`,
			);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const result: SlurmHistoryResponse = await response.json();

			if (!result.data?.data || result.data.data.length === 0) {
				setHistory({
					cpusAlloc: [],
					cpusIdle: [],
					jobsRunning: [],
					jobsPending: [],
				});
				setError(null);
				setLoading(false);
				return;
			}

			// Sort by timestamp ascending
			const sortedData = [...result.data.data].sort((a, b) => a.timestamp - b.timestamp);

			const transformedHistory: SlurmHistory = {
				cpusAlloc: sortedData.map((h) => ({
					timestamp: h.timestamp,
					value: h.cpusAlloc,
				})),
				cpusIdle: sortedData.map((h) => ({
					timestamp: h.timestamp,
					value: h.cpusIdle,
				})),
				jobsRunning: sortedData.map((h) => ({
					timestamp: h.timestamp,
					value: h.queueRunning,
				})),
				jobsPending: sortedData.map((h) => ({
					timestamp: h.timestamp,
					value: h.queuePending,
				})),
			};

			setHistory(transformedHistory);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch history");
		} finally {
			setLoading(false);
		}
	}, [duration]);

	useEffect(() => {
		fetchHistory();
		const interval = setInterval(fetchHistory, refreshInterval);
		return () => clearInterval(interval);
	}, [fetchHistory, refreshInterval]);

	return { history, loading, error, refresh: fetchHistory };
}
