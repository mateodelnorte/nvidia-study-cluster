import { config } from "./config.js";
import { closeDb } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { createApp } from "./app.js";
import {
	startCollector,
	stopCollector,
} from "./services/metrics-collector.js";
import { cleanupOldMetrics } from "./services/metrics-store.js";

const log = logger.child({ module: "main" });

async function main() {
	const app = createApp();

	// Start metrics collection if endpoints configured
	if (config.gpuEndpoints.length > 0 || config.slurmEndpoint) {
		startCollector();
	} else {
		log.warn("No metrics endpoints configured - collector disabled");
	}

	// Schedule daily cleanup
	const cleanupInterval = setInterval(
		() => {
			cleanupOldMetrics();
		},
		24 * 60 * 60 * 1000,
	);

	// Start server
	const server = app.listen(config.port, () => {
		log.info({ port: config.port }, "Server started");
	});

	// Graceful shutdown
	const shutdown = () => {
		log.info("Shutting down...");
		stopCollector();
		clearInterval(cleanupInterval);
		server.close(() => {
			closeDb();
			log.info("Shutdown complete");
			process.exit(0);
		});
	};

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
}

main().catch((err) => {
	log.fatal({ err }, "Failed to start server");
	process.exit(1);
});
