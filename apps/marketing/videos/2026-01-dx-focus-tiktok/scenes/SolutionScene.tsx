import {
	AbsoluteFill,
	Img,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
} from "remotion";
import { useMarkerAnimation } from "../../../shared/hooks/useMarkerAnimation";
import type { ResolvedMarker } from "../../../shared/lib/video-types";
import { FPS } from "../timing";

interface Props {
	durationInFrames: number;
	markers: Record<string, ResolvedMarker>;
}

/**
 * Solution Scene - "router-toolkit. Dynamic fetchers and submitters that just work."
 * TikTok vertical format
 */
export const SolutionScene: React.FC<Props> = ({
	durationInFrames,
	markers,
}) => {
	const frame = useCurrentFrame();

	// Get marker frames (all relative to scene start)
	const toolkitReveal = markers.toolkitReveal;
	const taglineAppear = markers.taglineAppear;
	const justWorkHighlight = markers.justWorkHighlight;

	// Logo appears - new element, subtle delay
	const logoScale = spring({
		frame: Math.max(0, frame - Math.max(0, toolkitReveal.startFrame - 2)),
		fps: FPS,
		config: { damping: 12, stiffness: 100 },
	});

	// Name appears - new element, subtle delay
	const nameOpacity = useMarkerAnimation(toolkitReveal, { duration: 8 });

	// Tagline appears - new element, subtle delay
	const taglineOpacity = useMarkerAnimation(taglineAppear, { delay: 1 });

	// "just work" highlight - INSTANT (color change on existing text)
	const isJustWorkHighlighted = frame >= justWorkHighlight.startFrame;

	// Fade out
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
					alignItems: "center",
					gap: 40,
					maxWidth: 900,
				}}
			>
				{/* Logo */}
				<div
					style={{
						transform: `scale(${Math.min(logoScale, 1)})`,
						filter: "drop-shadow(0 20px 40px rgba(249, 115, 22, 0.4))",
					}}
				>
					<Img
						src={staticFile("logo.png")}
						style={{
							width: 160,
							height: 160,
						}}
					/>
				</div>

				{/* Package name */}
				<div
					style={{
						opacity: nameOpacity,
						textAlign: "center",
					}}
				>
					<h1
						style={{
							fontSize: 64,
							fontWeight: 700,
							color: "#fff",
							margin: 0,
							fontFamily: "'Inter', sans-serif",
						}}
					>
						router-toolkit
					</h1>
				</div>

				{/* Tagline */}
				<div
					style={{
						opacity: taglineOpacity,
						textAlign: "center",
					}}
				>
					<p
						style={{
							fontSize: 36,
							color: "rgba(255, 255, 255, 0.8)",
							margin: 0,
							fontFamily: "'Inter', sans-serif",
							lineHeight: 1.5,
						}}
					>
						Dynamic fetchers and submitters that{" "}
						<span
							style={{
								color: isJustWorkHighlighted
									? "#22c55e"
									: "rgba(255, 255, 255, 0.8)",
								fontWeight: 700,
								textShadow: isJustWorkHighlighted
									? "0 0 15px rgba(34, 197, 94, 0.5)"
									: "none",
							}}
						>
							just work
						</span>
					</p>
				</div>
			</div>
		</AbsoluteFill>
	);
};
