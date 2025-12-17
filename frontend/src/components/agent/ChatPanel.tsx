import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Heading,
	IconButton,
	ScrollArea,
	Text,
	TextArea,
} from "@radix-ui/themes";
import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAgent, type ChatMessage, type ToolCallInfo } from "../../hooks/use-agent";

export function ChatPanel() {
	const {
		messages,
		sendMessage,
		clearMessages,
		isLoading,
		error,
		health,
		isHealthLoading,
		showLogs,
		toggleLogs,
		logs,
		logsLoading,
	} = useAgent();
	const [input, setInput] = useState("");
	const [expanded, setExpanded] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const logsRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom on new messages
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages]);

	// Auto-scroll logs to bottom when logs change
	useEffect(() => {
		if (logsRef.current && showLogs) {
			logsRef.current.scrollTop = logsRef.current.scrollHeight;
		}
	}, [logs, showLogs]);

	const handleSend = async () => {
		const trimmed = input.trim();
		if (!trimmed || isLoading) return;

		setInput("");
		await sendMessage(trimmed);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const isAvailable = health?.available ?? false;

	return (
		<Card style={{ cursor: expanded ? "default" : "pointer" }} onClick={() => !expanded && setExpanded(true)}>
			<Flex direction="column" gap="3">
				{/* Header */}
				<Flex justify="between" align="center" onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
					<Flex align="center" gap="2">
						<AgentIcon />
						<Heading size="3">AI Assistant</Heading>
						{isHealthLoading ? (
							<Badge color="gray" variant="soft">
								Checking...
							</Badge>
						) : isAvailable ? (
							<Badge color="green" variant="soft">
								Online
							</Badge>
						) : (
							<Badge color="orange" variant="soft">
								Offline
							</Badge>
						)}
					</Flex>
					<Flex align="center" gap="2">
						{health?.model && (
							<Text size="1" color="gray">
								{health.model.split("/").pop()}
							</Text>
						)}
						<ExpandIcon expanded={expanded} />
					</Flex>
				</Flex>

				{/* Expanded content */}
				{expanded && (
					<Box
						pt="3"
						style={{
							borderTop: "1px solid var(--gray-a4)",
							animation: "fadeIn 0.2s ease",
						}}
						onClick={(e) => e.stopPropagation()}
					>
						{!isAvailable && !isHealthLoading && (
							<Box
								mb="3"
								p="3"
								style={{
									background: "var(--orange-a2)",
									borderRadius: "var(--radius-2)",
									border: "1px solid var(--orange-a5)",
								}}
							>
								<Flex justify="between" align="center">
									<Text size="2" color="orange">
										{logsLoading ? "Model loading..." : health?.error || "LLM server not available"}
									</Text>
									<Button size="1" variant="soft" color="orange" onClick={toggleLogs}>
										{showLogs ? "Hide Logs" : "View Logs"}
									</Button>
								</Flex>
							</Box>
						)}

						{/* vLLM Logs panel */}
						{showLogs && (
							<Box
								mb="3"
								p="2"
								ref={logsRef}
								style={{
									background: "var(--gray-1)",
									borderRadius: "var(--radius-2)",
									border: "1px solid var(--gray-a5)",
									maxHeight: "200px",
									overflow: "auto",
									fontFamily: "monospace",
									fontSize: "11px",
									whiteSpace: "pre-wrap",
									wordBreak: "break-all",
								}}
							>
								{logs || (logsLoading ? "Waiting for logs..." : "No logs available")}
							</Box>
						)}

						{/* Messages area */}
						<ScrollArea
							ref={scrollRef}
							style={{
								height: "300px",
								background: "var(--gray-a2)",
								borderRadius: "var(--radius-2)",
								marginBottom: "12px",
							}}
						>
							<Box p="3">
								{messages.length === 0 ? (
									<Flex
										align="center"
										justify="center"
										style={{ height: "100%", minHeight: "260px" }}
									>
										<Text size="2" color="gray" align="center">
											Ask questions about your GPU cluster.
											<br />
											<Text size="1" color="gray">
												e.g., "How is the cluster doing?" or "Is node-0 running hot?"
											</Text>
										</Text>
									</Flex>
								) : (
									<Flex direction="column" gap="3">
										{messages.map((msg, idx) => (
											<MessageBubble key={idx} message={msg} />
										))}
										{isLoading && (
											<Flex align="center" gap="2" pl="2">
												<LoadingDots />
												<Text size="1" color="gray">
													Thinking...
												</Text>
											</Flex>
										)}
									</Flex>
								)}
							</Box>
						</ScrollArea>

						{/* Error display */}
						{error && (
							<Box
								mb="2"
								p="2"
								style={{
									background: "var(--red-a2)",
									borderRadius: "var(--radius-2)",
								}}
							>
								<Text size="1" color="red">
									{error}
								</Text>
							</Box>
						)}

						{/* Input area */}
						<Flex gap="2">
							<Box style={{ flex: 1 }}>
								<TextArea
									placeholder={isAvailable ? "Ask about your cluster..." : "LLM unavailable"}
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={handleKeyDown}
									disabled={!isAvailable || isLoading}
									style={{ minHeight: "60px" }}
								/>
							</Box>
							<Flex direction="column" gap="1">
								<Button
									onClick={handleSend}
									disabled={!isAvailable || isLoading || !input.trim()}
								>
									<SendIcon />
								</Button>
								{messages.length > 0 && (
									<IconButton
										variant="soft"
										color="gray"
										onClick={clearMessages}
										title="Clear chat"
									>
										<ClearIcon />
									</IconButton>
								)}
							</Flex>
						</Flex>
					</Box>
				)}
			</Flex>
		</Card>
	);
}

function MessageBubble({ message }: { message: ChatMessage }) {
	const [showTools, setShowTools] = useState(false);
	const isUser = message.role === "user";

	return (
		<Box
			style={{
				alignSelf: isUser ? "flex-end" : "flex-start",
				maxWidth: "85%",
			}}
		>
			<Box
				p="3"
				style={{
					background: isUser ? "var(--accent-a4)" : "var(--gray-a3)",
					borderRadius: "var(--radius-3)",
					borderTopRightRadius: isUser ? "var(--radius-1)" : undefined,
					borderTopLeftRadius: !isUser ? "var(--radius-1)" : undefined,
				}}
			>
				{isUser ? (
					<Text
						size="2"
						style={{
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
						}}
					>
						{message.content}
					</Text>
				) : (
					<Box className="markdown-content">
						<Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
					</Box>
				)}
			</Box>

			{/* Tool calls disclosure */}
			{message.toolCalls && message.toolCalls.length > 0 && (
				<Box mt="1">
					<Button
						variant="ghost"
						size="1"
						onClick={() => setShowTools(!showTools)}
						style={{ padding: "2px 6px" }}
					>
						<Text size="1" color="gray">
							{showTools ? "Hide" : "Show"} {message.toolCalls.length} tool
							{message.toolCalls.length === 1 ? "" : "s"} used
						</Text>
					</Button>
					{showTools && (
						<Box
							mt="1"
							p="2"
							style={{
								background: "var(--gray-a2)",
								borderRadius: "var(--radius-2)",
								fontSize: "11px",
								fontFamily: "monospace",
							}}
						>
							{message.toolCalls.map((tool, idx) => (
								<ToolCallDisplay key={idx} tool={tool} />
							))}
						</Box>
					)}
				</Box>
			)}

			<Text
				size="1"
				color="gray"
				style={{
					display: "block",
					marginTop: "4px",
					textAlign: isUser ? "right" : "left",
				}}
			>
				{message.timestamp.toLocaleTimeString()}
			</Text>
		</Box>
	);
}

function ToolCallDisplay({ tool }: { tool: ToolCallInfo }) {
	return (
		<Box mb="2">
			<Text weight="medium" style={{ color: "var(--accent-11)" }}>
				{tool.name}
			</Text>
			{Object.keys(tool.arguments).length > 0 && (
				<Text color="gray" style={{ display: "block" }}>
					args: {JSON.stringify(tool.arguments)}
				</Text>
			)}
		</Box>
	);
}

function LoadingDots() {
	return (
		<Flex gap="1">
			{[0, 1, 2].map((i) => (
				<Box
					key={i}
					style={{
						width: "6px",
						height: "6px",
						borderRadius: "50%",
						background: "var(--gray-8)",
						animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
					}}
				/>
			))}
			<style>
				{`
					@keyframes pulse {
						0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
						40% { opacity: 1; transform: scale(1); }
					}
				`}
			</style>
		</Flex>
	);
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			style={{
				transition: "transform 0.2s ease",
				transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
				opacity: 0.5,
			}}
		>
			<path d="M4 6l4 4 4-4" />
		</svg>
	);
}

function AgentIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M8 14s1.5 2 4 2 4-2 4-2" />
			<line x1="9" y1="9" x2="9.01" y2="9" />
			<line x1="15" y1="9" x2="15.01" y2="9" />
		</svg>
	);
}

function SendIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<line x1="22" y1="2" x2="11" y2="13" />
			<polygon points="22 2 15 22 11 13 2 9 22 2" />
		</svg>
	);
}

function ClearIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
		</svg>
	);
}
