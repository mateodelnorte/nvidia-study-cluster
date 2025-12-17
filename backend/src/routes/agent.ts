import { type Router, Router as createRouter } from "express";
import { z } from "zod";
import { createChildLogger } from "../lib/logger.js";
import {
	runAgent,
	checkLLMHealth,
	getVLLMLogs,
	type ChatMessage,
} from "../services/agent.js";

const log = createChildLogger("routes:agent");
const router: Router = createRouter();

const ChatRequestSchema = z.object({
	message: z.string().min(1),
	history: z
		.array(
			z.object({
				role: z.enum(["user", "assistant"]),
				content: z.string(),
			}),
		)
		.optional()
		.default([]),
});

// POST /api/agent/chat - Send message to diagnostic agent
router.post("/chat", async (req, res) => {
	try {
		const { message, history } = ChatRequestSchema.parse(req.body);

		log.info({ messageLength: message.length }, "Agent chat request");

		// Convert history to ChatMessage format
		const conversationHistory: ChatMessage[] = history.map((msg) => ({
			role: msg.role,
			content: msg.content,
		}));

		const result = await runAgent(message, conversationHistory);

		res.json({
			response: result.response,
			toolCalls: result.toolCalls,
		});
	} catch (err) {
		if (err instanceof z.ZodError) {
			res.status(400).json({ error: "Invalid request", details: err.errors });
			return;
		}

		log.error({ err }, "Agent chat failed");
		res.status(500).json({
			error: "Agent request failed",
			message: err instanceof Error ? err.message : "Unknown error",
		});
	}
});

// GET /api/agent/health - Check if LLM is available
router.get("/health", async (_req, res) => {
	const health = await checkLLMHealth();
	res.json(health);
});

// GET /api/agent/logs - Get vLLM server logs
router.get("/logs", async (req, res) => {
	const lines = Math.min(Number(req.query.lines) || 100, 500);
	const logs = await getVLLMLogs(lines);
	res.json(logs);
});

export default router;
