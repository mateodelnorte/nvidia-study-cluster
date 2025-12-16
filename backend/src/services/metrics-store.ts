import { and, desc, gte, lte } from "drizzle-orm";
import { config } from "../config.js";
import { gpuMetrics, slurmMetrics } from "../db/schema.js";
import { getDb } from "../lib/db.js";

export interface TimeRange {
	start: number;
	end: number;
}

export interface GpuMetricsHistory {
	nodeId: string;
	gpuIndex: number;
	data: {
		timestamp: number;
		utilization: number;
		memoryUsedMb: number;
		memoryTotalMb: number;
		temperatureC: number;
		powerUsageW: number;
	}[];
}

export interface SlurmMetricsHistory {
	data: {
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
	}[];
}

export function getGpuHistory(
	range: TimeRange,
	nodeId?: string,
): GpuMetricsHistory[] {
	const db = getDb();

	const conditions = [
		gte(gpuMetrics.timestamp, range.start),
		lte(gpuMetrics.timestamp, range.end),
	];

	if (nodeId) {
		conditions.push(
			// @ts-expect-error drizzle eq type
			gpuMetrics.nodeId === nodeId,
		);
	}

	const rows = db
		.select()
		.from(gpuMetrics)
		.where(and(...conditions))
		.orderBy(desc(gpuMetrics.timestamp))
		.all();

	// Group by node and GPU
	const grouped = new Map<string, typeof rows>();
	for (const row of rows) {
		const key = `${row.nodeId}:${row.gpuIndex}`;
		if (!grouped.has(key)) {
			grouped.set(key, []);
		}
		grouped.get(key)!.push(row);
	}

	return Array.from(grouped.entries()).map(([key, data]) => {
		const [nodeId, gpuIndex] = key.split(":");
		return {
			nodeId,
			gpuIndex: Number.parseInt(gpuIndex, 10),
			data: data.map((row) => ({
				timestamp: row.timestamp,
				utilization: row.utilization,
				memoryUsedMb: row.memoryUsedMb,
				memoryTotalMb: row.memoryTotalMb,
				temperatureC: row.temperatureC,
				powerUsageW: row.powerUsageW,
			})),
		};
	});
}

export function getSlurmHistory(range: TimeRange): SlurmMetricsHistory {
	const db = getDb();

	const rows = db
		.select()
		.from(slurmMetrics)
		.where(
			and(
				gte(slurmMetrics.timestamp, range.start),
				lte(slurmMetrics.timestamp, range.end),
			),
		)
		.orderBy(desc(slurmMetrics.timestamp))
		.all();

	return {
		data: rows.map((row) => ({
			timestamp: row.timestamp,
			cpusTotal: row.cpusTotal,
			cpusAlloc: row.cpusAlloc,
			cpusIdle: row.cpusIdle,
			nodesTotal: row.nodesTotal,
			nodesIdle: row.nodesIdle,
			nodesAlloc: row.nodesAlloc,
			queuePending: row.queuePending,
			queueRunning: row.queueRunning,
			queueCompleted: row.queueCompleted,
			queueFailed: row.queueFailed,
		})),
	};
}

export function cleanupOldMetrics(): void {
	const db = getDb();
	const cutoff = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;

	const gpuResult = db
		.delete(gpuMetrics)
		.where(lte(gpuMetrics.timestamp, cutoff))
		.run();

	const slurmResult = db
		.delete(slurmMetrics)
		.where(lte(slurmMetrics.timestamp, cutoff))
		.run();

	console.log(
		`[Cleanup] Removed ${gpuResult.changes} GPU rows, ${slurmResult.changes} Slurm rows older than ${config.retentionDays} days`,
	);
}
