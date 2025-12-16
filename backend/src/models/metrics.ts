import { z } from "zod";

export const GpuMetricsSchema = z.object({
	gpu: z.string(),
	gpuName: z.string(),
	utilization: z.number(),
	memoryUtilization: z.number(),
	memoryUsedMB: z.number(),
	memoryFreeMB: z.number(),
	memoryTotalMB: z.number(),
	temperatureC: z.number(),
	powerUsageW: z.number(),
	smClockMHz: z.number(),
	memClockMHz: z.number(),
});

export type GpuMetrics = z.infer<typeof GpuMetricsSchema>;

export const NodeMetricsSchema = z.object({
	nodeId: z.string(),
	hostname: z.string(),
	gpus: z.array(GpuMetricsSchema),
	timestamp: z.date(),
});

export type NodeMetrics = z.infer<typeof NodeMetricsSchema>;

export const SlurmQueueStatsSchema = z.object({
	pending: z.number(),
	running: z.number(),
	completed: z.number(),
	failed: z.number(),
	cancelled: z.number(),
});

export type SlurmQueueStats = z.infer<typeof SlurmQueueStatsSchema>;

export const SlurmNodeStatusSchema = z.object({
	node: z.string(),
	status: z.enum(["idle", "alloc", "mix", "down", "drain"]),
	cpusAlloc: z.number(),
	cpusIdle: z.number(),
	cpusTotal: z.number(),
	memAlloc: z.number(),
	memTotal: z.number(),
});

export type SlurmNodeStatus = z.infer<typeof SlurmNodeStatusSchema>;

export const SlurmMetricsSchema = z.object({
	nodes: z.array(SlurmNodeStatusSchema),
	cpusTotal: z.number(),
	cpusAlloc: z.number(),
	cpusIdle: z.number(),
	nodesTotal: z.number(),
	nodesIdle: z.number(),
	nodesAlloc: z.number(),
	queue: SlurmQueueStatsSchema,
});

export type SlurmMetrics = z.infer<typeof SlurmMetricsSchema>;

export const ClusterStatusSchema = z.object({
	nodes: z.array(NodeMetricsSchema),
	slurm: SlurmMetricsSchema.nullable(),
	lastUpdated: z.date(),
});

export type ClusterStatus = z.infer<typeof ClusterStatusSchema>;

// Database models
export interface MetricSnapshot {
	id?: number;
	timestamp: number; // Unix timestamp ms
	nodeId: string;
	gpuIndex: number;
	utilization: number;
	memoryUsedMB: number;
	memoryTotalMB: number;
	temperatureC: number;
	powerUsageW: number;
}

export interface SlurmSnapshot {
	id?: number;
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
}
