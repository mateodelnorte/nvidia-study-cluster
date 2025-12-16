CREATE TABLE `alert_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule_id` text NOT NULL,
	`rule_name` text NOT NULL,
	`node_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`threshold` real NOT NULL,
	`condition` text NOT NULL,
	`fired_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`rule_id`) REFERENCES `alert_rules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_alert_events_rule` ON `alert_events` (`rule_id`);--> statement-breakpoint
CREATE INDEX `idx_alert_events_fired` ON `alert_events` (`fired_at`);--> statement-breakpoint
CREATE TABLE `alert_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`metric` text NOT NULL,
	`condition` text NOT NULL,
	`threshold` real NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`node_filter` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gpu_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`node_id` text NOT NULL,
	`gpu_index` integer NOT NULL,
	`utilization` real NOT NULL,
	`memory_used_mb` real NOT NULL,
	`memory_total_mb` real NOT NULL,
	`temperature_c` real NOT NULL,
	`power_usage_w` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_gpu_metrics_timestamp` ON `gpu_metrics` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_gpu_metrics_node` ON `gpu_metrics` (`node_id`);--> statement-breakpoint
CREATE TABLE `slurm_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`cpus_total` integer NOT NULL,
	`cpus_alloc` integer NOT NULL,
	`cpus_idle` integer NOT NULL,
	`nodes_total` integer NOT NULL,
	`nodes_idle` integer NOT NULL,
	`nodes_alloc` integer NOT NULL,
	`queue_pending` integer NOT NULL,
	`queue_running` integer NOT NULL,
	`queue_completed` integer NOT NULL,
	`queue_failed` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_slurm_metrics_timestamp` ON `slurm_metrics` (`timestamp`);