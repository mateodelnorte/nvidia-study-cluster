import { Badge, Box, Card, Flex, Heading, Table, Text } from "@radix-ui/themes";
import { useState } from "react";
import type { SlurmMetrics } from "../types/metrics";
import { getSlurmStatusColor } from "../lib/colors";

interface SlurmStatusProps {
	slurm: SlurmMetrics;
}

export function SlurmStatus({ slurm }: SlurmStatusProps) {
	const [expanded, setExpanded] = useState(false);

	return (
		<Card
			style={{ cursor: "pointer" }}
			onClick={() => setExpanded(!expanded)}
		>
			<Flex direction="column" gap="3">
				{/* Header with summary */}
				<Flex justify="between" align="center">
					<Flex align="center" gap="2">
						<Heading size="3">Slurm</Heading>
						<Badge color="gray" variant="soft">
							{slurm.nodesTotal} nodes
						</Badge>
					</Flex>
					<Flex align="center" gap="3">
						<Flex gap="2">
							<Badge color="green" variant="soft">
								{slurm.cpusIdle} idle
							</Badge>
							<Badge color="yellow" variant="soft">
								{slurm.cpusAlloc} alloc
							</Badge>
							{slurm.queue.running > 0 && (
								<Badge color="blue" variant="soft">
									{slurm.queue.running} running
								</Badge>
							)}
							{slurm.queue.pending > 0 && (
								<Badge color="orange" variant="soft">
									{slurm.queue.pending} pending
								</Badge>
							)}
						</Flex>
						<ExpandIcon expanded={expanded} />
					</Flex>
				</Flex>

				{/* Expanded details */}
				{expanded && (
					<Box
						pt="3"
						style={{
							borderTop: "1px solid var(--gray-a4)",
							animation: "fadeIn 0.2s ease",
						}}
						onClick={(e) => e.stopPropagation()}
					>
						{/* Job queue summary */}
						<Flex gap="6" mb="4" wrap="wrap">
							<StatItem label="CPUs Total" value={slurm.cpusTotal} />
							<StatItem label="Jobs Running" value={slurm.queue.running} color="blue" />
							<StatItem label="Jobs Pending" value={slurm.queue.pending} color="orange" />
							<StatItem label="Completed" value={slurm.queue.completed} color="green" />
							{slurm.queue.failed > 0 && (
								<StatItem label="Failed" value={slurm.queue.failed} color="red" />
							)}
						</Flex>

						{/* Node table */}
						{slurm.nodes.length > 0 && (
							<Table.Root variant="surface" size="1">
								<Table.Header>
									<Table.Row>
										<Table.ColumnHeaderCell>Node</Table.ColumnHeaderCell>
										<Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
										<Table.ColumnHeaderCell>CPUs</Table.ColumnHeaderCell>
										<Table.ColumnHeaderCell>Memory</Table.ColumnHeaderCell>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{slurm.nodes.map((node) => (
										<Table.Row key={node.node}>
											<Table.Cell>
												<Text size="1" weight="medium">
													{node.node}
												</Text>
											</Table.Cell>
											<Table.Cell>
												<Badge
													color={getSlurmStatusColor(node.status)}
													variant="soft"
													size="1"
												>
													{node.status}
												</Badge>
											</Table.Cell>
											<Table.Cell>
												<Text size="1">
													{node.cpusAlloc}/{node.cpusTotal}
												</Text>
											</Table.Cell>
											<Table.Cell>
												<Text size="1">
													{((node.memAlloc || 0) / 1024).toFixed(0)}/
													{((node.memTotal || 0) / 1024).toFixed(0)} GB
												</Text>
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Root>
						)}
					</Box>
				)}
			</Flex>
		</Card>
	);
}

function StatItem({
	label,
	value,
	color,
}: {
	label: string;
	value: number;
	color?: "green" | "yellow" | "orange" | "red" | "blue";
}) {
	return (
		<Flex direction="column" gap="1">
			<Text size="1" color="gray">
				{label}
			</Text>
			<Text size="4" weight="bold" color={color}>
				{value}
			</Text>
		</Flex>
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
