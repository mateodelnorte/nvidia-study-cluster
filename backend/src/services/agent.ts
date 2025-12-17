/**
 * AI Diagnostic Agent Service
 *
 * Model-agnostic agent using OpenAI-compatible API format.
 * Designed to work with NVIDIA Nemotron-3-Nano-30B via vLLM.
 */

import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("services:agent");

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ChatMessage {
	role: "user" | "assistant" | "system" | "tool";
	content: string | null;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
	name?: string;
}

export interface ToolCall {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string;
	};
}

export interface ToolDefinition {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: "object";
			properties: Record<string, unknown>;
			required?: string[];
		};
	};
}

export interface AgentResponse {
	response: string;
	toolCalls: Array<{
		name: string;
		arguments: Record<string, unknown>;
		result: unknown;
	}>;
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const agentConfig = {
	baseUrl: process.env.LLM_BASE_URL || "http://localhost:8000/v1",
	apiKey: process.env.LLM_API_KEY || "not-needed",
	model:
		process.env.LLM_MODEL || "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16",
	backendUrl: process.env.BACKEND_BASE_URL || "http://localhost:8080",
	maxIterations: 10,
	temperature: 0.7,
	maxTokens: 4096,
};

// -----------------------------------------------------------------------------
// Tool Definitions (OpenAI format)
// -----------------------------------------------------------------------------

const tools: ToolDefinition[] = [
	{
		type: "function",
		function: {
			name: "get_cluster_status",
			description:
				"Get overall cluster health status including node count, GPU count, average utilization, temperature, memory usage, and Slurm job queue status.",
			parameters: {
				type: "object",
				properties: {},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_current_metrics",
			description:
				"Get the latest metrics snapshot for all nodes including GPU utilization, memory, temperature, power usage, and Slurm queue status.",
			parameters: {
				type: "object",
				properties: {},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_node_details",
			description:
				"Get detailed GPU metrics for a specific node including per-GPU utilization, memory, temperature, and power.",
			parameters: {
				type: "object",
				properties: {
					nodeId: {
						type: "string",
						description:
							"The node identifier (e.g., 'node-0', 'node-1')",
					},
				},
				required: ["nodeId"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_gpu_history",
			description:
				"Get historical GPU metrics over a time period. Returns time-series data for utilization, memory, temperature, and power.",
			parameters: {
				type: "object",
				properties: {
					nodeId: {
						type: "string",
						description:
							"Optional: filter to a specific node. If not provided, returns history for all nodes.",
					},
					duration: {
						type: "number",
						description:
							"Time period in minutes to look back (default: 60)",
					},
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_alerts",
			description:
				"Get all configured alert rules including their thresholds, conditions, and enabled status.",
			parameters: {
				type: "object",
				properties: {},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_alert_history",
			description:
				"Get the history of fired alerts including timestamps and details of what triggered each alert.",
			parameters: {
				type: "object",
				properties: {
					limit: {
						type: "number",
						description:
							"Maximum number of alert events to return (default: 100)",
					},
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_slurm_status",
			description:
				"Get current Slurm workload manager status including CPU allocation, node states, and job queue.",
			parameters: {
				type: "object",
				properties: {},
			},
		},
	},
];

// -----------------------------------------------------------------------------
// Tool Executors
// -----------------------------------------------------------------------------

async function executeBackendCall(
	endpoint: string,
	queryParams?: Record<string, string | number>,
): Promise<unknown> {
	const url = new URL(endpoint, agentConfig.backendUrl);

	if (queryParams) {
		for (const [key, value] of Object.entries(queryParams)) {
			if (value !== undefined) {
				url.searchParams.set(key, String(value));
			}
		}
	}

	const response = await fetch(url.toString());

	if (!response.ok) {
		throw new Error(`Backend call failed: ${response.status}`);
	}

	return response.json();
}

type ToolArguments = Record<string, unknown>;

const toolExecutors: Record<
	string,
	(args: ToolArguments) => Promise<unknown>
> = {
	get_cluster_status: async () => {
		return executeBackendCall("/api/cluster/status");
	},

	get_current_metrics: async () => {
		return executeBackendCall("/api/metrics/current");
	},

	get_node_details: async (args) => {
		const nodeId = args.nodeId as string;
		return executeBackendCall(`/api/metrics/gpu/${nodeId}`);
	},

	get_gpu_history: async (args) => {
		const params: Record<string, string | number> = {};
		if (args.nodeId) params.nodeId = args.nodeId as string;
		if (args.duration) params.duration = args.duration as number;
		return executeBackendCall("/api/metrics/history/gpu", params);
	},

	get_alerts: async () => {
		return executeBackendCall("/api/alerts");
	},

	get_alert_history: async (args) => {
		const params: Record<string, string | number> = {};
		if (args.limit) params.limit = args.limit as number;
		return executeBackendCall("/api/alerts/events/history", params);
	},

	get_slurm_status: async () => {
		return executeBackendCall("/api/metrics/slurm");
	},
};

// -----------------------------------------------------------------------------
// LLM API Call
// -----------------------------------------------------------------------------

interface LLMResponse {
	choices: Array<{
		message: ChatMessage;
		finish_reason: string;
	}>;
}

async function callLLM(messages: ChatMessage[]): Promise<ChatMessage> {
	const response = await fetch(`${agentConfig.baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${agentConfig.apiKey}`,
		},
		body: JSON.stringify({
			model: agentConfig.model,
			messages,
			tools,
			tool_choice: "auto",
			temperature: agentConfig.temperature,
			max_tokens: agentConfig.maxTokens,
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		log.error({ status: response.status, error }, "LLM API call failed");
		throw new Error(`LLM API error: ${response.status} - ${error}`);
	}

	const data = (await response.json()) as LLMResponse;
	return data.choices[0].message;
}

// -----------------------------------------------------------------------------
// Agentic Loop
// -----------------------------------------------------------------------------

const systemPrompt = `You are an AI diagnostic assistant for a GPU cluster monitoring system. Your job is to help operators understand their cluster's health and performance.

You have access to tools that query the cluster's monitoring APIs. Use them to gather information before answering questions.

Guidelines:
- Always use tools to get current data rather than making assumptions
- Provide specific numbers and metrics when available
- Explain what the metrics mean in practical terms
- Alert operators to any concerning values (high temps, low utilization, errors)
- Be concise but thorough
- If data is unavailable, say so clearly

The cluster runs NVIDIA A100 GPUs with Slurm workload manager. Normal operating ranges:
- GPU Temperature: 30-75°C (throttle at 83°C)
- GPU Utilization: depends on workload (0% = idle, 100% = fully loaded)
- Memory: A100-80GB has ~80GB VRAM`;

export async function runAgent(
	userMessage: string,
	conversationHistory: ChatMessage[] = [],
): Promise<AgentResponse> {
	const messages: ChatMessage[] = [
		{ role: "system", content: systemPrompt },
		...conversationHistory,
		{ role: "user", content: userMessage },
	];

	const toolCallResults: AgentResponse["toolCalls"] = [];
	let iterations = 0;

	while (iterations < agentConfig.maxIterations) {
		iterations++;
		log.debug({ iteration: iterations }, "Agent loop iteration");

		const assistantMessage = await callLLM(messages);
		messages.push(assistantMessage);

		// If no tool calls, we're done
		if (
			!assistantMessage.tool_calls ||
			assistantMessage.tool_calls.length === 0
		) {
			log.info(
				{ iterations, toolCalls: toolCallResults.length },
				"Agent completed",
			);
			return {
				response: assistantMessage.content || "",
				toolCalls: toolCallResults,
			};
		}

		// Execute tool calls
		for (const toolCall of assistantMessage.tool_calls) {
			const { name, arguments: argsStr } = toolCall.function;
			log.debug({ tool: name, args: argsStr }, "Executing tool call");

			let result: unknown;
			let args: ToolArguments = {};

			try {
				args = argsStr ? JSON.parse(argsStr) : {};
				const executor = toolExecutors[name];

				if (!executor) {
					result = { error: `Unknown tool: ${name}` };
				} else {
					result = await executor(args);
				}
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : String(err);
				log.error({ tool: name, err }, "Tool execution failed");
				result = { error: errorMessage };
			}

			toolCallResults.push({
				name,
				arguments: args,
				result,
			});

			// Add tool result to messages
			messages.push({
				role: "tool",
				tool_call_id: toolCall.id,
				name,
				content: JSON.stringify(result),
			});
		}
	}

	// Hit max iterations
	log.warn({ iterations: agentConfig.maxIterations }, "Hit max iterations");
	return {
		response:
			"I apologize, but I was unable to complete the analysis. Please try a more specific question.",
		toolCalls: toolCallResults,
	};
}

// -----------------------------------------------------------------------------
// Health Check
// -----------------------------------------------------------------------------

export async function checkLLMHealth(): Promise<{
	available: boolean;
	model?: string;
	error?: string;
}> {
	try {
		const response = await fetch(`${agentConfig.baseUrl}/models`, {
			headers: {
				Authorization: `Bearer ${agentConfig.apiKey}`,
			},
		});

		if (!response.ok) {
			return { available: false, error: `HTTP ${response.status}` };
		}

		const data = (await response.json()) as {
			data: Array<{ id: string }>;
		};
		const models = data.data || [];

		return {
			available: true,
			model: models[0]?.id || agentConfig.model,
		};
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return { available: false, error: errorMessage };
	}
}

// -----------------------------------------------------------------------------
// vLLM Logs (fetched from pod log server)
// -----------------------------------------------------------------------------

export async function getVLLMLogs(lines: number = 100): Promise<{
	logs: string;
	loading: boolean;
	error?: string;
}> {
	// Log server runs on port 8002 (same host as vLLM on 8000)
	// Note: Port 8001 is used by RunPod's nginx proxy
	const logsUrl = agentConfig.baseUrl.replace(":8000/v1", ":8002");

	try {
		const response = await fetch(`${logsUrl}/logs?lines=${lines}`, {
			signal: AbortSignal.timeout(5000),
		});

		if (!response.ok) {
			return {
				logs: "",
				loading: false,
				error: `HTTP ${response.status}`,
			};
		}

		const data = (await response.json()) as {
			logs: string;
			loading: boolean;
		};
		return data;
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return {
			logs: "",
			loading: true,
			error: errorMessage,
		};
	}
}

export { agentConfig, tools };
