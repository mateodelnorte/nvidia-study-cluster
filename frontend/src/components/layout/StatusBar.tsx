import { Flex, Heading } from "@radix-ui/themes";
import { ConnectionBadge } from "../ui/ConnectionBadge";
import { RefreshIndicator } from "../ui/RefreshIndicator";

interface StatusBarProps {
	title?: string;
	isConnected: boolean;
	hasError: boolean;
	errorMessage?: string;
	lastUpdated: Date | null;
	refreshInterval: number;
	isLoading?: boolean;
}

export function StatusBar({
	title = "GPU Watchdog",
	isConnected,
	hasError,
	errorMessage,
	lastUpdated,
	refreshInterval,
	isLoading = false,
}: StatusBarProps) {
	return (
		<Flex
			justify="between"
			align="center"
			py="3"
			px="4"
			style={{
				borderBottom: "1px solid var(--gray-a5)",
				backgroundColor: "var(--color-background)",
				position: "sticky",
				top: 0,
				zIndex: 10,
			}}
		>
			<Flex align="center" gap="3">
				<GpuIcon />
				<Heading size="5" weight="bold">
					{title}
				</Heading>
			</Flex>

			<Flex align="center" gap="4">
				<ConnectionBadge
					isConnected={isConnected}
					hasError={hasError}
					errorMessage={errorMessage}
				/>
				<RefreshIndicator
					lastUpdated={lastUpdated}
					refreshInterval={refreshInterval}
					isLoading={isLoading}
				/>
			</Flex>
		</Flex>
	);
}

function GpuIcon() {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{/* GPU card body */}
			<rect x="2" y="6" width="20" height="12" rx="2" />
			{/* Chip */}
			<rect x="6" y="9" width="6" height="6" rx="1" />
			{/* Memory modules */}
			<line x1="15" y1="9" x2="15" y2="15" />
			<line x1="17" y1="9" x2="17" y2="15" />
			<line x1="19" y1="9" x2="19" y2="15" />
			{/* Power connector pins */}
			<line x1="5" y1="6" x2="5" y2="4" />
			<line x1="8" y1="6" x2="8" y2="4" />
		</svg>
	);
}
