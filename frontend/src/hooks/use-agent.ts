import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	toolCalls?: ToolCallInfo[];
	timestamp: Date;
}

export interface ToolCallInfo {
	name: string;
	arguments: Record<string, unknown>;
	result: unknown;
}

interface AgentChatResponse {
	response: string;
	toolCalls: ToolCallInfo[];
}

interface AgentHealthResponse {
	available: boolean;
	model?: string;
	error?: string;
}

interface AgentLogsResponse {
	logs: string;
	loading: boolean;
	error?: string;
}

async function sendChatMessage(
	message: string,
	history: ChatMessage[],
): Promise<AgentChatResponse> {
	const response = await fetch("/api/agent/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			message,
			history: history.map((m) => ({
				role: m.role,
				content: m.content,
			})),
		}),
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.message || `HTTP ${response.status}`);
	}

	return response.json();
}

async function checkAgentHealth(): Promise<AgentHealthResponse> {
	const response = await fetch("/api/agent/health");
	if (!response.ok) {
		return { available: false, error: `HTTP ${response.status}` };
	}
	return response.json();
}

async function fetchAgentLogs(lines = 100): Promise<AgentLogsResponse> {
	const response = await fetch(`/api/agent/logs?lines=${lines}`);
	if (!response.ok) {
		return { logs: "", loading: true, error: `HTTP ${response.status}` };
	}
	return response.json();
}

export function useAgent() {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [showLogs, setShowLogs] = useState(false);

	const healthQuery = useQuery({
		queryKey: ["agent-health"],
		queryFn: checkAgentHealth,
		refetchInterval: 30000, // Check health every 30s
		staleTime: 10000,
	});

	const logsQuery = useQuery({
		queryKey: ["agent-logs"],
		queryFn: () => fetchAgentLogs(200),
		refetchInterval: showLogs ? 3000 : false, // Poll every 3s when showing logs
		enabled: showLogs,
	});

	const chatMutation = useMutation({
		mutationFn: ({ message, history }: { message: string; history: ChatMessage[] }) =>
			sendChatMessage(message, history),
		onSuccess: (data, variables) => {
			// Add assistant response to messages
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: data.response,
					toolCalls: data.toolCalls,
					timestamp: new Date(),
				},
			]);
		},
	});

	const sendMessage = useCallback(
		async (message: string) => {
			// Add user message to state
			const userMessage: ChatMessage = {
				role: "user",
				content: message,
				timestamp: new Date(),
			};

			setMessages((prev) => [...prev, userMessage]);

			// Send to backend with history (excluding the message we just added)
			await chatMutation.mutateAsync({
				message,
				history: messages,
			});
		},
		[messages, chatMutation],
	);

	const clearMessages = useCallback(() => {
		setMessages([]);
	}, []);

	const toggleLogs = useCallback(() => {
		setShowLogs((prev) => !prev);
	}, []);

	return {
		messages,
		sendMessage,
		clearMessages,
		isLoading: chatMutation.isPending,
		error: chatMutation.error?.message || null,
		health: healthQuery.data,
		isHealthLoading: healthQuery.isLoading,
		// Logs
		showLogs,
		toggleLogs,
		logs: logsQuery.data?.logs || "",
		logsLoading: logsQuery.data?.loading ?? true,
	};
}
