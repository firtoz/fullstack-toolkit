import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	spring,
	Img,
	staticFile,
} from "remotion";
import type { ResolvedMarker } from "../../../shared/lib/video-types";
import { FPS } from "../timing";

interface Props {
	durationInFrames: number;
	markers: Record<string, ResolvedMarker>;
}

/**
 * Solution Scene - "router-toolkit. Dynamic fetchers and submitters that just work."
 */
export const SolutionScene: React.FC<Props> = ({ durationInFrames, markers }) => {
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
	const nameOpacity = interpolate(
		frame,
		[Math.max(0, toolkitReveal.startFrame), toolkitReveal.startFrame + 8],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Tagline appears - new element, subtle delay
	const taglineOpacity = interpolate(
		frame,
		[taglineAppear.startFrame + 1, taglineAppear.startFrame + 9],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

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
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 28,
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
							width: 140,
							height: 140,
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
							fontSize: 56,
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
							fontSize: 32,
							color: "rgba(255, 255, 255, 0.8)",
							margin: 0,
							fontFamily: "'Inter', sans-serif",
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
