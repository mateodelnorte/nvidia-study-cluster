import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Box, Text } from "@radix-ui/themes";
import { getChartColor, type StatusColor } from "../../lib/colors";

export interface DataPoint {
	timestamp: number;
	value: number;
}

interface TimeSeriesChartProps {
	data: DataPoint[];
	color?: StatusColor;
	height?: number;
	showGrid?: boolean;
	showAxis?: boolean;
	valueFormatter?: (value: number) => string;
	domain?: [number, number];
	unit?: string;
}

export function TimeSeriesChart({
	data,
	color = "blue",
	height = 120,
	showGrid = true,
	showAxis = true,
	valueFormatter = (v) => v.toFixed(0),
	domain,
	unit = "",
}: TimeSeriesChartProps) {
	const chartColor = getChartColor(color);

	if (data.length === 0) {
		return (
			<Box
				style={{
					height,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Text size="1" color="gray">
					No data
				</Text>
			</Box>
		);
	}

	return (
		<ResponsiveContainer width="100%" height={height}>
			<AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
				{showGrid && (
					<CartesianGrid
						strokeDasharray="3 3"
						stroke="var(--gray-a4)"
						vertical={false}
					/>
				)}
				{showAxis && (
					<>
						<XAxis
							dataKey="timestamp"
							tickFormatter={(ts) => formatTime(ts)}
							stroke="var(--gray-8)"
							tick={{ fontSize: 10, fill: "var(--gray-9)" }}
							tickLine={false}
							axisLine={false}
							minTickGap={50}
						/>
						<YAxis
							domain={domain || ["auto", "auto"]}
							stroke="var(--gray-8)"
							tick={{ fontSize: 10, fill: "var(--gray-9)" }}
							tickLine={false}
							axisLine={false}
							width={35}
							tickFormatter={valueFormatter}
						/>
					</>
				)}
				<Tooltip
					contentStyle={{
						backgroundColor: "var(--gray-2)",
						border: "1px solid var(--gray-6)",
						borderRadius: "var(--radius-2)",
						fontSize: 12,
					}}
					labelFormatter={(ts) => formatTooltipTime(ts as number)}
					formatter={(value: number) => [`${valueFormatter(value)}${unit}`, ""]}
				/>
				<defs>
					<linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
						<stop offset="100%" stopColor={chartColor} stopOpacity={0} />
					</linearGradient>
				</defs>
				<Area
					type="monotone"
					dataKey="value"
					stroke={chartColor}
					strokeWidth={2}
					fill={`url(#gradient-${color})`}
					dot={false}
					activeDot={{ r: 4, strokeWidth: 0, fill: chartColor }}
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}

function formatTime(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTooltipTime(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

// Sparkline variant - compact, no axis/grid
interface SparklineProps {
	data: DataPoint[];
	color?: StatusColor;
	height?: number;
	width?: number;
}

export function Sparkline({
	data,
	color = "blue",
	height = 24,
	width = 80,
}: SparklineProps) {
	const chartColor = getChartColor(color);

	if (data.length < 2) {
		return (
			<div
				style={{
					width,
					height,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Text size="1" color="gray">
					--
				</Text>
			</div>
		);
	}

	return (
		<ResponsiveContainer width={width} height={height}>
			<AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
				<defs>
					<linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={chartColor} stopOpacity={0.4} />
						<stop offset="100%" stopColor={chartColor} stopOpacity={0} />
					</linearGradient>
				</defs>
				<Area
					type="monotone"
					dataKey="value"
					stroke={chartColor}
					strokeWidth={1.5}
					fill={`url(#spark-${color})`}
					dot={false}
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}
