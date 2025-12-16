import {
	Badge,
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	Heading,
	IconButton,
	Switch,
	Table,
	Text,
} from "@radix-ui/themes";
import { useState } from "react";
import {
	useAlerts,
	getMetricLabel,
	getConditionLabel,
	getMetricUnit,
	type AlertRule,
	type CreateAlertRule,
} from "../../hooks/use-alerts";
import { AlertRuleForm } from "./AlertRuleForm";
import { Skeleton } from "../ui/Skeleton";

export function AlertsPanel() {
	const { rules, events, loading, createRule, updateRule, deleteRule, toggleRule } = useAlerts();
	const [expanded, setExpanded] = useState(false);
	const [showForm, setShowForm] = useState(false);
	const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

	const activeAlerts = events.filter((e) => !e.resolvedAt);

	const handleCreate = async (data: CreateAlertRule) => {
		const result = await createRule(data);
		if (result) {
			setShowForm(false);
		}
	};

	const handleUpdate = async (data: CreateAlertRule) => {
		if (!editingRule) return;
		const result = await updateRule(editingRule.id, data);
		if (result) {
			setEditingRule(null);
		}
	};

	const handleEdit = (rule: AlertRule) => {
		setEditingRule(rule);
	};

	const handleDelete = async (id: string) => {
		await deleteRule(id);
	};

	return (
		<Card
			style={{ cursor: "pointer" }}
			onClick={() => setExpanded(!expanded)}
		>
			<Flex direction="column" gap="3">
				{/* Header */}
				<Flex justify="between" align="center">
					<Flex align="center" gap="2">
						<Heading size="3">Alerts</Heading>
						{activeAlerts.length > 0 && (
							<Badge color="red" variant="solid">
								{activeAlerts.length} active
							</Badge>
						)}
					</Flex>
					<Flex align="center" gap="2">
						<Badge color="gray" variant="soft">
							{rules.length} rules
						</Badge>
						<Button
							size="1"
							variant="soft"
							onClick={(e) => {
								e.stopPropagation();
								setShowForm(true);
							}}
						>
							<PlusIcon />
							Add
						</Button>
						<ExpandIcon expanded={expanded} />
					</Flex>
				</Flex>

				{/* Expanded content */}
				{expanded && (
					<Box
						pt="3"
						style={{
							borderTop: "1px solid var(--gray-a4)",
							animation: "fadeIn 0.2s ease",
						}}
						onClick={(e) => e.stopPropagation()}
					>
						{loading ? (
							<Skeleton height="100px" />
						) : rules.length === 0 ? (
							<Text size="2" color="gray">
								No alert rules configured. Click "Add" to create one.
							</Text>
						) : (
							<Table.Root variant="surface" size="1">
								<Table.Header>
									<Table.Row>
										<Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
										<Table.ColumnHeaderCell>Condition</Table.ColumnHeaderCell>
										<Table.ColumnHeaderCell>Enabled</Table.ColumnHeaderCell>
										<Table.ColumnHeaderCell width="80px">Actions</Table.ColumnHeaderCell>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{rules.map((rule) => (
										<Table.Row key={rule.id}>
											<Table.Cell>
												<Text size="1" weight="medium">
													{rule.name}
												</Text>
											</Table.Cell>
											<Table.Cell>
												<Text size="1" color="gray">
													{getMetricLabel(rule.metric)} {getConditionLabel(rule.condition)}{" "}
													{rule.threshold}
													{getMetricUnit(rule.metric)}
												</Text>
											</Table.Cell>
											<Table.Cell>
												<Switch
													size="1"
													checked={rule.enabled}
													onCheckedChange={(checked) => toggleRule(rule.id, checked)}
													onClick={(e) => e.stopPropagation()}
												/>
											</Table.Cell>
											<Table.Cell>
												<Flex gap="1">
													<IconButton
														size="1"
														variant="ghost"
														onClick={() => handleEdit(rule)}
													>
														<EditIcon />
													</IconButton>
													<IconButton
														size="1"
														variant="ghost"
														color="red"
														onClick={() => handleDelete(rule.id)}
													>
														<TrashIcon />
													</IconButton>
												</Flex>
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Root>
						)}

						{/* Recent events */}
						{events.length > 0 && (
							<Box mt="4">
								<Text size="1" color="gray" mb="2" style={{ display: "block" }}>
									Recent Events
								</Text>
								<Flex direction="column" gap="1">
									{events.slice(0, 5).map((event) => (
										<Flex
											key={event.id}
											justify="between"
											align="center"
											p="2"
											style={{
												background: "var(--gray-a2)",
												borderRadius: "var(--radius-2)",
											}}
										>
											<Text size="1">
												<Text weight="medium">{event.ruleName}</Text> on{" "}
												<Text color="gray">{event.nodeId}</Text>
											</Text>
											<Badge
												color={event.resolvedAt ? "green" : "red"}
												variant="soft"
												size="1"
											>
												{event.resolvedAt ? "Resolved" : "Active"}
											</Badge>
										</Flex>
									))}
								</Flex>
							</Box>
						)}
					</Box>
				)}
			</Flex>

			{/* Create dialog */}
			<Dialog.Root open={showForm} onOpenChange={setShowForm}>
				<Dialog.Content maxWidth="450px" onClick={(e) => e.stopPropagation()}>
					<Dialog.Title>Create Alert Rule</Dialog.Title>
					<AlertRuleForm
						onSubmit={handleCreate}
						onCancel={() => setShowForm(false)}
					/>
				</Dialog.Content>
			</Dialog.Root>

			{/* Edit dialog */}
			<Dialog.Root open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
				<Dialog.Content maxWidth="450px" onClick={(e) => e.stopPropagation()}>
					<Dialog.Title>Edit Alert Rule</Dialog.Title>
					{editingRule && (
						<AlertRuleForm
							initialData={editingRule}
							onSubmit={handleUpdate}
							onCancel={() => setEditingRule(null)}
						/>
					)}
				</Dialog.Content>
			</Dialog.Root>
		</Card>
	);
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			style={{
				transition: "transform 0.2s ease",
				transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
				opacity: 0.5,
			}}
		>
			<path d="M4 6l4 4 4-4" />
		</svg>
	);
}

function PlusIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
		>
			<path d="M7 2v10M2 7h10" />
		</svg>
	);
}

function EditIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M9.5 2.5l2 2L4 12H2v-2l7.5-7.5z" />
		</svg>
	);
}

function TrashIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" />
		</svg>
	);
}
