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

	// LLM/Agent configuration
	llm: {
		baseUrl: process.env.LLM_BASE_URL || "http://localhost:8000/v1",
		apiKey: process.env.LLM_API_KEY || "not-needed",
		model: process.env.LLM_MODEL || "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16",
	},
};
