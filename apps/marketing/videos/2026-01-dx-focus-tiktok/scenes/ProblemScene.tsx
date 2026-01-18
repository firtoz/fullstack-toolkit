import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import type { ResolvedMarker } from "../../../shared/lib/video-types";
import { FPS } from "../timing";

interface Props {
	durationInFrames: number;
	markers: Record<string, ResolvedMarker>;
}

/**
 * Problem Scene - "Fetchers. Submission state. Form actions. A lot to wire up."
 * TikTok vertical format
 */
export const ProblemScene: React.FC<Props> = ({
	durationInFrames,
	markers,
}) => {
	const frame = useCurrentFrame();

	// Get marker frames (all relative to scene start)
	const fetchersAppear = markers.fetchersAppear;
	const submissionAppear = markers.submissionAppear;
	const formAppear = markers.formAppear;
	const wireUpAppear = markers.wireUpAppear;

	// Items with their timing
	const items = [
		{ text: "Fetchers", icon: "📥", startFrame: fetchersAppear.startFrame },
		{
			text: "Submission state",
			icon: "🔄",
			startFrame: submissionAppear.startFrame,
		},
		{ text: "Form actions", icon: "📤", startFrame: formAppear.startFrame },
	];

	// "A lot to wire up" - new element, subtle delay
	const wireUpOpacity = interpolate(
		frame,
		[wireUpAppear.startFrame + 1, wireUpAppear.startFrame + 8],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const wireUpScale = spring({
		frame: Math.max(0, frame - (wireUpAppear.startFrame + 1)),
		fps: FPS,
		config: { damping: 12, stiffness: 100 },
	});

	// Fade out - only last 3 frames
	const fadeOut = interpolate(
		frame,
		[durationInFrames - 3, durationInFrames],
		[1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	return (
		<AbsoluteFill
			style={{
				justifyContent: "center",
				alignItems: "center",
				opacity: fadeOut,
				padding: "0 40px",
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 40,
					alignItems: "center",
					width: "100%",
					maxWidth: 800,
				}}
			>
				{/* Items appear as they're mentioned - stacked vertically for TikTok */}
				{items.map((item) => {
					// New element: 1 frame delay, 8 frame fade-in
					const itemOpacity = interpolate(
						frame,
						[item.startFrame + 1, item.startFrame + 9],
						[0, 1],
						{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
					);

					const itemY = interpolate(
						frame,
						[item.startFrame + 1, item.startFrame + 9],
						[15, 0],
						{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
					);

					return (
						<div
							key={item.text}
							style={{
								opacity: itemOpacity,
								transform: `translateY(${itemY}px)`,
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: 12,
								background: "rgba(255, 255, 255, 0.05)",
								border: "1px solid rgba(255, 255, 255, 0.1)",
								borderRadius: 16,
								padding: "28px 48px",
								width: "100%",
							}}
						>
							<span style={{ fontSize: 48 }}>{item.icon}</span>
							<span
								style={{
									fontSize: 28,
									color: "rgba(255, 255, 255, 0.9)",
									fontFamily: "'Inter', sans-serif",
									fontWeight: 500,
									textAlign: "center",
								}}
							>
								{item.text}
							</span>
						</div>
					);
				})}

				{/* "A lot to wire up" */}
				<div
					style={{
						marginTop: 40,
						opacity: wireUpOpacity,
						transform: `scale(${Math.min(wireUpScale, 1)})`,
					}}
				>
					<span
						style={{
							fontSize: 48,
							fontWeight: 600,
							color: "#fbbf24",
							fontFamily: "'Inter', sans-serif",
						}}
					>
						A lot to wire up... 🔌
					</span>
				</div>
			</div>
		</AbsoluteFill>
	);
};
