import {
	Box,
	Container,
	Flex,
	Grid,
	Heading,
	Spinner,
	Text,
	Theme,
} from "@radix-ui/themes";
import { useMetrics } from "../hooks/use-metrics";
import { ClusterOverview } from "./ClusterOverview";
import { GpuCard } from "./GpuCard";
import { SlurmStatus } from "./SlurmStatus";

export function Dashboard() {
	const { status, loading, error } = useMetrics({
		refreshInterval: 5000,
	});

	return (
		<Theme appearance="dark" accentColor="blue" grayColor="slate">
			<Box
				style={{
					minHeight: "100vh",
					background: "var(--gray-1)",
				}}
			>
				<Container size="4" p="4">
					<Flex direction="column" gap="4">
						<Flex justify="between" align="center">
							<Heading size="7">GPU Watchdog</Heading>
							{loading && <Spinner />}
						</Flex>

						{error && (
							<Box p="4" style={{ background: "var(--red-3)", borderRadius: "var(--radius-2)" }}>
								<Text color="red">{error}</Text>
							</Box>
						)}

						<ClusterOverview status={status} />

						{status.slurm && <SlurmStatus slurm={status.slurm} />}

						<Box>
							<Heading size="4" mb="3">
								GPU Nodes
							</Heading>
							{status.nodes.length === 0 ? (
								<Text color="gray">No nodes connected. Configure endpoints to see GPU metrics.</Text>
							) : (
								<Grid columns={{ initial: "1", sm: "2", lg: "3" }} gap="4">
									{status.nodes.flatMap((node) =>
										node.gpus.map((gpu) => (
											<GpuCard
												key={`${node.nodeId}-${gpu.gpu}`}
												gpu={gpu}
												nodeId={node.hostname}
											/>
										)),
									)}
								</Grid>
							)}
						</Box>
					</Flex>
				</Container>
			</Box>
		</Theme>
	);
}
