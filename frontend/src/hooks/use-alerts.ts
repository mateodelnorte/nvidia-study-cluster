import { useCallback, useEffect, useState } from "react";

export type AlertCondition = "gt" | "lt" | "eq" | "gte" | "lte";
export type AlertMetric =
	| "gpu_utilization"
	| "gpu_memory_used"
	| "gpu_memory_percent"
	| "gpu_temperature"
	| "gpu_power"
	| "slurm_cpus_alloc"
	| "slurm_queue_pending"
	| "slurm_queue_running";

export interface AlertRule {
	id: string;
	name: string;
	metric: AlertMetric;
	condition: AlertCondition;
	threshold: number;
	duration: number;
	nodeFilter?: string;
	enabled: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface CreateAlertRule {
	name: string;
	metric: AlertMetric;
	condition: AlertCondition;
	threshold: number;
	duration?: number;
	nodeFilter?: string;
	enabled?: boolean;
}

export interface AlertEvent {
	id: number;
	ruleId: string;
	ruleName: string;
	nodeId: string;
	metric: string;
	value: number;
	threshold: number;
	condition: string;
	firedAt: number;
	resolvedAt?: number;
}

interface UseAlertsState {
	rules: AlertRule[];
	events: AlertEvent[];
	loading: boolean;
	error: string | null;
	createRule: (rule: CreateAlertRule) => Promise<AlertRule | null>;
	updateRule: (id: string, updates: Partial<CreateAlertRule>) => Promise<AlertRule | null>;
	deleteRule: (id: string) => Promise<boolean>;
	toggleRule: (id: string, enabled: boolean) => Promise<boolean>;
	refresh: () => Promise<void>;
}

export function useAlerts(): UseAlertsState {
	const [rules, setRules] = useState<AlertRule[]>([]);
	const [events, setEvents] = useState<AlertEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchRules = useCallback(async () => {
		try {
			const response = await fetch("/api/alerts");
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			setRules(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch alerts");
		}
	}, []);

	const fetchEvents = useCallback(async () => {
		try {
			const response = await fetch("/api/alerts/events/history?limit=50");
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			setEvents(data);
		} catch {
			// Silently fail for events - not critical
		}
	}, []);

	const refresh = useCallback(async () => {
		setLoading(true);
		await Promise.all([fetchRules(), fetchEvents()]);
		setLoading(false);
	}, [fetchRules, fetchEvents]);

	const createRule = useCallback(
		async (rule: CreateAlertRule): Promise<AlertRule | null> => {
			try {
				const response = await fetch("/api/alerts", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(rule),
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const created = await response.json();
				setRules((prev) => [...prev, created]);
				return created;
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to create alert");
				return null;
			}
		},
		[],
	);

	const updateRule = useCallback(
		async (id: string, updates: Partial<CreateAlertRule>): Promise<AlertRule | null> => {
			try {
				const response = await fetch(`/api/alerts/${id}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(updates),
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const updated = await response.json();
				setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
				return updated;
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to update alert");
				return null;
			}
		},
		[],
	);

	const deleteRule = useCallback(async (id: string): Promise<boolean> => {
		try {
			const response = await fetch(`/api/alerts/${id}`, {
				method: "DELETE",
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			setRules((prev) => prev.filter((r) => r.id !== id));
			return true;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete alert");
			return false;
		}
	}, []);

	const toggleRule = useCallback(
		async (id: string, enabled: boolean): Promise<boolean> => {
			const result = await updateRule(id, { enabled });
			return result !== null;
		},
		[updateRule],
	);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return {
		rules,
		events,
		loading,
		error,
		createRule,
		updateRule,
		deleteRule,
		toggleRule,
		refresh,
	};
}

// Helper to get human-readable metric names
export function getMetricLabel(metric: AlertMetric): string {
	const labels: Record<AlertMetric, string> = {
		gpu_utilization: "GPU Utilization",
		gpu_memory_used: "GPU Memory Used",
		gpu_memory_percent: "GPU Memory %",
		gpu_temperature: "GPU Temperature",
		gpu_power: "GPU Power",
		slurm_cpus_alloc: "Slurm CPUs Allocated",
		slurm_queue_pending: "Slurm Queue Pending",
		slurm_queue_running: "Slurm Queue Running",
	};
	return labels[metric];
}

export function getConditionLabel(condition: AlertCondition): string {
	const labels: Record<AlertCondition, string> = {
		gt: ">",
		lt: "<",
		eq: "=",
		gte: "≥",
		lte: "≤",
	};
	return labels[condition];
}

export function getMetricUnit(metric: AlertMetric): string {
	const units: Record<AlertMetric, string> = {
		gpu_utilization: "%",
		gpu_memory_used: "MB",
		gpu_memory_percent: "%",
		gpu_temperature: "°C",
		gpu_power: "W",
		slurm_cpus_alloc: "",
		slurm_queue_pending: "",
		slurm_queue_running: "",
	};
	return units[metric];
}
