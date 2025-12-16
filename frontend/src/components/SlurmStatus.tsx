import { Badge, Box, Card, Flex, Heading, Table, Text } from "@radix-ui/themes";
import type { SlurmMetrics } from "../types/metrics";

interface SlurmStatusProps {
	slurm: SlurmMetrics;
}

function getStatusColor(status: string): "green" | "yellow" | "orange" | "red" | "gray" {
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

export function SlurmStatus({ slurm }: SlurmStatusProps) {
	return (
		<Card>
			<Flex direction="column" gap="4">
				<Heading size="4">Slurm Cluster Status</Heading>

				<Flex gap="6" wrap="wrap">
					<Box>
						<Text size="1" color="gray">
							Total CPUs
						</Text>
						<Text size="5" weight="bold">
							{slurm.cpusTotal}
						</Text>
					</Box>
					<Box>
						<Text size="1" color="gray">
							Allocated
						</Text>
						<Text size="5" weight="bold" color="yellow">
							{slurm.cpusAlloc}
						</Text>
					</Box>
					<Box>
						<Text size="1" color="gray">
							Idle
						</Text>
						<Text size="5" weight="bold" color="green">
							{slurm.cpusIdle}
						</Text>
					</Box>
					<Box style={{ borderLeft: "1px solid var(--gray-6)", paddingLeft: "1.5rem" }}>
						<Text size="1" color="gray">
							Jobs Running
						</Text>
						<Text size="5" weight="bold" color="blue">
							{slurm.queue.running}
						</Text>
					</Box>
					<Box>
						<Text size="1" color="gray">
							Pending
						</Text>
						<Text size="5" weight="bold" color="orange">
							{slurm.queue.pending}
						</Text>
					</Box>
					<Box>
						<Text size="1" color="gray">
							Completed
						</Text>
						<Text size="5" weight="bold" color="green">
							{slurm.queue.completed}
						</Text>
					</Box>
					<Box>
						<Text size="1" color="gray">
							Failed
						</Text>
						<Text size="5" weight="bold" color="red">
							{slurm.queue.failed}
						</Text>
					</Box>
				</Flex>

				{slurm.nodes.length > 0 && (
					<Box>
						<Heading size="3" mb="2">
							Nodes
						</Heading>
						<Table.Root variant="surface">
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
											<Text size="2" weight="medium">
												{node.node}
											</Text>
										</Table.Cell>
										<Table.Cell>
											<Badge color={getStatusColor(node.status)} variant="soft">
												{node.status}
											</Badge>
										</Table.Cell>
										<Table.Cell>
											{node.cpusAlloc}/{node.cpusTotal}
										</Table.Cell>
										<Table.Cell>
											{((node.memAlloc || 0) / 1024).toFixed(0)}/
											{((node.memTotal || 0) / 1024).toFixed(0)} GB
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Root>
					</Box>
				)}
			</Flex>
		</Card>
	);
}
