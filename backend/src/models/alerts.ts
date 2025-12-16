import { z } from "zod";

export const AlertConditionSchema = z.enum(["gt", "lt", "eq", "gte", "lte"]);
export type AlertCondition = z.infer<typeof AlertConditionSchema>;

export const AlertMetricSchema = z.enum([
	"gpu_utilization",
	"gpu_memory_used",
	"gpu_memory_percent",
	"gpu_temperature",
	"gpu_power",
	"slurm_cpus_alloc",
	"slurm_queue_pending",
	"slurm_queue_running",
]);
export type AlertMetric = z.infer<typeof AlertMetricSchema>;

export const AlertRuleSchema = z.object({
	id: z.string(),
	name: z.string().min(1).max(100),
	metric: AlertMetricSchema,
	condition: AlertConditionSchema,
	threshold: z.number(),
	duration: z.number().min(0).default(0), // seconds before firing
	nodeFilter: z.string().optional(), // regex pattern
	enabled: z.boolean().default(true),
	createdAt: z.number(), // Unix timestamp
	updatedAt: z.number(),
});

export type AlertRule = z.infer<typeof AlertRuleSchema>;

export const CreateAlertRuleSchema = AlertRuleSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export type CreateAlertRule = z.infer<typeof CreateAlertRuleSchema>;

export const UpdateAlertRuleSchema = CreateAlertRuleSchema.partial();
export type UpdateAlertRule = z.infer<typeof UpdateAlertRuleSchema>;

export interface AlertEvent {
	id?: number;
	ruleId: string;
	ruleName: string;
	nodeId: string;
	metric: string;
	value: number;
	threshold: number;
	condition: string;
	firedAt: number; // Unix timestamp
	resolvedAt?: number;
}

export interface AlertState {
	ruleId: string;
	nodeId: string;
	firstTriggered: number;
	lastValue: number;
	fired: boolean;
}
