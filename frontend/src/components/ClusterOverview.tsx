import { Badge, Box, Card, Flex, Grid, Heading, Progress, Text } from "@radix-ui/themes";
import type { ClusterStatus } from "../types/metrics";

interface ClusterOverviewProps {
	status: ClusterStatus;
}

export function ClusterOverview({ status }: ClusterOverviewProps) {
	const totalGpus = status.nodes.reduce((sum, node) => sum + node.gpus.length, 0);
	const avgUtilization =
		totalGpus > 0
			? status.nodes.reduce(
					(sum, node) =>
						sum + node.gpus.reduce((s, g) => s + g.utilization, 0),
					0,
				) / totalGpus
			: 0;
	const avgTemp =
		totalGpus > 0
			? status.nodes.reduce(
					(sum, node) =>
						sum + node.gpus.reduce((s, g) => s + g.temperatureC, 0),
					0,
				) / totalGpus
			: 0;
	const totalMemoryUsed = status.nodes.reduce(
		(sum, node) => sum + node.gpus.reduce((s, g) => s + g.memoryUsedMB, 0),
		0,
	);
	const totalMemory = status.nodes.reduce(
		(sum, node) => sum + node.gpus.reduce((s, g) => s + g.memoryTotalMB, 0),
		0,
	);

	return (
		<Card>
			<Flex direction="column" gap="4">
				<Heading size="4">Cluster Overview</Heading>

				<Grid columns="4" gap="4">
					<Box>
						<Text size="1" color="gray">
							Nodes
						</Text>
						<Text size="6" weight="bold">
							{status.nodes.length}
						</Text>
					</Box>

					<Box>
						<Text size="1" color="gray">
							Total GPUs
						</Text>
						<Text size="6" weight="bold">
							{totalGpus}
						</Text>
					</Box>

					<Box>
						<Text size="1" color="gray">
							Avg Utilization
						</Text>
						<Text size="6" weight="bold">
							{avgUtilization.toFixed(0)}%
						</Text>
					</Box>

					<Box>
						<Text size="1" color="gray">
							Avg Temperature
						</Text>
						<Text size="6" weight="bold">
							{avgTemp.toFixed(0)}°C
						</Text>
					</Box>
				</Grid>

				<Box>
					<Flex justify="between" mb="1">
						<Text size="1" color="gray">
							Total GPU Memory
						</Text>
						<Text size="1">
							{(totalMemoryUsed / 1024).toFixed(1)} / {(totalMemory / 1024).toFixed(0)} GB
						</Text>
					</Flex>
					<Progress
						value={totalMemory > 0 ? (totalMemoryUsed / totalMemory) * 100 : 0}
						color="blue"
					/>
				</Box>

				{status.slurm && (
					<Flex gap="4" mt="2">
						<Badge color="green" variant="soft">
							{status.slurm.cpusIdle} CPUs Idle
						</Badge>
						<Badge color="blue" variant="soft">
							{status.slurm.cpusAlloc} CPUs Allocated
						</Badge>
						<Badge color="gray" variant="soft">
							{status.slurm.nodesIdle} Nodes Idle
						</Badge>
					</Flex>
				)}

				<Text size="1" color="gray">
					Last updated: {status.lastUpdated.toLocaleTimeString()}
				</Text>
			</Flex>
		</Card>
	);
}
