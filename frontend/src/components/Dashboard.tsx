import { Box, Container, Flex, Grid, Heading, Text, Theme } from "@radix-ui/themes";
import { useMetrics } from "../hooks/use-metrics";
import { StatusBar } from "./layout/StatusBar";
import { ErrorBanner } from "./ui/ErrorBanner";
import { SkeletonCard, SkeletonStat } from "./ui/Skeleton";
import { MetricsSummary } from "./dashboard/MetricsSummary";
import { GpuCard } from "./GpuCard";
import { SlurmStatus } from "./SlurmStatus";
import { AlertsPanel } from "./alerts/AlertsPanel";

export function Dashboard() {
	const {
		status,
		loading,
		error,
		isConnected,
		lastFetchTime,
		failureCount,
		refresh,
		refreshInterval,
		isFetching,
	} = useMetrics({
		refreshInterval: 5000,
	});

	const showSkeleton = loading && status.nodes.length === 0;

	return (
		<Theme appearance="dark" accentColor="blue" grayColor="slate">
			<Box
				style={{
					minHeight: "100vh",
					background: "var(--gray-1)",
				}}
			>
				<StatusBar
					isConnected={isConnected}
					hasError={!!error}
					lastUpdated={lastFetchTime}
					refreshInterval={refreshInterval}
					isLoading={isFetching}
				/>

				<Container size="4" p="4">
					<Flex direction="column" gap="4">
						{error && (
							<ErrorBanner
								message="Failed to fetch metrics"
								details={error}
								onRetry={refresh}
								consecutiveErrors={failureCount}
							/>
						)}

						{showSkeleton ? (
							<>
								{/* Skeleton for MetricsSummary */}
								<Box
									p="5"
									style={{
										background: "var(--color-panel-solid)",
										borderRadius: "var(--radius-3)",
										border: "1px solid var(--gray-a5)",
									}}
								>
									<Grid columns={{ initial: "2", sm: "4" }} gap="6">
										<SkeletonStat size="lg" />
										<SkeletonStat size="lg" />
										<SkeletonStat size="lg" />
										<SkeletonStat size="lg" />
									</Grid>
								</Box>

								{/* Skeleton for GPU cards */}
								<Box>
									<Heading size="4" mb="3">
										GPU Nodes
									</Heading>
									<Grid columns={{ initial: "1", sm: "2", lg: "3" }} gap="4">
										<SkeletonCard lines={4} />
										<SkeletonCard lines={4} />
										<SkeletonCard lines={4} />
									</Grid>
								</Box>
							</>
						) : (
							<>
								{/* Hero metrics summary */}
								<MetricsSummary status={status} />

								{/* Slurm section */}
								{status.slurm && <SlurmStatus slurm={status.slurm} />}

								{/* Alerts section */}
								<AlertsPanel />

								{/* GPU cards grid */}
								<Box>
									<Heading size="4" mb="3">
										GPU Nodes
									</Heading>
									{status.nodes.length === 0 ? (
										<Text color="gray">
											No nodes connected. Configure endpoints to see GPU metrics.
										</Text>
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
							</>
						)}
					</Flex>
				</Container>
			</Box>
		</Theme>
	);
}
