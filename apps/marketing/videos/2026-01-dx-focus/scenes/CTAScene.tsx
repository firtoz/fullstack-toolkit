import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { codeSnippets } from "../script";
import type { ResolvedMarker } from "../../../shared/lib/video-types";

interface Props {
	durationInFrames: number;
	markers: Record<string, ResolvedMarker>;
}

/**
 * CTA Scene - "Fully type-safe. One install. Build even faster."
 */
export const CTAScene: React.FC<Props> = ({ markers }) => {
	const frame = useCurrentFrame();

	const fullySafeAppear = markers.fullySafeAppear;
	const installAppear = markers.installAppear;
	const buildFasterAppear = markers.buildFasterAppear;

	// "Fully type-safe" text
	const typeSafeTextOpacity = interpolate(
		frame,
		[fullySafeAppear.startFrame, fullySafeAppear.startFrame + 8],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Terminal with install command
	const terminalOpacity = interpolate(
		frame,
		[installAppear.startFrame, installAppear.startFrame + 10],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Build faster appears
	const buildFasterOpacity = interpolate(
		frame,
		[buildFasterAppear.startFrame, buildFasterAppear.startFrame + 8],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Cursor blink
	const cursorVisible = Math.floor(frame / 15) % 2 === 0;

	return (
		<AbsoluteFill
			style={{
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			{/* "Fully type-safe" at top */}
			<div
				style={{
					position: "absolute",
					top: 120,
					opacity: typeSafeTextOpacity,
					transform: `scale(${0.9 + typeSafeTextOpacity * 0.1})`,
				}}
			>
				<span
					style={{
						fontSize: 48,
						fontWeight: 700,
						color: "#22c55e",
						fontFamily: "'Inter', sans-serif",
					}}
				>
					Fully type-safe everywhere ✨
				</span>
			</div>

			{/* Terminal with install command */}
			<div
				style={{
					position: "absolute",
					opacity: terminalOpacity,
					transform: `scale(${Math.min(terminalOpacity, 1)})`,
					background: "rgba(0, 0, 0, 0.7)",
					border: "1px solid rgba(255, 255, 255, 0.1)",
					borderRadius: 16,
					padding: "24px 48px",
					boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
					<span style={{ color: "#22c55e", fontSize: 24 }}>$</span>
					<code style={{ fontSize: 32, color: "#fff", fontWeight: 500 }}>
						{codeSnippets.installCommand}
					</code>
					<span
						style={{
							width: 3,
							height: 36,
							background: cursorVisible ? "#fff" : "transparent",
							marginLeft: 4,
						}}
					/>
				</div>
			</div>

			{/* Build even faster */}
			<div
				style={{
					position: "absolute",
					bottom: 100,
					opacity: buildFasterOpacity,
					transform: `scale(${Math.min(buildFasterOpacity, 1)})`,
					textAlign: "center",
				}}
			>
				<h2
					style={{
						fontSize: 72,
						fontWeight: 800,
						margin: 0,
						background:
							"linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fdba74 100%)",
						WebkitBackgroundClip: "text",
						WebkitTextFillColor: "transparent",
						fontFamily: "'Inter', sans-serif",
					}}
				>
					Build even faster. 🚀
				</h2>
			</div>
		</AbsoluteFill>
	);
};
