export interface GpuMetrics {
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
}

export interface NodeMetrics {
	nodeId: string;
	hostname: string;
	gpus: GpuMetrics[];
	timestamp: Date;
}

export interface SlurmJob {
	jobId: string;
	partition: string;
	name: string;
	user: string;
	state: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
	time: string;
	nodes: number;
	nodeList: string;
}

export interface SlurmNodeStatus {
	node: string;
	status: "idle" | "alloc" | "mix" | "down" | "drain";
	cpusAlloc: number;
	cpusIdle: number;
	cpusTotal: number;
	memAlloc: number;
	memTotal: number;
}

export interface SlurmQueueStats {
	pending: number;
	running: number;
	completed: number;
	failed: number;
	cancelled: number;
}

export interface SlurmMetrics {
	nodes: SlurmNodeStatus[];
	jobs: SlurmJob[];
	cpusTotal: number;
	cpusAlloc: number;
	cpusIdle: number;
	nodesTotal: number;
	nodesIdle: number;
	nodesAlloc: number;
	queue: SlurmQueueStats;
}

export interface ClusterStatus {
	nodes: NodeMetrics[];
	slurm: SlurmMetrics | null;
	lastUpdated: Date;
}
