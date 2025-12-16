import { Badge, Box, Card, Flex, Progress, Text } from "@radix-ui/themes";
import type { GpuMetrics } from "../types/metrics";

interface GpuCardProps {
	gpu: GpuMetrics;
	nodeId: string;
}

function getUtilizationColor(value: number): "green" | "yellow" | "orange" | "red" {
	if (value < 25) return "green";
	if (value < 50) return "yellow";
	if (value < 75) return "orange";
	return "red";
}

function getTempColor(temp: number): "green" | "yellow" | "orange" | "red" {
	if (temp < 50) return "green";
	if (temp < 70) return "yellow";
	if (temp < 85) return "orange";
	return "red";
}

export function GpuCard({ gpu, nodeId }: GpuCardProps) {
	const memoryPercent =
		gpu.memoryTotalMB > 0 ? (gpu.memoryUsedMB / gpu.memoryTotalMB) * 100 : 0;

	return (
		<Card>
			<Flex direction="column" gap="3">
				<Flex justify="between" align="center">
					<Text weight="bold" size="3">
						GPU {gpu.gpu}
					</Text>
					<Badge color="gray" variant="soft">
						{nodeId}
					</Badge>
				</Flex>

				<Text size="1" color="gray">
					{gpu.gpuName.replace(/_/g, " ")}
				</Text>

				<Box>
					<Flex justify="between" mb="1">
						<Text size="1" color="gray">
							GPU Utilization
						</Text>
						<Text size="1" weight="medium">
							{gpu.utilization.toFixed(0)}%
						</Text>
					</Flex>
					<Progress
						value={gpu.utilization}
						color={getUtilizationColor(gpu.utilization)}
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
					<Progress value={memoryPercent} color={getUtilizationColor(memoryPercent)} />
				</Box>

				<Flex gap="4" wrap="wrap">
					<Flex direction="column" gap="1">
						<Text size="1" color="gray">
							Temperature
						</Text>
						<Badge color={getTempColor(gpu.temperatureC)} variant="soft">
							{gpu.temperatureC}°C
						</Badge>
					</Flex>

					<Flex direction="column" gap="1">
						<Text size="1" color="gray">
							Power
						</Text>
						<Badge color="blue" variant="soft">
							{gpu.powerUsageW.toFixed(0)} W
						</Badge>
					</Flex>

					<Flex direction="column" gap="1">
						<Text size="1" color="gray">
							SM Clock
						</Text>
						<Badge color="gray" variant="soft">
							{gpu.smClockMHz} MHz
						</Badge>
					</Flex>
				</Flex>
			</Flex>
		</Card>
	);
}
