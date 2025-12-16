/**
 * Color scale functions for metrics visualization
 * Uses Radix UI color tokens
 */

export type StatusColor = "green" | "yellow" | "orange" | "red" | "gray" | "blue";

/**
 * Get color for utilization percentage
 * green: 0-25%, yellow: 25-50%, orange: 50-75%, red: 75-100%
 */
export function getUtilizationColor(value: number): StatusColor {
	if (value < 25) return "green";
	if (value < 50) return "yellow";
	if (value < 75) return "orange";
	return "red";
}

/**
 * Get color for temperature in Celsius
 * green: <50C, yellow: 50-70C, orange: 70-85C, red: >85C
 */
export function getTemperatureColor(temp: number): StatusColor {
	if (temp < 50) return "green";
	if (temp < 70) return "yellow";
	if (temp < 85) return "orange";
	return "red";
}

/**
 * Get color for Slurm node status
 */
export function getSlurmStatusColor(
	status: string,
): StatusColor {
	switch (status) {
		case "idle":
			return "green";
		case "alloc":
			return "yellow";
		case "mix":
			return "orange";
		case "down":
		case "drain":
			return "red";
		default:
			return "gray";
	}
}

/**
 * Get color for connection status
 */
export function getConnectionColor(isConnected: boolean, hasError: boolean): StatusColor {
	if (hasError) return "red";
	if (isConnected) return "green";
	return "yellow";
}

/**
 * Get CSS color value for charts (hex)
 */
export function getChartColor(color: StatusColor): string {
	const colors: Record<StatusColor, string> = {
		green: "#30a46c",
		yellow: "#f5d90a",
		orange: "#f76b15",
		red: "#e5484d",
		gray: "#8b8d98",
		blue: "#3e63dd",
	};
	return colors[color];
}

/**
 * Get cluster health status
 */
export function getClusterHealthStatus(
	avgUtilization: number,
	avgTemp: number,
	nodeCount: number,
): { status: "healthy" | "warning" | "critical"; color: StatusColor } {
	if (nodeCount === 0) {
		return { status: "critical", color: "red" };
	}
	if (avgTemp > 85 || avgUtilization > 95) {
		return { status: "critical", color: "red" };
	}
	if (avgTemp > 70 || avgUtilization > 80) {
		return { status: "warning", color: "yellow" };
	}
	return { status: "healthy", color: "green" };
}
