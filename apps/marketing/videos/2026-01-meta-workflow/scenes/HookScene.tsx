import {
	AbsoluteFill,
	Img,
	interpolate,
	staticFile,
	useCurrentFrame,
} from "remotion";
import type { SceneProps } from "../../../shared/components/VideoComposition";

export const HookScene: React.FC<SceneProps> = ({ markers }) => {
	const frame = useCurrentFrame();

	const directVideo = markers.directVideo;
	const talkingToAI = markers.talkingToAI;

	// Chat bubble animation
	const bubbleOpacity = interpolate(frame, [0, 10], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const bubbleScale = interpolate(frame, [0, 15], [0.8, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	// Typing effect simulation (characters appearing)
	const typingProgress = interpolate(frame, [15, 45], [0, 1], {
		extrapolateRight: "clamp",
	});
	const fullText = "Make a video about...";
	const charCount = Math.floor(fullText.length * typingProgress);
	const typedText = fullText.substring(0, charCount);

	// Highlight "AI"
	const isAIHighlighted = frame >= talkingToAI.startFrame;

	// Direct video emphasis
	const isDirectHighlighted = frame >= directVideo.startFrame;

	return (
		<AbsoluteFill style={{ backgroundColor: "#0f172a" }}>
			{/* Background Image */}
			<AbsoluteFill>
				<Img
					src={staticFile("2026-01-meta-workflow/images/hook-bg.png")}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
						opacity: 0.6,
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"radial-gradient(circle at center, rgba(15, 23, 42, 0.3) 0%, rgba(15, 23, 42, 0.6) 100%)",
					}}
				/>
			</AbsoluteFill>

			<AbsoluteFill
				style={{
					justifyContent: "center",
					alignItems: "center",
					padding: "0 120px",
				}}
			>
				{/* Chat Interface Container */}
				<div
					style={{
						width: "80%",
						maxWidth: 1000,
						backgroundColor: "rgba(30, 41, 59, 0.9)", // Slate 800 with opacity
						borderRadius: 24,
						padding: 40,
						boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
						opacity: bubbleOpacity,
						transform: `scale(${bubbleScale})`,
						border: "1px solid rgba(51, 65, 85, 0.5)",
						backdropFilter: "blur(12px)",
					}}
				>
					{/* User Message Bubble */}
					<div
						style={{
							alignSelf: "flex-end",
							backgroundColor: "#3b82f6", // Blue 500
							color: "white",
							padding: "20px 32px",
							borderRadius: "24px 24px 0 24px",
							fontSize: 48,
							fontFamily: "sans-serif",
							marginBottom: 20,
							marginLeft: "auto",
							maxWidth: "80%",
							display: "flex",
							alignItems: "center",
							boxShadow: isDirectHighlighted
								? "0 0 30px rgba(59, 130, 246, 0.6)"
								: "none",
						}}
					>
						{typedText}
						<span
							style={{
								display: "inline-block",
								width: 4,
								height: 48,
								backgroundColor: "white",
								marginLeft: 8,
								opacity: frame % 20 < 10 ? 1 : 0, // Blinking cursor
							}}
						/>
					</div>
				</div>

				{/* Subtitle / Narration Text */}
				<div
					style={{
						marginTop: 80,
						fontSize: 64,
						color: "#94a3b8",
						textAlign: "center",
						opacity: interpolate(frame, [10, 20], [0, 1]),
						textShadow: "0 2px 10px rgba(0,0,0,0.5)",
						zIndex: 10,
					}}
				>
					Direct a video by{" "}
					<span
						style={{
							color: isAIHighlighted ? "#a855f7" : "#e2e8f0", // Purple for AI
							fontWeight: isAIHighlighted ? "bold" : "normal",
							textShadow: isAIHighlighted
								? "0 0 20px rgba(168, 85, 247, 0.8)"
								: "none",
						}}
					>
						talking to an AI
					</span>
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
