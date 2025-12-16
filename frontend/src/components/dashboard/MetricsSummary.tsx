import { Box, Card, Flex, Grid, Progress, Text } from "@radix-ui/themes";
import type { ClusterStatus } from "../../types/metrics";
import {
	getClusterHealthStatus,
	getTemperatureColor,
	getUtilizationColor,
} from "../../lib/colors";
import { formatBytes, formatPercent, formatTemperature } from "../../lib/formatters";

interface MetricsSummaryProps {
	status: ClusterStatus;
}

export function MetricsSummary({ status }: MetricsSummaryProps) {
	const totalGpus = status.nodes.reduce((sum, node) => sum + node.gpus.length, 0);

	const avgUtilization =
		totalGpus > 0
			? status.nodes.reduce(
					(sum, node) => sum + node.gpus.reduce((s, g) => s + g.utilization, 0),
					0,
				) / totalGpus
			: 0;

	const avgTemp =
		totalGpus > 0
			? status.nodes.reduce(
					(sum, node) => sum + node.gpus.reduce((s, g) => s + g.temperatureC, 0),
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
	const memoryPercent = totalMemory > 0 ? (totalMemoryUsed / totalMemory) * 100 : 0;

	const healthStatus = getClusterHealthStatus(avgUtilization, avgTemp, status.nodes.length);

	return (
		<Card size="3">
			<Grid columns={{ initial: "2", sm: "4" }} gap="6" p="2">
				{/* GPU Count */}
				<StatBlock
					label="Total GPUs"
					value={totalGpus.toString()}
					subtext={`${status.nodes.length} nodes`}
				/>

				{/* Utilization */}
				<StatBlock
					label="Avg Utilization"
					value={formatPercent(avgUtilization)}
					color={getUtilizationColor(avgUtilization)}
					progress={avgUtilization}
				/>

				{/* Temperature */}
				<StatBlock
					label="Avg Temperature"
					value={formatTemperature(avgTemp)}
					color={getTemperatureColor(avgTemp)}
				/>

				{/* Memory */}
				<StatBlock
					label="Memory Used"
					value={formatBytes(totalMemoryUsed * 1024 * 1024)}
					subtext={`of ${formatBytes(totalMemory * 1024 * 1024)}`}
					progress={memoryPercent}
					color={getUtilizationColor(memoryPercent)}
				/>
			</Grid>

			{/* Health indicator bar */}
			<Box
				mt="4"
				pt="3"
				style={{ borderTop: "1px solid var(--gray-a4)" }}
			>
				<Flex align="center" gap="2">
					<Box
						style={{
							width: 8,
							height: 8,
							borderRadius: "50%",
							backgroundColor: `var(--${healthStatus.color}-9)`,
						}}
					/>
					<Text size="2" weight="medium">
						Cluster {healthStatus.status}
					</Text>
					{status.slurm && (
						<Text size="2" color="gray" style={{ marginLeft: "auto" }}>
							{status.slurm.cpusIdle} / {status.slurm.cpusTotal} CPUs idle
						</Text>
					)}
				</Flex>
			</Box>
		</Card>
	);
}

interface StatBlockProps {
	label: string;
	value: string;
	subtext?: string;
	color?: "green" | "yellow" | "orange" | "red" | "gray" | "blue";
	progress?: number;
}

function StatBlock({ label, value, subtext, color, progress }: StatBlockProps) {
	return (
		<Flex direction="column" gap="1">
			<Text size="1" color="gray" weight="medium">
				{label}
			</Text>
			<Text
				size="7"
				weight="bold"
				style={{ color: color ? `var(--${color}-11)` : undefined }}
			>
				{value}
			</Text>
			{subtext && (
				<Text size="1" color="gray">
					{subtext}
				</Text>
			)}
			{progress !== undefined && (
				<Progress
					value={progress}
					color={color || "blue"}
					size="1"
					style={{ marginTop: "var(--space-1)" }}
				/>
			)}
		</Flex>
	);
}
