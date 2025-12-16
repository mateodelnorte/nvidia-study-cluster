import { Flex, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { formatRelativeTime } from "../../lib/formatters";

interface RefreshIndicatorProps {
	lastUpdated: Date | null;
	refreshInterval: number;
	isLoading?: boolean;
}

export function RefreshIndicator({
	lastUpdated,
	refreshInterval,
	isLoading = false,
}: RefreshIndicatorProps) {
	const [, setTick] = useState(0);

	// Update display every second for smooth countdown
	useEffect(() => {
		const timer = setInterval(() => setTick((t) => t + 1), 1000);
		return () => clearInterval(timer);
	}, []);

	const secondsUntilRefresh = lastUpdated
		? Math.max(0, Math.ceil((refreshInterval - (Date.now() - lastUpdated.getTime())) / 1000))
		: 0;

	return (
		<Flex align="center" gap="2">
			{isLoading ? (
				<Flex align="center" gap="1">
					<RefreshSpinner />
					<Text size="1" color="gray">
						Updating...
					</Text>
				</Flex>
			) : lastUpdated ? (
				<Flex align="center" gap="2">
					<Text size="1" color="gray">
						{formatRelativeTime(lastUpdated)}
					</Text>
					<CountdownRing
						seconds={secondsUntilRefresh}
						total={refreshInterval / 1000}
					/>
				</Flex>
			) : (
				<Text size="1" color="gray">
					--
				</Text>
			)}
		</Flex>
	);
}

function RefreshSpinner() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			style={{ animation: "spin 1s linear infinite" }}
		>
			<circle
				cx="7"
				cy="7"
				r="5"
				fill="none"
				stroke="var(--gray-8)"
				strokeWidth="2"
				strokeDasharray="20"
				strokeDashoffset="5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

interface CountdownRingProps {
	seconds: number;
	total: number;
}

function CountdownRing({ seconds, total }: CountdownRingProps) {
	const progress = total > 0 ? seconds / total : 0;
	const circumference = 2 * Math.PI * 5;
	const offset = circumference * (1 - progress);

	return (
		<svg width="14" height="14" viewBox="0 0 14 14">
			{/* Background circle */}
			<circle
				cx="7"
				cy="7"
				r="5"
				fill="none"
				stroke="var(--gray-a4)"
				strokeWidth="2"
			/>
			{/* Progress circle */}
			<circle
				cx="7"
				cy="7"
				r="5"
				fill="none"
				stroke="var(--gray-8)"
				strokeWidth="2"
				strokeDasharray={circumference}
				strokeDashoffset={offset}
				strokeLinecap="round"
				transform="rotate(-90 7 7)"
				style={{ transition: "stroke-dashoffset 0.3s ease" }}
			/>
		</svg>
	);
}

// Add spin animation
if (typeof document !== "undefined") {
	const styleId = "refresh-indicator-animation";
	if (!document.getElementById(styleId)) {
		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
			@keyframes spin {
				from { transform: rotate(0deg); }
				to { transform: rotate(360deg); }
			}
		`;
		document.head.appendChild(style);
	}
}
