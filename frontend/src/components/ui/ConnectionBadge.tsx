import { Badge, Flex, Text } from "@radix-ui/themes";
import type { StatusColor } from "../../lib/colors";

interface ConnectionBadgeProps {
	isConnected: boolean;
	hasError: boolean;
	errorMessage?: string;
}

function getConnectionStatus(
	isConnected: boolean,
	hasError: boolean,
): { label: string; color: StatusColor } {
	if (hasError) return { label: "Error", color: "red" };
	if (isConnected) return { label: "Live", color: "green" };
	return { label: "Connecting", color: "yellow" };
}

export function ConnectionBadge({
	isConnected,
	hasError,
	errorMessage,
}: ConnectionBadgeProps) {
	const { label, color } = getConnectionStatus(isConnected, hasError);

	return (
		<Flex align="center" gap="2">
			<Badge color={color} variant="soft" radius="full">
				<Flex align="center" gap="1">
					<span
						style={{
							width: 6,
							height: 6,
							borderRadius: "50%",
							backgroundColor: `var(--${color}-9)`,
							animation: isConnected && !hasError ? "pulse 2s infinite" : undefined,
						}}
					/>
					{label}
				</Flex>
			</Badge>
			{hasError && errorMessage && (
				<Text size="1" color="red">
					{errorMessage}
				</Text>
			)}
		</Flex>
	);
}

// Add pulse animation
if (typeof document !== "undefined") {
	const styleId = "connection-badge-animation";
	if (!document.getElementById(styleId)) {
		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
			@keyframes pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.5; }
			}
		`;
		document.head.appendChild(style);
	}
}
