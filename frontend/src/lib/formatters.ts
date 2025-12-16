/**
 * Format a number with consistent decimal places
 */
export function formatNumber(value: number, decimals = 1): string {
	return value.toFixed(decimals);
}

/**
 * Format bytes/megabytes to human-readable GB
 */
export function formatMemoryGB(mb: number): string {
	return (mb / 1024).toFixed(1);
}

/**
 * Format percentage with % suffix
 */
export function formatPercent(value: number): string {
	return `${value.toFixed(0)}%`;
}

/**
 * Format temperature with degree symbol
 */
export function formatTemp(celsius: number): string {
	return `${celsius.toFixed(0)}°C`;
}

/**
 * Format power in watts
 */
export function formatPower(watts: number): string {
	return `${watts.toFixed(0)}W`;
}

/**
 * Format clock speed in MHz
 */
export function formatClock(mhz: number): string {
	return `${mhz} MHz`;
}

/**
 * Format relative time (e.g., "3s ago", "2m ago")
 */
export function formatRelativeTime(date: Date): string {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

	if (seconds < 60) {
		return `${seconds}s ago`;
	}
	if (seconds < 3600) {
		return `${Math.floor(seconds / 60)}m ago`;
	}
	return `${Math.floor(seconds / 3600)}h ago`;
}

/**
 * Format timestamp for charts
 */
export function formatChartTime(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
