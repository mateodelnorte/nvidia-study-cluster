import cors from "cors";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger.js";
import agentRouter from "./routes/agent.js";
import alertsRouter from "./routes/alerts.js";
import clusterRouter from "./routes/cluster.js";
import metricsRouter from "./routes/metrics.js";

export function createApp(): Express {
	const app = express();

	// Middleware
	app.use(cors());
	app.use(express.json());
	app.use(
		pinoHttp.default({
			logger,
			autoLogging: {
				ignore: (req: Request) => req.url === "/health",
			},
		}),
	);

	// Health check
	app.get("/health", (_req, res) => {
		res.json({ status: "ok", timestamp: new Date().toISOString() });
	});

	// API routes
	app.use("/api/metrics", metricsRouter);
	app.use("/api/alerts", alertsRouter);
	app.use("/api/cluster", clusterRouter);
	app.use("/api/agent", agentRouter);

	// Error handler
	app.use(
		(
			err: Error,
			_req: Request,
			res: Response,
			_next: NextFunction,
		) => {
			logger.error({ err }, "Unhandled error");
			res.status(500).json({ error: "Internal server error" });
		},
	);

	return app;
}
