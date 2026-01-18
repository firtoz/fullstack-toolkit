import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { useMarkerAnimation } from "../../../shared/hooks/useMarkerAnimation";
import type { ResolvedMarker } from "../../../shared/lib/video-types";

interface Props {
	durationInFrames: number;
	markers: Record<string, ResolvedMarker>;
}

/**
 * Hook Scene - "React Router is great. But what if it could be even easier?"
 * TikTok vertical format
 */
export const HookScene: React.FC<Props> = ({ durationInFrames, markers }) => {
	const frame = useCurrentFrame();

	// Get marker frames (all relative to scene start, which is 0)
	const greatHighlight = markers.greatHighlight;
	const secondLineAppear = markers.secondLineAppear;
	const evenEasierHighlight = markers.evenEasierHighlight;

	// "great" highlight - INSTANT (color change when word starts)
	const isGreatHighlighted = frame >= greatHighlight.startFrame;

	// "even easier" highlight - INSTANT (color change when "even" starts)
	const isEasierHighlighted = frame >= evenEasierHighlight.startFrame;

	// First part fades in - new element, subtle delay
	const part1Opacity = interpolate(frame, [0, 8], [0, 1], {
		extrapolateRight: "clamp",
	});

	// Second part appears when "what" is spoken
	const part2Opacity = useMarkerAnimation(secondLineAppear, {
		delay: 1,
		duration: 8,
	});

	// Fade out - minimal, only 3 frames
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
			<div style={{ textAlign: "center", maxWidth: 900 }}>
				{/* First line: React Router is great */}
				<div
					style={{
						opacity: part1Opacity,
						marginBottom: 60,
					}}
				>
					<span
						style={{
							fontSize: 56,
							fontWeight: 600,
							color: "white",
							fontFamily: "'Inter', sans-serif",
						}}
					>
						React Router is{" "}
					</span>
					<span
						style={{
							fontSize: 56,
							fontWeight: 700,
							color: isGreatHighlighted ? "#22c55e" : "white",
							fontFamily: "'Inter', sans-serif",
							textShadow: isGreatHighlighted
								? "0 0 20px rgba(34, 197, 94, 0.5)"
								: "none",
						}}
					>
						great
					</span>
					<span
						style={{
							fontSize: 56,
							fontWeight: 600,
							color: "white",
							fontFamily: "'Inter', sans-serif",
						}}
					>
						.
					</span>
				</div>

				{/* Second line: But what if it could be even easier? */}
				<div
					style={{
						opacity: part2Opacity,
					}}
				>
					<span
						style={{
							fontSize: 48,
							fontWeight: 500,
							color: "rgba(255, 255, 255, 0.9)",
							fontFamily: "'Inter', sans-serif",
						}}
					>
						But what if it could be{" "}
					</span>
					<span
						style={{
							fontSize: 56,
							fontWeight: 700,
							color: isEasierHighlighted
								? "#f97316"
								: "rgba(255, 255, 255, 0.9)",
							fontFamily: "'Inter', sans-serif",
							textShadow: isEasierHighlighted
								? "0 0 15px rgba(249, 115, 22, 0.5)"
								: "none",
						}}
					>
						even easier
					</span>
					<span
						style={{
							fontSize: 48,
							fontWeight: 500,
							color: "rgba(255, 255, 255, 0.9)",
							fontFamily: "'Inter', sans-serif",
						}}
					>
						?
					</span>
				</div>
			</div>
		</AbsoluteFill>
	);
};
