export const config = {
	port: Number(process.env.PORT) || 8080,

	// Metrics collection endpoints
	gpuEndpoints: process.env.GPU_ENDPOINTS?.split(",").filter(Boolean) || [],
	slurmEndpoint: process.env.SLURM_ENDPOINT || "",

	// Collection interval in milliseconds
	collectInterval: Number(process.env.COLLECT_INTERVAL) || 10000,

	// Database
	dbPath: process.env.DB_PATH || "./data/metrics.db",
	retentionDays: Number(process.env.RETENTION_DAYS) || 7,

	// Alert evaluation interval in milliseconds
	evaluationInterval: Number(process.env.EVALUATION_INTERVAL) || 30000,
};
