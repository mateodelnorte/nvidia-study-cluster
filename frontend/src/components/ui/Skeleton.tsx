import { Box } from "@radix-ui/themes";

interface SkeletonProps {
	width?: string | number;
	height?: string | number;
	variant?: "text" | "circular" | "rectangular";
	className?: string;
}

export function Skeleton({
	width = "100%",
	height = "1rem",
	variant = "rectangular",
	className = "",
}: SkeletonProps) {
	const baseStyles: React.CSSProperties = {
		width,
		height,
		backgroundColor: "var(--gray-a3)",
		animation: "skeleton-pulse 1.5s ease-in-out infinite",
	};

	const variantStyles: Record<string, React.CSSProperties> = {
		text: { borderRadius: "4px" },
		circular: { borderRadius: "50%" },
		rectangular: { borderRadius: "8px" },
	};

	return (
		<Box
			style={{ ...baseStyles, ...variantStyles[variant] }}
			className={className}
		/>
	);
}

interface SkeletonCardProps {
	showHeader?: boolean;
	lines?: number;
}

export function SkeletonCard({ showHeader = true, lines = 3 }: SkeletonCardProps) {
	return (
		<Box
			style={{
				padding: "var(--space-4)",
				backgroundColor: "var(--color-panel-solid)",
				borderRadius: "var(--radius-3)",
				border: "1px solid var(--gray-a5)",
			}}
		>
			{showHeader && (
				<Box style={{ marginBottom: "var(--space-3)" }}>
					<Skeleton width="60%" height="1.5rem" />
				</Box>
			)}
			{Array.from({ length: lines }).map((_, i) => (
				<Box key={i} style={{ marginBottom: i < lines - 1 ? "var(--space-2)" : 0 }}>
					<Skeleton width={i === lines - 1 ? "80%" : "100%"} height="1rem" />
				</Box>
			))}
		</Box>
	);
}

interface SkeletonStatProps {
	size?: "sm" | "md" | "lg";
}

export function SkeletonStat({ size = "md" }: SkeletonStatProps) {
	const heights = { sm: "1.5rem", md: "2rem", lg: "3rem" };
	return (
		<Box>
			<Box style={{ marginBottom: "var(--space-1)" }}>
				<Skeleton width="4rem" height="0.75rem" />
			</Box>
			<Skeleton width="6rem" height={heights[size]} />
		</Box>
	);
}

// Add keyframes via style tag (will be added once)
if (typeof document !== "undefined") {
	const styleId = "skeleton-animation";
	if (!document.getElementById(styleId)) {
		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
			@keyframes skeleton-pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.4; }
			}
		`;
		document.head.appendChild(style);
	}
}
