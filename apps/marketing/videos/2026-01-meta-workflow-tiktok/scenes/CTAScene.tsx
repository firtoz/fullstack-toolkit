import {
	AbsoluteFill,
	Img,
	interpolate,
	staticFile,
	useCurrentFrame,
} from "remotion";
import type { SceneProps } from "../../../shared/components/VideoComposition";

export const CTAScene: React.FC<SceneProps> = ({ markers }) => {
	const frame = useCurrentFrame();

	const fromWord = markers.fromWord;
	const promptWord = markers.promptWord;
	const toWord = markers.toWord;
	const videoWord = markers.videoWord;
	const creativePartner = markers.creativePartner;
	const checkPlaybook = markers.checkPlaybook;

	// "From prompt" - show prompt image, visible from start (top half)
	const promptOpacity = interpolate(
		frame,
		[fromWord.startFrame, fromWord.startFrame + 6],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// "to video" - video image fades in (bottom half)
	const videoOpacity = interpolate(
		frame,
		[toWord.startFrame + 2, toWord.startFrame + 10],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Labels timing
	const promptLabelOpacity = interpolate(
		frame,
		[promptWord.startFrame, promptWord.endFrame],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const videoLabelOpacity = interpolate(
		frame,
		[videoWord.startFrame, videoWord.startFrame + 6],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// "creative partner" - card zooms in
	const cardScale = interpolate(
		frame,
		[creativePartner.startFrame, creativePartner.startFrame + 12],
		[0.5, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const cardOpacity = interpolate(
		frame,
		[creativePartner.startFrame, creativePartner.startFrame + 8],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Title animation - staggered
	const titleOpacity = interpolate(
		frame,
		[creativePartner.startFrame + 4, creativePartner.startFrame + 12],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const toolkitOpacity = interpolate(
		frame,
		[creativePartner.startFrame + 8, creativePartner.startFrame + 16],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// "Check the playbook" - GitHub URL highlights/pulses
	const githubGlow = interpolate(
		frame,
		[
			checkPlaybook.startFrame,
			checkPlaybook.startFrame + 10,
			checkPlaybook.startFrame + 20,
		],
		[0, 1, 0.6],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const githubScale = interpolate(
		frame,
		[
			checkPlaybook.startFrame,
			checkPlaybook.startFrame + 8,
			checkPlaybook.startFrame + 16,
		],
		[1, 1.05, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	return (
		<AbsoluteFill style={{ backgroundColor: "#000" }}>
			{/* Background: The Prompt (BEFORE) - shown full screen first */}
			<AbsoluteFill
				style={{
					opacity: promptOpacity,
				}}
			>
				<Img
					src={staticFile(
						"2026-01-meta-workflow-tiktok/images/prompt-before.png",
					)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
				/>
				{/* Darken overlay */}
				<div
					style={{
						position: "absolute",
						inset: 0,
						backgroundColor: "rgba(0,0,0,0.3)",
					}}
				/>
			</AbsoluteFill>

			{/* Foreground: The Video Result (AFTER) - fades in on top */}
			<AbsoluteFill
				style={{
					opacity: videoOpacity,
				}}
			>
				<Img
					src={staticFile(
						"2026-01-meta-workflow-tiktok/images/video-result.png",
					)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
				/>
			</AbsoluteFill>

			{/* Labels - Large centered titles with dark cards */}
			<div
				style={{
					position: "absolute",
					top: "58%", // Slightly below center, still above bottom safe zone
					left: "50%",
					transform: "translate(-50%, -50%)",
					width: "90%",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				{/* "From Prompt" Label */}
				<div
					style={{
						opacity: promptLabelOpacity,
						transform: `translateY(${interpolate(promptLabelOpacity, [0, 1], [20, 0])}px)`,
						backgroundColor: "rgba(0, 0, 0, 0.85)",
						padding: "28px 40px",
						borderRadius: 20,
						border: "2px solid rgba(59, 130, 246, 0.4)",
						boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
						backdropFilter: "blur(10px)",
						maxWidth: "90%",
					}}
				>
					<div
						style={{
							fontSize: 48,
							fontWeight: "bold",
							color: "white",
							textAlign: "center",
							marginBottom: 8,
						}}
					>
						From Prompt
					</div>
					<div
						style={{
							fontSize: 22,
							color: "#94a3b8",
							textAlign: "center",
						}}
					>
						Your simple text idea
					</div>
				</div>

				{/* "To Video" Label */}
				<div
					style={{
						opacity: videoLabelOpacity,
						transform: `translateY(${interpolate(videoLabelOpacity, [0, 1], [20, 0])}px)`,
						backgroundColor: "rgba(0, 0, 0, 0.85)",
						padding: "28px 40px",
						borderRadius: 20,
						border: "2px solid rgba(249, 115, 22, 0.4)",
						boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
						backdropFilter: "blur(10px)",
						maxWidth: "90%",
					}}
				>
					<div
						style={{
							fontSize: 48,
							fontWeight: "bold",
							color: "white",
							textAlign: "center",
							marginBottom: 8,
						}}
					>
						To Video
					</div>
					<div
						style={{
							fontSize: 22,
							color: "#94a3b8",
							textAlign: "center",
						}}
					>
						Polished, professional content
					</div>
				</div>
			</div>

			{/* Center CTA Overlay */}
			<AbsoluteFill
				style={{
					justifyContent: "center",
					alignItems: "center",
					pointerEvents: "none",
					// TikTok safe zones: sides 5%
					padding: "0 5%",
				}}
			>
				<div
					style={{
						backgroundColor: "rgba(10, 10, 15, 0.95)",
						padding: "40px 48px",
						borderRadius: 24,
						border: "1px solid rgba(255,255,255,0.1)",
						backdropFilter: "blur(20px)",
						transform: `scale(${cardScale})`,
						opacity: cardOpacity,
						textAlign: "center",
						boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
						width: "100%",
						maxWidth: 800,
					}}
				>
					<div
						style={{
							fontSize: 24,
							color: "#94a3b8",
							marginBottom: 16,
							opacity: titleOpacity,
							transform: `translateY(${interpolate(titleOpacity, [0, 1], [10, 0])}px)`,
						}}
					>
						Your new creative partner
					</div>
					<div
						style={{
							fontSize: 48,
							fontWeight: "bold",
							background: "linear-gradient(135deg, #22d3ee, #818cf8, #f472b6)",
							backgroundSize: "200% 200%",
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
							marginBottom: 24,
							opacity: toolkitOpacity,
							transform: `translateY(${interpolate(toolkitOpacity, [0, 1], [10, 0])}px)`,
							lineHeight: 1.2,
						}}
					>
						fullstack-toolkit
					</div>
					<div
						style={{
							fontSize: 18,
							color: "#cbd5e1",
							fontFamily: "monospace",
							background: "rgba(30, 41, 59, 0.8)",
							padding: "12px 24px",
							borderRadius: 12,
							border: `1px solid ${githubGlow > 0.5 ? "#22d3ee" : "#475569"}`,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: 10,
							transform: `scale(${githubScale})`,
							boxShadow:
								githubGlow > 0.3
									? `0 0 ${30 * githubGlow}px rgba(34, 211, 238, ${githubGlow * 0.5})`
									: "none",
							flexWrap: "wrap",
						}}
					>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="currentColor"
							aria-label="GitHub"
						>
							<title>GitHub</title>
							<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
						</svg>
						<span style={{ wordBreak: "break-all" }}>
							github.com/firtoz/fullstack-toolkit
						</span>
					</div>
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
