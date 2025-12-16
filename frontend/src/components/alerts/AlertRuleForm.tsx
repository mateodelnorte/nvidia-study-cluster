import { Box, Button, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { useState } from "react";
import type {
	AlertCondition,
	AlertMetric,
	AlertRule,
	CreateAlertRule,
} from "../../hooks/use-alerts";
import { getMetricLabel, getMetricUnit } from "../../hooks/use-alerts";

interface AlertRuleFormProps {
	initialData?: AlertRule;
	onSubmit: (data: CreateAlertRule) => void;
	onCancel: () => void;
}

const METRICS: AlertMetric[] = [
	"gpu_utilization",
	"gpu_memory_percent",
	"gpu_memory_used",
	"gpu_temperature",
	"gpu_power",
	"slurm_cpus_alloc",
	"slurm_queue_pending",
	"slurm_queue_running",
];

const CONDITIONS: { value: AlertCondition; label: string }[] = [
	{ value: "gt", label: ">" },
	{ value: "gte", label: ">=" },
	{ value: "lt", label: "<" },
	{ value: "lte", label: "<=" },
	{ value: "eq", label: "=" },
];

export function AlertRuleForm({ initialData, onSubmit, onCancel }: AlertRuleFormProps) {
	const [name, setName] = useState(initialData?.name || "");
	const [metric, setMetric] = useState<AlertMetric>(initialData?.metric || "gpu_utilization");
	const [condition, setCondition] = useState<AlertCondition>(initialData?.condition || "gt");
	const [threshold, setThreshold] = useState(initialData?.threshold?.toString() || "80");
	const [duration, setDuration] = useState(initialData?.duration?.toString() || "0");
	const [nodeFilter, setNodeFilter] = useState(initialData?.nodeFilter || "");
	const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
	const [errors, setErrors] = useState<Record<string, string>>({});

	const validate = (): boolean => {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) {
			newErrors.name = "Name is required";
		} else if (name.length > 100) {
			newErrors.name = "Name must be 100 characters or less";
		}

		const thresholdNum = Number.parseFloat(threshold);
		if (Number.isNaN(thresholdNum)) {
			newErrors.threshold = "Must be a number";
		}

		const durationNum = Number.parseInt(duration, 10);
		if (Number.isNaN(durationNum) || durationNum < 0) {
			newErrors.duration = "Must be 0 or positive";
		}

		if (nodeFilter) {
			try {
				new RegExp(nodeFilter);
			} catch {
				newErrors.nodeFilter = "Invalid regex pattern";
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;

		onSubmit({
			name: name.trim(),
			metric,
			condition,
			threshold: Number.parseFloat(threshold),
			duration: Number.parseInt(duration, 10),
			nodeFilter: nodeFilter || undefined,
			enabled,
		});
	};

	return (
		<form onSubmit={handleSubmit}>
			<Flex direction="column" gap="4">
				{/* Name */}
				<Box>
					<Text size="2" weight="medium" mb="1" style={{ display: "block" }}>
						Name
					</Text>
					<TextField.Root
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="High GPU Temperature"
					/>
					{errors.name && (
						<Text size="1" color="red">
							{errors.name}
						</Text>
					)}
				</Box>

				{/* Metric */}
				<Box>
					<Text size="2" weight="medium" mb="1" style={{ display: "block" }}>
						Metric
					</Text>
					<Select.Root value={metric} onValueChange={(v) => setMetric(v as AlertMetric)}>
						<Select.Trigger style={{ width: "100%" }} />
						<Select.Content>
							{METRICS.map((m) => (
								<Select.Item key={m} value={m}>
									{getMetricLabel(m)}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
				</Box>

				{/* Condition and Threshold */}
				<Flex gap="3">
					<Box style={{ width: "100px" }}>
						<Text size="2" weight="medium" mb="1" style={{ display: "block" }}>
							Condition
						</Text>
						<Select.Root
							value={condition}
							onValueChange={(v) => setCondition(v as AlertCondition)}
						>
							<Select.Trigger style={{ width: "100%" }} />
							<Select.Content>
								{CONDITIONS.map((c) => (
									<Select.Item key={c.value} value={c.value}>
										{c.label}
									</Select.Item>
								))}
							</Select.Content>
						</Select.Root>
					</Box>

					<Box style={{ flex: 1 }}>
						<Text size="2" weight="medium" mb="1" style={{ display: "block" }}>
							Threshold {getMetricUnit(metric) && `(${getMetricUnit(metric)})`}
						</Text>
						<TextField.Root
							type="number"
							value={threshold}
							onChange={(e) => setThreshold(e.target.value)}
						/>
						{errors.threshold && (
							<Text size="1" color="red">
								{errors.threshold}
							</Text>
						)}
					</Box>
				</Flex>

				{/* Duration */}
				<Box>
					<Text size="2" weight="medium" mb="1" style={{ display: "block" }}>
						Duration (seconds)
					</Text>
					<TextField.Root
						type="number"
						value={duration}
						onChange={(e) => setDuration(e.target.value)}
						placeholder="0"
					/>
					<Text size="1" color="gray">
						How long condition must be true before firing (0 = immediate)
					</Text>
					{errors.duration && (
						<Text size="1" color="red">
							{errors.duration}
						</Text>
					)}
				</Box>

				{/* Node Filter */}
				<Box>
					<Text size="2" weight="medium" mb="1" style={{ display: "block" }}>
						Node Filter (optional)
					</Text>
					<TextField.Root
						value={nodeFilter}
						onChange={(e) => setNodeFilter(e.target.value)}
						placeholder="node-.*"
					/>
					<Text size="1" color="gray">
						Regex pattern to match node IDs (empty = all nodes)
					</Text>
					{errors.nodeFilter && (
						<Text size="1" color="red">
							{errors.nodeFilter}
						</Text>
					)}
				</Box>

				{/* Actions */}
				<Flex gap="3" justify="end" mt="2">
					<Button type="button" variant="soft" color="gray" onClick={onCancel}>
						Cancel
					</Button>
					<Button type="submit">{initialData ? "Update" : "Create"}</Button>
				</Flex>
			</Flex>
		</form>
	);
}
