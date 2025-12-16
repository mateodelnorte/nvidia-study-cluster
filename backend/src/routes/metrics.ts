import { type Router, Router as createRouter } from "express";
import { z } from "zod";
import { createChildLogger } from "../lib/logger.js";
import { getState } from "../services/metrics-collector.js";
import {
	getGpuHistory,
	getSlurmHistory,
} from "../services/metrics-store.js";

const log = createChildLogger("routes:metrics");
const router: Router = createRouter();

const TimeRangeSchema = z.object({
	start: z.coerce.number().optional(),
	end: z.coerce.number().optional(),
	duration: z.coerce.number().optional(), // minutes
});

// GET /api/metrics/current - Latest metrics snapshot
router.get("/current", (_req, res) => {
	const state = getState();
	res.json({
		nodes: state.nodes,
		slurm: state.slurm,
		lastUpdated: state.lastUpdated.toISOString(),
	});
});

// GET /api/metrics/history/gpu - GPU metrics history
router.get("/history/gpu", (req, res) => {
	try {
		const query = TimeRangeSchema.parse(req.query);
		const now = Date.now();

		const range = {
			start: query.start || now - (query.duration || 60) * 60 * 1000,
			end: query.end || now,
		};

		const nodeId = typeof req.query.nodeId === "string" ? req.query.nodeId : undefined;
		const history = getGpuHistory(range, nodeId);

		res.json({ range, data: history });
	} catch (err) {
		log.error({ err }, "Failed to get GPU history");
		res.status(400).json({ error: "Invalid query parameters" });
	}
});

// GET /api/metrics/history/slurm - Slurm metrics history
router.get("/history/slurm", (req, res) => {
	try {
		const query = TimeRangeSchema.parse(req.query);
		const now = Date.now();

		const range = {
			start: query.start || now - (query.duration || 60) * 60 * 1000,
			end: query.end || now,
		};

		const history = getSlurmHistory(range);

		res.json({ range, data: history });
	} catch (err) {
		log.error({ err }, "Failed to get Slurm history");
		res.status(400).json({ error: "Invalid query parameters" });
	}
});

// GET /api/metrics/gpu/:nodeId - GPU metrics for specific node
router.get("/gpu/:nodeId", (req, res) => {
	const state = getState();
	const node = state.nodes.find((n) => n.nodeId === req.params.nodeId);

	if (!node) {
		res.status(404).json({ error: "Node not found" });
		return;
	}

	res.json(node);
});

// GET /api/metrics/slurm - Current Slurm status
router.get("/slurm", (_req, res) => {
	const state = getState();

	if (!state.slurm) {
		res.status(404).json({ error: "Slurm metrics not available" });
		return;
	}

	res.json(state.slurm);
});

export default router;
