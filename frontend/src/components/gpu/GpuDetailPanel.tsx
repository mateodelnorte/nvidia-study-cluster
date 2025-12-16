import { Box, Flex, Grid, Text } from "@radix-ui/themes";
import { useGpuHistory } from "../../hooks/use-history";
import { TimeSeriesChart } from "../charts/TimeSeriesChart";
import { Skeleton } from "../ui/Skeleton";
import { getTemperatureColor, getUtilizationColor } from "../../lib/colors";

interface GpuDetailPanelProps {
	nodeId: string;
	gpu: string;
	gpuName: string;
	powerUsageW: number;
	smClockMHz: number;
	memClockMHz: number;
	memoryTotalMB: number;
}

export function GpuDetailPanel({
	nodeId,
	gpu,
	gpuName,
	powerUsageW,
	smClockMHz,
	memClockMHz,
	memoryTotalMB,
}: GpuDetailPanelProps) {
	const { history, loading } = useGpuHistory(nodeId, gpu, { duration: 60 });

	// Get latest values for color coding
	const latestUtil = history?.utilization.at(-1)?.value ?? 0;
	const latestTemp = history?.temperature.at(-1)?.value ?? 0;
	const latestMemPct = history?.memory.at(-1)?.value
		? (history.memory.at(-1)!.value / memoryTotalMB) * 100
		: 0;

	return (
		<Box
			pt="3"
			style={{
				borderTop: "1px solid var(--gray-a4)",
				animation: "fadeIn 0.2s ease",
			}}
			onClick={(e) => e.stopPropagation()}
		>
			<Text size="1" color="gray" mb="3" style={{ display: "block" }}>
				{gpuName.replace(/_/g, " ")}
			</Text>

			{/* Quick stats row */}
			<Grid columns="3" gap="3" mb="4">
				<DetailItem label="Power" value={`${powerUsageW.toFixed(0)} W`} />
				<DetailItem label="SM Clock" value={`${smClockMHz} MHz`} />
				<DetailItem label="Mem Clock" value={`${memClockMHz} MHz`} />
			</Grid>

			{/* Charts */}
			<Flex direction="column" gap="4">
				<ChartSection
					title="Utilization"
					unit="%"
					loading={loading}
					data={history?.utilization}
					color={getUtilizationColor(latestUtil)}
					domain={[0, 100]}
				/>
				<ChartSection
					title="Memory"
					unit=" MB"
					loading={loading}
					data={history?.memory}
					color={getUtilizationColor(latestMemPct)}
				/>
				<ChartSection
					title="Temperature"
					unit="°C"
					loading={loading}
					data={history?.temperature}
					color={getTemperatureColor(latestTemp)}
				/>
			</Flex>
		</Box>
	);
}

interface ChartSectionProps {
	title: string;
	unit: string;
	loading: boolean;
	data?: Array<{ timestamp: number; value: number }>;
	color: "green" | "yellow" | "orange" | "red" | "gray" | "blue";
	domain?: [number, number];
}

function ChartSection({
	title,
	unit,
	loading,
	data,
	color,
	domain,
}: ChartSectionProps) {
	return (
		<Box>
			<Flex justify="between" align="center" mb="2">
				<Text size="1" color="gray">
					{title} (60 min)
				</Text>
				{data && data.length > 0 && (
					<Text size="1" weight="medium">
						{data.at(-1)?.value.toFixed(0)}
						{unit}
					</Text>
				)}
			</Flex>
			{loading ? (
				<Skeleton height="80px" />
			) : (
				<TimeSeriesChart
					data={data || []}
					color={color}
					height={80}
					showAxis={false}
					showGrid={false}
					domain={domain}
					unit={unit}
				/>
			)}
		</Box>
	);
}

function DetailItem({ label, value }: { label: string; value: string }) {
	return (
		<Flex direction="column" gap="1">
			<Text size="1" color="gray">
				{label}
			</Text>
			<Text size="2" weight="medium">
				{value}
			</Text>
		</Flex>
	);
}

function GridComponent({
	columns,
	gap,
	mb,
	children,
}: {
	columns: string;
	gap: string;
	mb?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: `repeat(${columns}, 1fr)`,
				gap: `var(--space-${gap})`,
				marginBottom: mb ? `var(--space-${mb})` : undefined,
			}}
		>
			{children}
		</div>
	);
}
