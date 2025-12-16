import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// GPU metrics snapshots
export const gpuMetrics = sqliteTable(
	"gpu_metrics",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		timestamp: integer("timestamp").notNull(),
		nodeId: text("node_id").notNull(),
		gpuIndex: integer("gpu_index").notNull(),
		utilization: real("utilization").notNull(),
		memoryUsedMb: real("memory_used_mb").notNull(),
		memoryTotalMb: real("memory_total_mb").notNull(),
		temperatureC: real("temperature_c").notNull(),
		powerUsageW: real("power_usage_w").notNull(),
	},
	(table) => [
		index("idx_gpu_metrics_timestamp").on(table.timestamp),
		index("idx_gpu_metrics_node").on(table.nodeId),
	],
);

// Slurm metrics snapshots
export const slurmMetrics = sqliteTable(
	"slurm_metrics",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		timestamp: integer("timestamp").notNull(),
		cpusTotal: integer("cpus_total").notNull(),
		cpusAlloc: integer("cpus_alloc").notNull(),
		cpusIdle: integer("cpus_idle").notNull(),
		nodesTotal: integer("nodes_total").notNull(),
		nodesIdle: integer("nodes_idle").notNull(),
		nodesAlloc: integer("nodes_alloc").notNull(),
		queuePending: integer("queue_pending").notNull(),
		queueRunning: integer("queue_running").notNull(),
		queueCompleted: integer("queue_completed").notNull(),
		queueFailed: integer("queue_failed").notNull(),
	},
	(table) => [index("idx_slurm_metrics_timestamp").on(table.timestamp)],
);

// Alert rules
export const alertRules = sqliteTable("alert_rules", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	metric: text("metric").notNull(),
	condition: text("condition").notNull(),
	threshold: real("threshold").notNull(),
	duration: integer("duration").notNull().default(0),
	nodeFilter: text("node_filter"),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

// Alert events
export const alertEvents = sqliteTable(
	"alert_events",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		ruleId: text("rule_id")
			.notNull()
			.references(() => alertRules.id, { onDelete: "cascade" }),
		ruleName: text("rule_name").notNull(),
		nodeId: text("node_id").notNull(),
		metric: text("metric").notNull(),
		value: real("value").notNull(),
		threshold: real("threshold").notNull(),
		condition: text("condition").notNull(),
		firedAt: integer("fired_at").notNull(),
		resolvedAt: integer("resolved_at"),
	},
	(table) => [
		index("idx_alert_events_rule").on(table.ruleId),
		index("idx_alert_events_fired").on(table.firedAt),
	],
);

// Type exports
export type GpuMetricRow = typeof gpuMetrics.$inferSelect;
export type NewGpuMetricRow = typeof gpuMetrics.$inferInsert;

export type SlurmMetricRow = typeof slurmMetrics.$inferSelect;
export type NewSlurmMetricRow = typeof slurmMetrics.$inferInsert;

export type AlertRuleRow = typeof alertRules.$inferSelect;
export type NewAlertRuleRow = typeof alertRules.$inferInsert;

export type AlertEventRow = typeof alertEvents.$inferSelect;
export type NewAlertEventRow = typeof alertEvents.$inferInsert;
