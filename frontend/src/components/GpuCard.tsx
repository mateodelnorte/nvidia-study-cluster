import { Badge, Box, Card, Flex, Progress, Text } from "@radix-ui/themes";
import { useState } from "react";
import type { GpuMetrics } from "../types/metrics";
import { getTemperatureColor, getUtilizationColor } from "../lib/colors";
import { GpuDetailPanel } from "./gpu/GpuDetailPanel";

interface GpuCardProps {
	gpu: GpuMetrics;
	nodeId: string;
}

export function GpuCard({ gpu, nodeId }: GpuCardProps) {
	const [expanded, setExpanded] = useState(false);
	const memoryPercent =
		gpu.memoryTotalMB > 0 ? (gpu.memoryUsedMB / gpu.memoryTotalMB) * 100 : 0;

	return (
		<Card
			style={{
				cursor: "pointer",
				transition: "box-shadow 0.2s ease",
			}}
			onClick={() => setExpanded(!expanded)}
		>
			<Flex direction="column" gap="3">
				{/* Header */}
				<Flex justify="between" align="center">
					<Flex align="center" gap="2">
						<Text weight="bold" size="3">
							GPU {gpu.gpu}
						</Text>
						<Badge color="gray" variant="soft" size="1">
							{nodeId}
						</Badge>
					</Flex>
					<Flex align="center" gap="2">
						<Badge color={getTemperatureColor(gpu.temperatureC)} variant="soft">
							{gpu.temperatureC}°C
						</Badge>
						<ExpandIcon expanded={expanded} />
					</Flex>
				</Flex>

				{/* Compact metrics */}
				<Box>
					<Flex justify="between" mb="1">
						<Text size="1" color="gray">
							Utilization
						</Text>
						<Text size="1" weight="medium">
							{gpu.utilization.toFixed(0)}%
						</Text>
					</Flex>
					<Progress
						value={gpu.utilization}
						color={getUtilizationColor(gpu.utilization)}
						size="2"
					/>
				</Box>

				<Box>
					<Flex justify="between" mb="1">
						<Text size="1" color="gray">
							Memory
						</Text>
						<Text size="1" weight="medium">
							{(gpu.memoryUsedMB / 1024).toFixed(1)} / {(gpu.memoryTotalMB / 1024).toFixed(0)} GB
						</Text>
					</Flex>
					<Progress
						value={memoryPercent}
						color={getUtilizationColor(memoryPercent)}
						size="2"
					/>
				</Box>

				{/* Expanded details with charts */}
				{expanded && (
					<GpuDetailPanel
						nodeId={nodeId}
						gpu={gpu.gpu}
						gpuName={gpu.gpuName}
						powerUsageW={gpu.powerUsageW}
						smClockMHz={gpu.smClockMHz}
						memClockMHz={gpu.memClockMHz}
						memoryTotalMB={gpu.memoryTotalMB}
					/>
				)}
			</Flex>
		</Card>
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

// Add fadeIn animation
if (typeof document !== "undefined") {
	const styleId = "gpu-card-animation";
	if (!document.getElementById(styleId)) {
		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
			@keyframes fadeIn {
				from { opacity: 0; transform: translateY(-8px); }
				to { opacity: 1; transform: translateY(0); }
			}
		`;
		document.head.appendChild(style);
	}
}
