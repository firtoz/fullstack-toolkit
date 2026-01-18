import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useFadeIn, useScale } from "../../../shared/hooks/useMarkerAnimation";
import type { ResolvedMarker } from "../../../shared/lib/video-types";
import { codeSnippets } from "../script";

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
	const typeSafeTextOpacity = useFadeIn(fullySafeAppear, 8);
	const typeSafeTextScale = useScale(fullySafeAppear, {
		duration: 8,
		from: 0.9,
		to: 1,
	});

	// Terminal with install command
	const terminalOpacity = useFadeIn(installAppear, 10);

	// Build faster appears
	const buildFasterOpacity = useFadeIn(buildFasterAppear, 8);

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
					transform: `scale(${typeSafeTextScale})`,
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
