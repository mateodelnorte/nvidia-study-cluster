import { Box, Button, Callout, Flex, Text } from "@radix-ui/themes";
import { useState } from "react";

interface ErrorBannerProps {
	message: string;
	details?: string;
	onRetry?: () => void;
	onDismiss?: () => void;
	dismissible?: boolean;
	consecutiveErrors?: number;
	nextRetryIn?: number; // seconds until next automatic retry
}

export function ErrorBanner({
	message,
	details,
	onRetry,
	onDismiss,
	dismissible = true,
	consecutiveErrors,
	nextRetryIn,
}: ErrorBannerProps) {
	const [dismissed, setDismissed] = useState(false);

	if (dismissed) return null;

	const handleDismiss = () => {
		setDismissed(true);
		onDismiss?.();
	};

	// Generate retry status message
	const getRetryStatus = () => {
		if (!consecutiveErrors || consecutiveErrors === 0) return null;
		if (nextRetryIn && nextRetryIn > 0) {
			return `Retrying in ${nextRetryIn}s (attempt ${consecutiveErrors})`;
		}
		return `Failed ${consecutiveErrors} time${consecutiveErrors > 1 ? "s" : ""}`;
	};

	const retryStatus = getRetryStatus();

	return (
		<Callout.Root color="red" variant="surface">
			<Callout.Icon>
				<ErrorIcon />
			</Callout.Icon>
			<Flex justify="between" align="center" flexGrow="1" gap="3">
				<Box>
					<Callout.Text>{message}</Callout.Text>
					{details && (
						<Text size="1" color="red" style={{ opacity: 0.8 }}>
							{details}
						</Text>
					)}
					{retryStatus && (
						<Text size="1" color="gray" style={{ display: "block", marginTop: 2 }}>
							{retryStatus}
						</Text>
					)}
				</Box>
				<Flex gap="2">
					{onRetry && (
						<Button size="1" variant="soft" color="red" onClick={onRetry}>
							<RetryIcon />
							Retry Now
						</Button>
					)}
					{dismissible && (
						<Button
							size="1"
							variant="ghost"
							color="red"
							onClick={handleDismiss}
							style={{ padding: "var(--space-1)" }}
						>
							<CloseIcon />
						</Button>
					)}
				</Flex>
			</Flex>
		</Callout.Root>
	);
}

function ErrorIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="currentColor"
		>
			<path
				fillRule="evenodd"
				d="M8 15A7 7 0 108 1a7 7 0 000 14zm0-2.5a1 1 0 100-2 1 1 0 000 2zm0-8a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4.5z"
			/>
		</svg>
	);
}

function RetryIcon() {
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
			<path d="M1 7a6 6 0 1011.25-2.93M12 1v3.07h-3.07" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
		>
			<path d="M3 3l8 8M11 3L3 11" />
		</svg>
	);
}
